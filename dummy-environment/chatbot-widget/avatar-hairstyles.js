// Fit each transparent hairstyle around the same 78px sphere. Replaced assets
// retain backups under hairstyles/originals and use explicit cache revisions.
(function (root) {
  const HAIRSTYLES = Object.freeze([
    { id: 'curly-bob', label: 'Curly Bob', category: 'female', width: 130, top: 12, offset: 0, opening: { rx: 35, ry: 35 } },
    { id: 'straight-bob', label: 'Straight Bob', category: 'female', width: 122, top: 21, offset: 0, opening: { rx: 35, ry: 35 } },
    { id: 'ponytail', label: 'Ponytail', category: 'female', width: 145, top: 7, offset: -20, opening: { rx: 34, ry: 35 } },
    { id: 'bun', label: 'Braided Bun', category: 'female', width: 140, top: 3, offset: -15, opening: { rx: 35, ry: 35 } },
    { id: 'low-afro', label: 'Low Afro', category: 'male', width: 122, top: -1, offset: 0, opening: { rx: 36, ry: 36 } },
    { id: 'twists', label: 'Twists', category: 'male', width: 125, top: 7, offset: 0, opening: { rx: 35, ry: 35 } },
    { id: 'short-fade', label: 'Short Fade', category: 'male', width: 80, top: 24, offset: 0, version: 'fade-refit-20261022', opening: { rx: 34, ry: 30 } },
    { id: 'cornrows', label: 'Cornrows', category: 'male', width: 82.2, top: 40.7, offset: 0, capTop: -12, version: 'halo-20261025', opening: { rx: 34, ry: 30 } },
    { id: 'long-braids', label: 'Long Braids', category: 'unisex', width: 130, top: 34, offset: 0, capTop: -6, opening: { rx: 36, ry: 36 } },
    { id: 'locs', label: 'Locs', category: 'unisex', width: 145, top: 23, offset: 0, opening: { rx: 35, ry: 35 } }
  ].map((style) => Object.freeze({ ...style, opening: Object.freeze(style.opening), src: `chatbot-widget/hairstyles/${style.id}.png${style.version ? `?v=${style.version}` : ''}` })));
  const CATEGORIES = Object.freeze([
    Object.freeze({ id: 'female', label: 'Female' }),
    Object.freeze({ id: 'male', label: 'Male' }),
    Object.freeze({ id: 'unisex', label: 'Unisex' })
  ]);
  const get = (id) => HAIRSTYLES.find((style) => style.id === id) || null;
  const restore = (student, saved) => student?.id && get(saved) ? saved : null;
  const api = { HAIRSTYLES, CATEGORIES, get, restore };
  root.UnilusHairstyles = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
