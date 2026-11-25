const campuses = require('../data/campus/additional-campuses.json');
const labels = { pioneer: /\b(?:pioneer|mass media)\b/i, leopards: /\bleopards? hill\b/i, silverest: /\bsilverest\b/i };
const normalize = text => String(text).toLowerCase().replace(/&/g, ' and ').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function scope(text) { return Object.keys(labels).find(key => labels[key].test(text)); }
function search(text, campus, exact = false) {
    const query = normalize(text.replace(labels[campus] || /$^/, '').replace(/\b(?:where (?:is|are)|how (?:do|can) i find|show me|at|the|campus)\b/gi, ''));
    if (!query) return [];
    return (campuses[campus]?.directory || []).filter(row =>
        [row.name, ...row.aliases].some(label => {
            const value = normalize(label);
            return value === query || (!exact && value.includes(query));
        })
    ).slice(0, 25);
}
function describe(row) {
    const floor = ['ground floor', 'first floor', 'second floor'][row.floor];
    return [row.building, floor].filter(Boolean).join(', ');
}
function location(row, key) {
    return row.anchor ? { placeId: row.anchor, campus: key, placeName: row.name } : undefined;
}
function answer(question) {
    if (!/\b(?:where|find|locate|directions to)\b/i.test(question)) return null;
    const key = scope(question);
    if (key === 'silverest' || (!key && !/\b(?:room\s+\d+|sick bay|knowledge base\s+\d+)\b/i.test(question))) return null;
    const matches = (key ? [key] : Object.keys(campuses)).flatMap(campus =>
        search(question, campus, true).map(row => ({ row, campus })));
    if (!matches.length) return null;
    if (matches.length > 1)
        return { answer: 'Which campus do you mean?', sources: [] };
    const { row, campus } = matches[0];
    const data = campuses[campus];
    return {
        answer: row.name + ' is listed at ' + data.label + (describe(row) ? ' in ' + describe(row) : '') + '.'
            + (row.note ? ' ' + row.note : '') + (row.anchor ? ' The map marks the building or section.' : ' Its exact map position is unconfirmed.'),
        navigation: location(row, campus),
        sources: [{ title: data.directorySource }, ...data.sources.map(url => ({ title: url, url }))]
    };
}
function forVenue(venue, campusHint) {
    const key = scope(venue || '') || scope(campusHint || '') ||
        (/^\s*PNR_RM/i.test(venue || '') ? 'pioneer' : /^\s*LH\d/i.test(venue || '') ? 'leopards' : null);
    if (!campuses[key]) return;
    const number = String(venue || '').match(/\broom\s*0*(\d+)\b/i) || String(venue || '').match(/^\s*(?:PNR_RM|LH)0*(\d+)/i);
    if (!number) return;
    const row = search('room ' + Number(number[1]), key, true)[0];
    if (row) return location(row, key);
}
module.exports = { campuses, search, describe, answer, forVenue };
