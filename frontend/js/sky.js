/* =========================================================
   sky.js — the sun/moon arc + the time-of-day slider
   Public API:  DaylightSky.init()
                DaylightSky.setHour(hour)
                DaylightSky.setMarkers([{ label, hour, done }])
                    -> shows tasks as dots on the arc (06:00–18:00)
   ========================================================= */
const DaylightSky = (() => {

  // Drawing area (matches the viewBox in index.html)
  const WIDTH = 1100, BASELINE = 190, ARC_HEIGHT = 150, MARGIN = 60;

  let hour = 9;
  let markers = [];
  let dragging = false;

  const el = id => document.getElementById(id);

  /** Where the sun (06–18) or moon (18–06) sits for a given hour. */
  function positionAt(h) {
    const isSun = h >= 6 && h <= 18;
    const progress = isSun ? (h - 6) / 12 : (h >= 18 ? h - 18 : h + 6) / 12;
    return {
      x: MARGIN + progress * (WIDTH - 2 * MARGIN),
      y: BASELINE - Math.sin(Math.PI * progress) * ARC_HEIGHT,
      isSun
    };
  }

  /** Draw the static parts: dotted arc, horizon, hour labels, task dots. */
  function draw() {
    let svg = '';

    // dotted arc
    let path = `M${MARGIN} ${BASELINE}`;
    for (let i = 0; i <= 40; i++) {
      const p = positionAt(6 + (i / 40) * 12);
      path += ` L${p.x} ${p.y}`;
    }
    svg += `<path d="${path}" fill="none" stroke="var(--line)" stroke-width="2" stroke-dasharray="3 8" stroke-linecap="round"/>`;
    svg += `<line x1="20" y1="${BASELINE}" x2="${WIDTH - 20}" y2="${BASELINE}" stroke="var(--line)"/>`;

    // hour labels
    [6, 9, 12, 15, 18].forEach(h => {
      const p = positionAt(h);
      svg += `<text x="${p.x}" y="${BASELINE + 20}" text-anchor="middle">${DaylightTheme.formatHour(h).replace(':00', '')}</text>`;
    });

    // task markers
    markers.forEach(m => {
      if (m.hour < 6 || m.hour > 18) return;
      const p = positionAt(m.hour);
      svg += `<circle cx="${p.x}" cy="${p.y}" r="9" fill="${m.done ? 'var(--accent)' : 'var(--sun)'}" stroke="var(--bg2)" stroke-width="3"/>`;
      svg += `<text x="${p.x}" y="${p.y - 16}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${escapeHtml(m.label.slice(0, 18))}</text>`;
    });

    // the draggable sun / moon
    svg += `<g id="skyOrb" style="cursor:grab" tabindex="0" role="slider" aria-label="Time of day">
              <circle id="skyHalo" r="26" opacity=".28"/><circle id="skyBody" r="14"/></g>`;

    el('sky').innerHTML = svg;
    placeOrb();
  }

  function placeOrb() {
    const orb = el('skyOrb');
    if (!orb) return;
    const p = positionAt(hour);
    orb.setAttribute('transform', `translate(${p.x} ${p.y})`);
    const colour = p.isSun ? 'var(--sun)' : '#e8f0ff';
    el('skyBody').setAttribute('fill', colour);
    el('skyHalo').setAttribute('fill', colour);
  }

  function setHour(h) {
    hour = Math.max(0, Math.min(24, h));
    el('timeSlider').value = hour;
    el('timeOutput').textContent = DaylightTheme.formatHour(hour);
    DaylightTheme.apply(hour);
    placeOrb();
  }

  function setMarkers(list) {
    markers = list || [];
    draw();
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function hourFromPointer(event) {
    const box = el('sky').getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * WIDTH;
    const progress = Math.max(0, Math.min(1, (x - MARGIN) / (WIDTH - 2 * MARGIN)));
    return 6 + progress * 12;
  }

  function bindEvents() {
    el('timeSlider').addEventListener('input', e => setHour(+e.target.value));
    el('timeNow').addEventListener('click', () => {
      const d = new Date();
      setHour(d.getHours() + d.getMinutes() / 60);
    });
    el('sky').addEventListener('pointerdown', e => {
      if (e.target.closest('#skyOrb')) { dragging = true; e.preventDefault(); }
    });
    window.addEventListener('pointermove', e => { if (dragging) setHour(hourFromPointer(e)); });
    window.addEventListener('pointerup', () => { dragging = false; });
    el('sky').addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') setHour(hour + 0.25);
      if (e.key === 'ArrowLeft')  setHour(hour - 0.25);
    });
  }

  function init() {
    const d = new Date();
    hour = d.getHours() + d.getMinutes() / 60;   // start at the real time
    draw();
    bindEvents();
    setHour(hour);
  }

  return { init, setHour, setMarkers };
})();