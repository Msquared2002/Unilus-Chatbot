const verified = require('./programmeVerifiedData');
const source = require('../../dummy-environment/js/demo-programmes');
const coverage = require('../data/advisor/current-offerings-coverage.json');
const chunks = require('../data/documents/chunks.json');
const catalogue = [...source.programmes, ...verified.currentNames.filter(name=>!source.programmes.some(p=>p.name===name)).map(name=>({name,id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}))].map(p => {
 const review=coverage.find(r=>r.id===p.id);
 const evidence = chunks.filter(c => c.text.includes(p.name)).slice(0, 4);
 return { ...p, review, school:review?.school || null, level: /^Bachelor/.test(p.name) ? 'undergraduate' : /^Diploma/.test(p.name)?'diploma':/^Master/.test(p.name)?'postgraduate':/^Doctor/.test(p.name)?'postgraduate':/^Certificate/.test(p.name)?'certificate':'other',
  evidence: evidence.length ? evidence.map(c => ({chunkId:c.id, text:c.text, source:c.metadata?.source_file, page:c.metadata?.page_number, year:c.metadata?.academic_year})) : verified.rules[p.id] ? [{source:verified.rules[p.id].url,section:verified.rules[p.id].section,year:null}] : [],
  offeringStatus:verified.currentNames.includes(p.name) ? 'current_application_catalogue' : 'unverified', applicationSource:verified.applicationSource, verifiedAt:verified.verifiedAt, description:review?.description || verified.rules[p.id]?.description || null, requirementsStatus:verified.rules[p.id]?.status || 'not_sufficiently_documented', rules:verified.rules[p.id] ? [verified.rules[p.id]] : [] };
});
module.exports = { catalogue };
