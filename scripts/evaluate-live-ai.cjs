// Opt-in evaluation. Run only with approval to use the provided Groq account.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
if (!process.argv.includes('--approved-live-inference') || !process.env.GROQ_API_KEY)
    throw Error('Set a privately supplied Groq key and pass --approved-live-inference after approval.');
const key = process.env.GROQ_API_KEY;
for (const name of Object.keys(process.env)) {
    if (!/^(systemroot|windir|path|pathext|temp|tmp|userprofile|localappdata|appdata)$/i.test(name)) delete process.env[name];
}
Object.assign(process.env, { GROQ_API_KEY:key, GROQ_BASE_URL:'https://api.groq.com', NODE_ENV:'test',
    SQLITE_FILE:':memory:', VECTOR_BACKEND:'json', QUERY_PLANNER_ENABLED:'true',
    KNOWLEDGE_TEST_WORK_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'unilus-live-')) });
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    if (first?.host !== 'api.groq.com' || Number(first.port) !== 443) throw Error('Outbound connection blocked');
    return connect.apply(this,args);
};
const fetchImplementation = global.fetch;
let requests = 0;
global.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin !== 'https://api.groq.com' || !url.pathname.startsWith('/openai/v1/')) throw Error('Outbound fetch blocked');
    if (++requests > 12) throw Error('Evaluation inference request budget reached');
    return fetchImplementation(input,{...options,redirect:'error'});
};
const imported = require('../backend/node_modules/groq-sdk');
const Original = imported.default || imported;
class BoundedGroq extends Original {
    constructor(options) {
        super({...options,baseURL:process.env.GROQ_BASE_URL,apiKey:key,fetch:global.fetch,maxRetries:0,timeout:12000});
    }
}
require.cache[require.resolve('../backend/node_modules/groq-sdk')].exports = BoundedGroq;
require('../backend/services/embeddingService').createEmbedding = async () => { throw Error('Evaluation uses lexical retrieval'); };
const profiles = require('../backend/services/demoAcademicService');
const chat = require('../backend/services/chatService');
const db = require('../backend/services/db');
const ownership = require('../backend/services/sessionOwnershipService');
const prompts = ['What programmes can I study if I like history?', 'How much would accommodation cost me?', 'Where can I get help with my fees?', 'What does the university hospital offer?', "What’s my longest break on Monday?", 'What about Friday?'];
(async () => {
    const user = {username:'demo',role:'student',programme:'BIT',year:3,semester:2};
    const profile = profiles.generate(user);
    const session = await ownership.resolveSession(null,user);
    profile.sessionId = session;
    const rows = [];
    for (const question of prompts) {
        const start = Date.now();
        try {
            const result = await chat.answerQuestion(question,session,'student',profile,{user,academicProfile:profile});
            rows.push({question,answer:String(result.answer).replaceAll(key,'[REDACTED]'),sourceCount:result.sources?.length||0,ms:Date.now()-start});
        } catch { rows.push({question,error:'Evaluation request failed',ms:Date.now()-start}); }
    }
    const out = path.join(process.env.KNOWLEDGE_TEST_WORK_DIR,'evaluation.json');
    fs.writeFileSync(out,JSON.stringify({requests,rows},null,2),{flag:'wx'});
    console.log(out);
})().catch(()=>{process.exitCode=1;console.error('Evaluation failed');}).finally(()=>db.close());
