const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'dummy-environment');
const express = require('../backend/node_modules/express');
const app = express();
function localPort(name, fallback) {
    const port = Number(process.env[name] || fallback);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port: ' + name);
    return port;
}
const apiPort = localPort('UNILUS_PREVIEW_API_PORT', 5001);
const webPort = localPort('UNILUS_PREVIEW_WEB_PORT', 8081);
const password = randomBytes(24).toString('base64url');
const backend = spawn(process.execPath, [path.join(root,'backend/scripts/startIsolatedLocalTest.cjs'),'--port=' + apiPort], {
    env: { ...process.env, NODE_OPTIONS: '', UNILUS_LOCAL_TEST_PASSWORD: password }, stdio: ['ignore','pipe','inherit']
});
let server;
backend.on('exit', () => { server?.close(); });
process.on('SIGINT', () => { backend.kill(); server?.close(); });
backend.stdout.resume();
const api = 'http://127.0.0.1:' + apiPort;
async function start() {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
        try { const r = await fetch(api+'/__local-test/status'); if (r.ok && (await r.json()).pid === backend.pid) { ready = true; break; } } catch {}
        if (backend.exitCode !== null) break;
        await new Promise(resolve => setTimeout(resolve,100));
    }
    if (!ready) throw Error('Isolated backend unavailable on configured port');
    app.get('/js/runtime-config.js', (_req,res)=>res.type('js').send('window.UNILUS_API_BASE='+JSON.stringify(api+'/api')+';'));
    for (const [route,user] of [['review-fixed.html','demo'],['review-flex.html','student'],['review-guest.html',null]]) {
        app.get('/'+route, async (_req,res) => {
            let token = null;
            if (user) {
                const reply = await fetch(api+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:user,password})});
                if (!reply.ok) throw Error('Synthetic sign-in unavailable');
                token = (await reply.json()).token;
            }
            const html = fs.readFileSync(path.join(web,user?'portal.html':'website.html'),'utf8');
            const boot = token ? 'sessionStorage.setItem("unilusAuthToken",'+JSON.stringify(token)+');sessionStorage.setItem("unilusDemoSession","authenticated");sessionStorage.setItem("unilusDemoProgramme","bachelor-of-science-in-information-systems-and-technology");' : 'sessionStorage.clear();';
            res.set('Cache-Control','no-store').type('html').send(html.replace('<head>','<head><script>'+boot+'</script>'));
        });
    }
    app.use(express.static(web));
    server = app.listen(webPort,'127.0.0.1',()=>console.log(['guest','fixed','flex'].map(kind => 'http://127.0.0.1:'+webPort+'/review-'+kind+'.html').join('\n')));
    server.on('error',()=>{backend.kill();process.exitCode=1;});
}
start().catch(error=>{console.error(error.message);backend.kill();process.exitCode=1;});
