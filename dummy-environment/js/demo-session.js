// Browser appearance context only; backend JWT ownership controls academic access.
(function (root) {
  const SESSION_KEY = "unilusDemoSession";
  const PROGRAMME_KEY = "unilusDemoProgramme";
  const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ").toUpperCase();

  function canonicalProgramme(value) {
    const identity = normalize(value);
    return root.UnilusDemoProgrammes.programmes.find((programme) =>
      normalize(programme.id) === identity || normalize(programme.name) === identity) || null;
  }

  function studentForProgramme(value) {
    const programme = canonicalProgramme(value);
    return programme ? Object.freeze({ id: `demo:${programme.id}`, name: "demo", username: "demo",
      programmeId: programme.id, programme: programme.name, programmeName: programme.name }) : null;
  }

  function authenticate(username, password, programme) {
    return username === "demo" && password === "unilus demo" ? studentForProgramme(programme) : null;
  }

  function login(storage, username, password, programme) {
    const student = authenticate(username, password, programme);
    if (!student) return null;
    storage.setItem(PROGRAMME_KEY, student.programmeId);
    storage.setItem(SESSION_KEY, "authenticated");
    storage.removeItem("unilusDemoStudentId");
    return student;
  }

  // Starts the portal session after the backend has already verified the sign-in.
  function startSession(storage, programme) {
    const student = studentForProgramme(programme);
    if (!student) return null;
    storage.setItem(PROGRAMME_KEY, student.programmeId);
    storage.setItem(SESSION_KEY, "authenticated");
    storage.removeItem("unilusDemoStudentId");
    return student;
  }

  function currentStudent(storage = root.sessionStorage) {
    if (storage?.getItem(SESSION_KEY) === 'authenticated' && storage.getItem('unilusAuthToken')) {
      try { const p=JSON.parse(storage.getItem('unilusDemoAcademicProfile') || 'null');
        if(p?.id&&p.accountUsername&&canonicalProgramme(p.programmeId))return { id:'demo-account:'+p.accountUsername+':'+p.programmeId,name:p.name,username:p.studentNumber,programmeId:p.programmeId,programme:p.programmeName,programmeName:p.programmeName,academicProfileId:p.id };
      } catch { /* Refresh server context before showing academic records. */ }
    }
    return storage?.getItem(SESSION_KEY) === "authenticated"
      ? studentForProgramme(storage.getItem(PROGRAMME_KEY)) : null;
  }

  function logout(storage = root.sessionStorage) {
    storage.removeItem(SESSION_KEY);
    storage.removeItem(PROGRAMME_KEY);
    storage.removeItem("unilusDemoStudentId");
    storage.removeItem("unilusAuthToken");    // backend sign-in token
    storage.removeItem("unilusChatSession");  // start a fresh chat next time
    storage.removeItem('unilusDemoAcademicProfile');
    storage.removeItem('unilusDemoAcademicProfileId');
  }

  const api = { SESSION_KEY, PROGRAMME_KEY, canonicalProgramme, studentForProgramme,
    authenticate, login, startSession, currentStudent, logout };
  root.UnilusDemoSession = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
