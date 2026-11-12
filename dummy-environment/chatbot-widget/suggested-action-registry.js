const definitions = Object.freeze({
  'context.followup': 'quick_reply',
  'advisor.reset': 'quick_reply', 'advisor.qualify':'quick_reply', 'advisor.followup':'quick_reply',
  'programme.requirements': 'quick_reply', 'programme.details': 'quick_reply',
  'timetable.day': 'quick_reply', 'timetable.stage': 'quick_reply',
  'campus.nearby': 'quick_reply', 'campus.map': 'navigation'
});
function validateAction(a) {
  if (!a || !Object.hasOwn(definitions, a.id) || definitions[a.id] !== a.type ||
      typeof a.label !== 'string' || !a.label.trim() || a.label.length > 80 || !a.payload) return false;
  if (a.type === 'quick_reply') return Object.keys(a.payload).length === 1 &&
    typeof a.payload.question === 'string' && a.payload.question.trim().length > 0 && a.payload.question.length <= 600;
  return Object.keys(a.payload).every(k => ['placeId', 'campus'].includes(k)) &&
    a.payload.campus === 'silverest' && typeof a.payload.placeId === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(a.payload.placeId);
}
const api = { definitions, validateAction };
if (typeof module !== 'undefined') module.exports = api;
if (typeof window !== 'undefined') window.UnilusActions = api;
