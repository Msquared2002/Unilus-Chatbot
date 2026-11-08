// Keep the dummy portal adapter separate from programme rules so a later
// institutional identity provider can replace it.
(function (root) {

  const GENERAL_STUDENT_OUTFITS = Object.freeze([
    "spirit-tee", "spirit-hoodie", "green-polo", "navy-varsity-tee",
    "white-varsity-tee", "gray-spirit-hoodie", "black-spirit-hoodie",
    "maroon-spirit-hoodie"
  ]);

  const PROGRAMME_AVATAR_CONFIG = Object.freeze({
    IT: { outfits: ["tech-hoodie", "tech-circuit"], accessories: ["laptop"] },
    Medicine: { outfits: ["health-scrub", "health-coat"], accessories: [] },
    Nursing: { outfits: ["white-nursing-uniform", "striped-nursing-uniform"], accessories: [] },
    Business: { outfits: ["business"], accessories: [] },
    Law: { outfits: ["law-wig"], accessories: [] }
  });

  // Explicit canonical IDs from the ingested 2026 prospectus catalogue.
  const AVATAR_PROGRAMME_GROUPS = Object.freeze({
    IT: [
      "bachelor-of-science-in-computer-science", "bachelor-of-science-in-cyber-security",
      "bachelor-of-science-in-information-systems-and-technology",
      "master-of-science-in-computer-science", "master-of-science-in-cyber-security",
      "master-of-science-in-data-science", "master-of-science-in-information-technology",
      "doctor-of-philosophy-in-computer-science", "doctor-of-philosophy-in-cyber-security",
      "doctor-of-philosophy-in-data-science", "doctor-of-philosophy-in-information-technology"
    ],
    Medicine: ["bachelor-of-medicine-and-bachelor-surgery"],
    Nursing: ["bachelor-of-science-in-nursing", "diploma-in-nursing-sciences"],
    Business: [
      "bachelor-of-business-administration", "master-of-business-administration",
      "master-of-business-administration-finance", "master-of-business-administration-in-health-care-management",
      "executive-master-of-business-administration-in-leadership-and-wealth-creation",
      "doctor-of-business-administration", "doctor-of-philosophy-phd-in-business-administration"
    ],
    Law: [
      "bachelor-of-laws", "doctor-of-philosophy-in-law",
      "master-of-law-in-environmental-laws", "master-of-law-in-general-laws",
      "master-of-law-in-human-rights-laws", "master-of-laws-in-banking-and-finance-law",
      "master-of-laws-in-commercial-corporate-law", "master-of-laws-in-competition-law",
      "master-of-laws-in-constitutional-and-administrative-law", "master-of-laws-in-criminal-litigation",
      "master-of-laws-in-intellectual-property-law", "master-of-laws-in-international-trade-and-investment-law",
      "master-of-laws-in-labour-law", "master-of-laws-in-mineral-resources-extraction-and-law",
      "master-of-laws-in-public-international-law", "master-of-laws-in-tax-law"
    ]
  });

  function getCurrentStudent(storage = root.sessionStorage) {
    return root.UnilusDemoSession.currentStudent(storage);
  }

  function resolveProgramme(student) {
    if (!student) return null;
    const identities = [student.programmeId, student.programmeName, student.programme]
      .filter(Boolean).map((value) => root.UnilusDemoSession.canonicalProgramme(value)).filter(Boolean);
    const canonicalIds = new Set(identities.map((programme) => programme.id));
    if (canonicalIds.size !== 1) return null;
    const matches = Object.entries(AVATAR_PROGRAMME_GROUPS)
      .filter(([, ids]) => ids.some((id) => canonicalIds.has(id)))
      .map(([group]) => group);
    return matches.length === 1 ? matches[0] : null;
  }

  function resolveEntitlements(student) {
    if (!student?.id) return { student: null, programme: null, outfits: [], accessories: [] };
    const programme = resolveProgramme(student);
    const config = PROGRAMME_AVATAR_CONFIG[programme] || { outfits: [], accessories: [] };
    return {
      student,
      programme,
      outfits: ["default", ...GENERAL_STUDENT_OUTFITS, ...config.outfits],
      accessories: [...config.accessories]
    };
  }

  // The same visible demo account has independent preferences per programme.
  function preferenceKey(base, student) {
    return `${base}:${student.id}`;
  }

  function resolveAppearance(entitlements, saved = {}) {
    if (!entitlements.student) {
      return { outfit: "default", glasses: null, laptop: false, laptopPreference: null };
    }
    const initial = entitlements.student.academicProfileId ? ({ IT:'tech-hoodie', Nursing:'white-nursing-uniform', Medicine:'health-scrub', Business:'business', Law:'law-wig' }[entitlements.programme] || 'default') : 'default';
    const outfit = saved.outfit == null ? initial : entitlements.outfits.includes(saved.outfit) ? saved.outfit : "default";
    const glasses = ["round-gold", "square-black", "cateye-black", "none"].includes(saved.glasses)
      ? (saved.glasses === "none" ? null : saved.glasses) : null;
    const hasLaptop = entitlements.accessories.includes("laptop");
    const laptopPreference = hasLaptop && saved.laptop === "true" ? true
      : hasLaptop && saved.laptop === "false" ? false : null;
    const laptop = hasLaptop && (laptopPreference ?? ["tech-hoodie", "tech-circuit"].includes(outfit));
    return { outfit, glasses, laptop, laptopPreference };
  }

  const api = { getCurrentStudent, resolveProgramme, resolveEntitlements,
    preferenceKey, resolveAppearance, GENERAL_STUDENT_OUTFITS, PROGRAMME_AVATAR_CONFIG, AVATAR_PROGRAMME_GROUPS };
  root.UnilusAvatarEntitlements = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
