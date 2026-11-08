const { validateAction } = require('./suggestedActionRegistry');
const timetable = require('./timetableService');
const campus = require('./campusRepository');
const catalogue = require('../../dummy-environment/js/demo-programmes');
function normalize(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function recognizeProgramme(question) {
  const q = ` ${normalize(question)} `;
  const matches = catalogue.programmes.filter(p => {
    const name = normalize(p.name);
    const subject = name.replace(/^(bachelor|master|doctor|diploma|certificate)( of| in| of science| of arts| of science in| of arts in)? /, '');
    const verifiedAlias = p.id === "bachelor-of-laws" && q.includes(" llb ");
    return verifiedAlias || q.includes(` ${name} `) || (subject.length >= 8 && q.includes(` ${subject} `));
  });
  return matches.length === 1 ? matches[0] : null;
}
function selectActions(question, result, records = []) {
  const actions = [];
  const reply = (id, label, question) => actions.push({ id, type: 'quick_reply', label, payload: { question } });
  const nav = result.navigation;
  if (nav && campus.getPlaceById(nav.placeId)) {
    actions.push({ id: 'campus.map', type: 'navigation', label: 'View on map', payload: { placeId: nav.placeId, campus: 'silverest' } });
    if (result.queryType?.intentType !== 'proximity' && campus.getNearby(nav.placeId, { maxDistanceMeters: 200 }).length)
      reply('campus.nearby', 'Find nearby places', `What places are near ${nav.name} on Silverest campus?`);
  } else if (result.queryType?.isTimetable) {
    const e = result.queryType.entities || {};
    const scope = e.courseCode || (e.lecturer ? `lecturer ${e.lecturer}` : e.venueCode);
    if (e.programmeFamily && (!e.year || !e.semester)) {
      const stages = timetable.getAll().filter(r => String(r.programme_code || '').match(new RegExp(`^${e.programmeFamily}[1-9][1-9]`)));
      const choices = new Set();
      for (const r of stages) {
        const m = String(r.programme_code).match(/^(.*?)([1-9])([1-9])/);
        if (!m || (e.year && +m[2] !== e.year) || (e.semester && +m[3] !== e.semester)) continue;
        const year = +m[2], sem = +m[3];
        const key = e.year ? sem : year;
        if (choices.has(key)) continue;
        choices.add(key);
        reply('timetable.stage', e.year ? `Semester ${sem}` : `Year ${year}`, `Show ${e.programmeFamily} year ${year}${e.year || e.semester ? ` semester ${e.semester || sem}` : ''}${e.studyMode ? ` ${e.studyMode.replace('_', ' ')}` : ''} timetable`);
      }
    } else if (records.length && (scope || (e.programmeFamily && e.year && e.semester))) {
      const context = scope || `${e.programmeFamily} year ${e.year} semester ${e.semester}${e.studyMode ? ` ${e.studyMode.replace('_', ' ')}` : ''}`;
      for (const day of [...new Set(records.map(r => r.day))].filter(d => d && d !== e.day))
        reply('timetable.day', `Show ${day}`, `Show the ${context} timetable for ${day}`);
    }
  } else if (result.sources?.length) {
    const p = recognizeProgramme(question);
    if (p) {
      if (!/entry|requirement/i.test(question)) reply('programme.requirements', 'View entry requirements', `What are the entry requirements for ${p.name}?`);
      if (!/details|overview/i.test(question)) reply('programme.details', 'Explore programme details', `Give programme details for ${p.name}.`);
    }
  }
  const seen = new Set();
  return actions.filter(a => validateAction(a) && !seen.has(JSON.stringify(a.payload)) && seen.add(JSON.stringify(a.payload))).slice(0, 4);
}
module.exports = { selectActions, recognizeProgramme };
