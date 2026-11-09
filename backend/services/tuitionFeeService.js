const catalogue = require('../data/tuition-fees.json');
const normalize = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const programmes = [
  ['Bachelor of Science in Computer Science', /\bcomputer science\b/],
  ['Bachelor of Science in Cyber Security', /\b(?:cyber security|cybersecurity|bcs)\b/],
  ['Bachelor of Science in Information Systems and Technology', /\b(?:bit|information systems(?: and technology)?)\b/],
  ['Bachelor of Science in Information Technology', /\binformation technology\b/],
  ['Bachelor of Laws', /\b(?:llb|law|laws)\b/],
  ['Bachelor of Medicine and Surgery', /\b(?:medicine|mbbs|mbchb)\b/],
];
function isTuitionQuery(text) {
  return /\b(?:fees?|tuition|cost(?:s)?|how much)\b/i.test(text) &&
    !/\b(?:accommodation|hostels?|application|registration|graduation|exemption|transcript|payment|bank|ticket|complaint)\b/i.test(text);
}
function parse(text) {
  const q = normalize(text), matches = programmes.filter(([, re]) => re.test(q)).map(([name]) => name);
  for (const row of catalogue.schedules) {
    const name = normalize(row.programme);
    const subject = name.replace(/^(?:bachelor of science in|bachelor of arts in|bachelor of|bsc in) /, '');
    if ((q.includes(name) || ` ${q} `.includes(` ${subject} `)) && !matches.some(value => normalize(value) === name)) matches.push(row.programme);
  }
  const foreign = /\b(?:foreign|international|non sadc|usd)\b/.test(q);
  const local = /\b(?:local|zambian|zmw)\b/.test(q) || (!foreign && /\bsadc\b/.test(q));
  const pair = text.match(/\b([1-9])\s*\/\s*([1-9])\b/);
  const calendarYears = [...new Set(text.match(/\b20\d{2}\b/g) || [])];
  return { programmes: [...new Map(matches.map(name => [normalize(name), name])).values()],
    academicYear: calendarYears.length > 1 ? 'ambiguous' : Number(calendarYears[0]) || null,
    category: local && foreign ? 'conflict' : local ? 'local_sadc' : foreign ? 'foreign' : null,
    studyYear: Number(text.match(/\b(?:year|yr)\s*([1-9])\b/i)?.[1] || pair?.[1]) || null,
    semester: Number(text.match(/\b(?:semester|sem)\s*([1-9])\b/i)?.[1] || pair?.[2]) || null };
}
function merge(prior, current) {
  return Object.fromEntries(Object.entries(current).map(([key, value]) => [key, key === 'programmes' ? (value.length ? value : prior[key]) : value ?? prior[key]]));
}
function tryAnswer(question, history = []) {
  if (/\b(?:masters?|msc|postgraduate|phd|doctorate)\b/i.test(question)) return null;
  // Keep programme-specific clinical schedules outside this small lookup on
  // their existing RAG path; never replace their evidence with a generic row.
  if (/\b(?:pharmacy|biomedical|nursing|diploma)\b/i.test(question)) return null;
  const last = history.at(-1);
  const continuation = last?.role === 'assistant' && last.content.startsWith('For tuition fees,') &&
    !/\b(?:timetable|class|admission|requirements?|ticket|hello|campus|results?|marks?|cancel)\b/i.test(question) &&
    (isTuitionQuery(question) || parse(question).programmes.length || /^(?:local|sadc|foreign|international|zmw|usd|20\d{2}|year\b|semester\b|sem\b|[1-6]\/)/i.test(question.trim()));
  if (!isTuitionQuery(question) && !continuation) return null;
  let fields = parse(question);
  if (continuation) {
    // Reconstruct only the contiguous fee exchange from existing session history.
    // The assistant's prose is never a source of fee amounts or programme identity.
    const turns = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      if (turn.role === 'assistant' && !turn.content.startsWith('For tuition fees,')) break;
      if (turn.role === 'user') { turns.unshift(turn.content); if (isTuitionQuery(turn.content)) break; }
    }
    const prior = turns.reduce((previous, text) => merge(previous, parse(text)), parse(''));
    fields = merge(prior, fields);
  }
  let answer, rows = [], status = 'clarification';
  const programme = fields.programmes[0];
  if (fields.academicYear === 'ambiguous') {
    answer = 'which schedule year do you want? Please select one calendar year so the figures remain separate.';
  } else if (fields.programmes.length > 1 || /\b(?:computing|technology|it)\b/i.test(question) && !programme) {
    answer = 'which programme do you mean: Computer Science, Cyber Security, Information Systems and Technology (BIT), or Information Technology? These names are not interchangeable.';
  } else if (!fields.category || fields.category === 'conflict') {
    answer = 'are you a local/SADC student (ZMW) or a foreign/international student (USD)?' + (!programme ? ' Please also name the programme.' : ` Programme: ${programme}.`);
  } else if (!programme) {
    answer = 'which programme do you mean? For example: Computer Science, Cyber Security, Information Systems and Technology (BIT), Law (LLB), or Medicine.';
  } else {
    rows = catalogue.schedules.filter(r => normalize(r.programme) === normalize(programme) && r.category === fields.category);
    const year = fields.academicYear || Math.max(...rows.map(r => r.academicYear));
    rows = rows.filter(r => r.academicYear === year);
    if (!rows.length) {
      status = 'unavailable';
      answer = `I do not have a verified ${fields.academicYear || ''} ${fields.category === 'local_sadc' ? 'local/SADC' : 'foreign'} fee schedule for ${programme}. I will not substitute another programme or year.`;
    } else {
      const row = rows[0], semesters = row.semesters.filter(s => (!fields.studyYear || s.studyYear === fields.studyYear) && (!fields.semester || s.semester === fields.semester));
      if (!semesters.length) { answer = 'that academic stage is not listed in the verified schedule. Please check the study year and semester.'; }
      else {
        status = 'answered';
        answer = `${programme} — ${row.academicYear} ${row.category === 'local_sadc' ? 'local and SADC students' : 'foreign/international students'} (${row.currency}).\n\n` +
          '| Study year | Semester | Published semester fees |\n|---|---|---|\n' + semesters.map(s => `| ${s.studyYear} | ${s.semester} | ${row.currency} ${s.amount.toLocaleString('en-GB')} |`).join('\n') +
          `\n\nSource: ${row.source}, PDF page ${row.page}. These are the published semester fee figures; they are not a verified tuition-only breakdown. General charges are not added again.` +
          (fields.academicYear ? '' : ` The most recent verified schedule for this exact programme/category in this lookup is ${row.academicYear}; this is not a claim about current fees.`) +
          (row.yearBasis.includes('filename') ? ' The USD document body omits the calendar year; its official filename identifies 2026.' : '');
      }
    }
  }
  return { answer: 'For tuition fees, ' + answer, queryType: { isTuition: true, isKnowledge: true, isTimetable: false, isMixed: false, entities: fields },
    sources: rows.map(row => ({ source_file: row.source, page_number: row.page, title: row.programme, academic_year: row.academicYear, currency: row.currency, audience: row.category, source_type: 'pdf', source_sha256: catalogue.sources[row.source] })),
    tuition: { status, ...fields, schedules: rows }, resources: [], recommendedResources: [], timetableMatches: 0, suggestedActions: [], ticket: null, usedFallback: false };
}
module.exports = { tryAnswer, parse, isTuitionQuery };
