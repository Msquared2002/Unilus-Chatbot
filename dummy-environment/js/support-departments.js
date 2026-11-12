// Shared configured Support Centre directory; no private contacts.
(function(root){
const departments = [
  { id: "registry", name: "Registry", category: "General", keywords: [] },
  { id: "academic-office", name: "Academic Office", category: "Academic", keywords: ["timetable", "exam", "examination", "results", "registration", "course", "semester", "module", "transcript", "academic"] },
  { id: "finance", name: "Finance Office", category: "Finance", keywords: ["fees", "fee", "payment", "receipt", "invoice", "balance", "tuition", "clearance", "account"] },
  { id: "ict", name: "ICT Support", category: "ICT", keywords: ["password", "login", "portal", "lms", "website", "error", "technical", "account access"] },
  { id: "admissions", name: "Admissions Office", category: "Admissions", keywords: ["application", "admission", "acceptance", "requirements", "intake", "offer letter"] },
  { id: "student-affairs", name: "Student Affairs", category: "Student Affairs", keywords: ["accommodation", "hostel", "welfare", "clubs", "student life"] },
  { id: "library", name: "Library", category: "Library", keywords: ["book", "borrowing", "library", "journal", "resource"] },
];

function classifyDepartment(text) {
  const normalizedText = String(text || "").toLowerCase();
  const keywordPattern = (keyword) => {
    if (keyword === "registration") return /\b(registration|register(?:ed|ing|s)?)\b/i;
    const expression = keyword.replaceAll(" ", "\\s+");
    const plural = ["course", "fee", "exam", "book"].includes(keyword) ? "s?" : "";
    return new RegExp(`\\b${expression}${plural}\\b`, "i");
  };
  const matches = departments.map((department) => ({
    department,
    matchedKeywords: [...new Map(department.keywords.filter((keyword) => keywordPattern(keyword).test(normalizedText)).map(k=>[k==='fees'?'fee':k,k])).values()],
  })).filter((item) => item.matchedKeywords.length > 0).sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length);
  const best = matches[0];
  if (!best) return { departmentId: null, department: null, departmentName: null, category: null, confidence: "unclassified", matchedKeywords: [] };
  const confidence = matches[1]?.matchedKeywords.length===best.matchedKeywords.length?"ambiguous":best.matchedKeywords.length > 1 ? "high" : "medium";
  return { departmentId: best.department.id, department: best.department.id, departmentName: best.department.name, category: best.department.category, confidence, matchedKeywords: best.matchedKeywords };
}


const aliases={'accounts':'finance','accounts office':'finance','finance':'finance','registrar':'registry','it':'ict','it support':'ict','university of lusaka':'registry','admissions':'admissions'};
function normalize(value){const v=String(value||'').trim().toLowerCase();return departments.find(d=>d.id===v||d.name.toLowerCase()===v||d.id===aliases[v])||null;}
function resolve(text,explicit){if(explicit){const d=normalize(explicit);if(!d)throw Object.assign(Error('Unknown configured department'),{status:400});return {...d,reason:'Validated configured department'};}const c=classifyDepartment(text);if(!c.departmentId)return {...departments[0],reason:'No unambiguous configured rule matched; Registry triage'};if(c.confidence==='ambiguous')return {...departments[0],reason:'Ambiguous matching departments; Registry triage'};return {...normalize(c.departmentId),reason:'Matched configured keywords: '+c.matchedKeywords.join(', ')};}
const api={departments,classifyDepartment,normalize,resolve};if(typeof module!=='undefined')module.exports=api;root.UnilusSupportDirectory=api;
})(typeof globalThis!=='undefined'?globalThis:this);
