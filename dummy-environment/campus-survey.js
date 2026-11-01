(() => {
  'use strict';
  const $ = id => document.getElementById(id), core = window.CampusSurvey;
  const key = 'silverest_campus_survey_v1';
  let state;
  try { state = core.restore(localStorage, key); } catch { /* start a new session */ }
  state ||= { session_id: `survey_${Date.now()}`, walkways: [], access_points: [], active: null };
  if (state.active) { $('kind').value = state.active.kind; $('note').value = state.active.note || ''; }
  let watch = null, capture = null, pending = null, context = null, live = null, wakeLock = null;
  const save = () => core.persist(localStorage, key, state);
  const status = s => { $('status').textContent = s; };
  const summary = () => {
    const points = state.active?.points || [], metres = points.slice(1).reduce((n, p, i) => n + core.distance(points[i], p), 0);
    $('counts').textContent = `${points.length} accepted points · ${metres.toFixed(1)} m · ${state.walkways.length} finished paths · ${state.access_points.length} access points`;
    $('saved').textContent = state.active ? `Unfinished path recovered (${state.active.mode}). Resume or cancel it.` : '';
    $('start').disabled = !!state.active; $('pause').disabled = state.active?.mode !== 'recording';
    $('resume').disabled = state.active?.mode !== 'paused'; $('finish').disabled = !state.active;
    $('cancel').disabled = !state.active;
    draw();
  };
  const releaseWake = () => { if (wakeLock) wakeLock.release().catch(() => {}); wakeLock = null;
    if (window.AndroidSurvey) AndroidSurvey.setRecording(false); };
  const stopWatch = () => { if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null; releaseWake(); };
  const startWatch = () => {
    if (!navigator.geolocation) { status('Geolocation unavailable; use a secure browser context.'); return; }
    stopWatch();
    if (window.AndroidSurvey) AndroidSurvey.setRecording(true);
    else if (navigator.wakeLock?.request) navigator.wakeLock.request('screen').then(lock => { wakeLock = lock; })
      .catch(() => status('Recording · keep the screen on; wake lock unavailable'));
    else status('Recording · keep the screen on; wake lock unavailable');
    watch = navigator.geolocation.watchPosition(position => {
      const p = core.sample(position); live = p;
      $('accuracy').textContent = `Accuracy: ±${p.accuracy_m.toFixed(1)} m (${core.quality(p.accuracy_m)})`;
      const active = state.active;
      if (!active || active.mode !== 'recording') return;
      const result = core.accept(p, active.points.at(-1));
      active.raw_samples.push({ ...p, decision: result });
      if (result === 'accepted') active.points.push(p);
      if (result === 'poor_accuracy') status('Recording · poor reading retained only in raw samples');
      save(); summary();
    }, error => status(`GPS error: ${error.message}`), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };
  $('start').onclick = () => { if (state.active) return; state.active = { id: `survey_walkway_${Date.now()}`, kind: $('kind').value,
    note: $('note').value.trim(), surveyed_at: new Date().toISOString(), points: [], raw_samples: [], mode: 'recording' };
    save(); startWatch(); status('Recording walkway'); summary(); };
  $('pause').onclick = () => { stopWatch(); state.active.mode = 'paused'; save(); status('Paused · GPS stopped'); summary(); };
  $('resume').onclick = () => { state.active.mode = 'recording'; save(); startWatch(); status('Recording resumed'); summary(); };
  $('finish').onclick = () => { stopWatch(); const active = state.active; if (!active) return;
    if (active.points.length < 2) { status('At least two accepted points are required. Resume or cancel.'); return; }
    active.kind = $('kind').value; active.note = $('note').value.trim(); delete active.mode;
    state.walkways.push(active); state.active = null; save(); status('Walkway saved locally'); summary(); };
  $('cancel').onclick = () => { if (!state.active || !confirm('Discard this unfinished walkway?')) return;
    stopWatch(); state.active = null; save(); status('Walkway discarded'); summary(); };
  function measure(type) {
    if (!navigator.geolocation) { status('Geolocation unavailable in this browser context'); return; }
    if (capture) return;
    if (!$('place').value) { status('Choose the canonical destination first'); return; }
    const samples = []; capture = { type }; const thisCapture = capture; pending = null; $('saveAccess').disabled = true;
    status(`Measuring ${type}: hold still for five GPS readings`);
    const started = Date.now();
    function next() {
      navigator.geolocation.getCurrentPosition(pos => {
        if (capture !== thisCapture) return;
        const p = core.sample(pos); samples.push(p); live = p;
        $('accuracy').textContent = `Accuracy: ±${p.accuracy_m.toFixed(1)} m (${core.quality(p.accuracy_m)})`;
        $('readings').textContent = `${samples.length}/5 readings · best ±${Math.min(...samples.map(s => s.accuracy_m)).toFixed(1)} m`;
        draw();
        if (samples.length < 5 && Date.now() - started < 30000) setTimeout(next, 1500);
        else complete();
      }, error => { if (capture !== thisCapture) return; capture = null; status(`GPS error: ${error.message}`); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    }
    function complete() {
      const fix = core.representative(samples);
      pending = { type, place_id: $('place').value, entrance_type: $('entrance').value,
        access: $('access').value || null, ...fix, raw_samples: samples };
      capture = null; $('saveAccess').disabled = false;
      status(`Measured ${type}: ${fix.sample_count} readings, best ±${fix.best_accuracy_m.toFixed(1)} m${fix.best_accuracy_m > 15 ? ' · POOR: review before saving' : ''}`);
    }
    next();
  }
  $('markEntrance').onclick = () => measure('entrance'); $('markGate').onclick = () => measure('gate');
  $('saveAccess').onclick = () => { if (!pending) return;
    if (pending.best_accuracy_m > 15 && !confirm('Accuracy is worse than ±15 m. Save for review?')) return;
    const { type, place_id, entrance_type, access, lat, lng, best_accuracy_m, sample_count, timestamp, raw_samples } = pending;
    state.access_points.push({ id: `survey_${type}_${Date.now()}`, place_id, lat, lng,
      entrance: type === 'gate' ? 'gate' : entrance_type.toLowerCase().replace(' entrance', '').replace('main', 'yes'),
      entrance_type: type === 'gate' ? 'gate' : entrance_type, access, accuracy_m: best_accuracy_m,
      sample_count, timestamp, raw_samples, primary: false });
    pending = null; $('saveAccess').disabled = true; save(); status('Access point saved locally'); summary(); };
  $('export').onclick = () => {
    if (state.active) { status('Finish or cancel the active walkway before export'); return; }
    const json = JSON.stringify(core.exportPackage(state), null, 2);
    const countKey = `silverest_export_count_${new Date().toISOString().slice(0,10)}`;
    const count = Number(localStorage.getItem(countKey) || 0) + 1; localStorage.setItem(countKey, String(count));
    const filename = core.exportFilename(new Date(), count);
    if (window.AndroidSurvey) { AndroidSurvey.exportSurvey(filename, json); status('Choose where to save the survey JSON'); return; }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000); status('Survey exported to Downloads');
  };
  $('newSession').onclick = () => { if (state.active) { status('Finish or cancel the active walkway first'); return; }
    if (!confirm('Start a new local session? Export the current session first; this clears its local copy.')) return;
    state = { session_id: `survey_${Date.now()}`, walkways: [], access_points: [], active: null };
    save(); status('New session ready'); summary(); };
  const canvas = $('map');
  function draw() {
    if (!context) return;
    const ratio = devicePixelRatio || 1; canvas.width = canvas.clientWidth * ratio; canvas.height = canvas.clientHeight * ratio;
    const g = canvas.getContext('2d'); g.scale(ratio, ratio); const w = canvas.clientWidth, h = canvas.clientHeight;
    const ring = context.boundary.geometry.coordinates[0]; const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min((w - 28) / (maxX - minX), (h - 28) / (maxY - minY));
    const xy = p => [w / 2 + (p[0] - (minX + maxX) / 2) * scale, h / 2 - (p[1] - (minY + maxY) / 2) * scale];
    const line = (coords, color, width, close = false) => { if (!coords?.length) return; g.beginPath(); coords.forEach((p, i) => { const [x,y] = xy(p); if (!i) g.moveTo(x,y); else g.lineTo(x,y); });
      if (close) g.closePath(); g.strokeStyle = color; g.lineWidth = width; g.stroke(); };
    const dot = (p, color, radius) => { const [x,y] = xy(p); g.beginPath(); g.arc(x,y,radius,0,Math.PI*2); g.fillStyle = color; g.fill(); };
    g.fillStyle = '#f7faf8'; g.fillRect(0,0,w,h); line(ring,'#286a51',3,true);
    for (const b of context.buildings.buildings) { const geom=b.geometry; if(geom?.type==='Polygon') line(geom.coordinates[0],'#9a9a9a',1,true); }
    for (const e of context.graph.edges) { if (e.kind !== 'shared_road') continue;
      const a=context.nodes.get(e.from), b=context.nodes.get(e.to); if(a&&b) line([a,b],'#c89f55',2); }
    for (const p of context.places.places) if(p.coordinates) dot([p.coordinates.lng,p.coordinates.lat],'#5d718c',2);
    for (const path of state.walkways) line(path.points.map(p=>[p.lng,p.lat]),'#075cba',3);
    if(state.active) line(state.active.points.map(p=>[p.lng,p.lat]),'#d75619',3);
    for(const a of state.access_points) dot([a.lng,a.lat],'#8335a0',5);
    if(live) dot([live.lng,live.lat],'#ed1717',6);
  }
  Promise.all(['boundary','buildings','places','routing_graph','place_catalog'].map(async name => {
    const res = await fetch(`/backend/data/campus/campus_${name}.json`); if (!res.ok) throw Error(`${name}: ${res.status}`); return res.json();
  })).then(([boundary,buildings,places,graph,catalog]) => {
    context = {boundary,buildings,places,graph,nodes:new Map(graph.nodes.map(n=>[n.id,n.coordinates]))};
    for(const p of catalog.places) { const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; $('place').append(o); }
    status(state.active ? 'Recovered unfinished walkway · GPS stopped' : 'Ready · GPS stopped'); summary();
  }).catch(e => status(`Map context unavailable: ${e.message}. Recording remains available.`));
  window.CampusSurveyApp = { pauseForBackground() { if (state.active?.mode === 'recording') {
    stopWatch(); state.active.mode = 'paused'; save(); status('Paused when app left foreground'); summary(); }
    capture = null; releaseWake(); } };
  addEventListener('visibilitychange', () => { if (document.hidden) window.CampusSurveyApp.pauseForBackground(); });
  addEventListener('resize',draw); addEventListener('pagehide', () => window.CampusSurveyApp.pauseForBackground()); save(); summary();
})();
