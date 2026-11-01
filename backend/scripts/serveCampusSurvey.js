#!/usr/bin/env node
// Bind to localhost. On Android, `adb reverse tcp:8765 tcp:8765` exposes this as phone localhost.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const allowed = new Set([
  '/dummy-environment/campus-survey.html', '/dummy-environment/campus-survey.js',
  '/dummy-environment/campus-survey-core.js', '/dummy-environment/campus-survey-review.html',
  ...['boundary','buildings','places','routing_graph','place_catalog'].map(x => `/backend/data/campus/campus_${x}.json`)
]);
const port = Number(process.env.CAMPUS_SURVEY_PORT || 8765);
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const name = url.pathname === '/' ? '/dummy-environment/campus-survey.html' : url.pathname;
  if (!allowed.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  const file = path.join(root, name.slice(1));
  res.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : name.endsWith('.js') ? 'text/javascript' : 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).on('error', () => { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Survey page: http://localhost:${port}/`));
