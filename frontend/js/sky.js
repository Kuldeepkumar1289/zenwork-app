/* sky.js — Read-Only 24-Hour Sky Arc & Auto-Moving Sun
   Manual clicking/dragging disabled; driven strictly by live time
    */
window.DaylightSky = (() => {
  const X0 = 70, X1 = 1030, Y_BASE = 186, ARC_H = 148;
  let currentHour = 12;
  let taskMarkers = [];

  function pointAt(hour) {
    const t = Math.max(0, Math.min(24, hour)) / 24;
    const x = X0 + (X1 - X0) * t;
    const y = Y_BASE - Math.sin(t * Math.PI) * ARC_H;
    return { x, y };
  }

  function formatHourLabel(h) {
    if (h === 0 || h === 24) return "12a";
    if (h === 12) return "12p";
    return h < 12 ? `${h}a` : `${h - 12}p`;
  }

  function render(hour = currentHour) {
    currentHour = hour;
    const svg = document.getElementById("sky");
    if (!svg) return;

    const palette = window.DaylightTheme
      ? window.DaylightTheme.getPalette(currentHour)
      : { isNight: false, accent: "#0284C7", sun1: "#FDE047", sun2: "#F59E0B" };

    const isNight = palette.isNight;
    const labelColor = isNight ? "rgba(255,255,255,0.85)" : "#475569";
    const lineColor = isNight ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.14)";
    const dotColor = isNight ? "#93C5FD" : palette.accent;

    let pathD = "";
    for (let i = 0; i <= 48; i++) {
      const p = pointAt((i / 48) * 24);
      pathD += (i === 0 ? `M${p.x} ${p.y}` : ` L${p.x} ${p.y}`);
    }

    const starsHtml = isNight ? `
      <g fill="#FFFFFF" opacity="0.75">
        <circle cx="190" cy="48" r="1.8"/><circle cx="320" cy="32" r="2.2"/>
        <circle cx="460" cy="55" r="1.5"/><circle cx="640" cy="36" r="2"/>
        <circle cx="790" cy="52" r="1.8"/><circle cx="910" cy="38" r="2.2"/>
      </g>` : "";

    const stops = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
    const ticksHtml = stops.map(h => {
      const p = pointAt(h);
      return `
        <g style="pointer-events:none;user-select:none;">
          <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${dotColor}" opacity="0.8"/>
          <line x1="${p.x}" y1="${Y_BASE - 4}" x2="${p.x}" y2="${Y_BASE + 5}" stroke="${lineColor}" stroke-width="1.5"/>
          <text x="${p.x}" y="${Y_BASE + 20}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:${labelColor}">
            ${formatHourLabel(h)}
          </text>
        </g>`;
    }).join("");

    const markersHtml = taskMarkers.map(m => {
      const p = pointAt(m.hour);
      return `
        <g>
          <title>${m.label}</title>
          <circle cx="${p.x}" cy="${p.y}" r="6.5" fill="${m.done ? "#22C55E" : palette.sun2}" stroke="#FFFFFF" stroke-width="2"/>
        </g>`;
    }).join("");

    const orb = pointAt(currentHour);

    svg.style.cursor = "default";
    svg.innerHTML = `
      <defs>
        <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${palette.sun1}" stop-opacity="0.85"/>
          <stop offset="55%" stop-color="${palette.sun2}" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="${palette.sun2}" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="sunOrbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.sun1}"/>
          <stop offset="100%" stop-color="${palette.sun2}"/>
        </linearGradient>
      </defs>

      ${starsHtml}
      <line x1="${X0}" y1="${Y_BASE}" x2="${X1}" y2="${Y_BASE}" stroke="${lineColor}" stroke-width="1.5"/>
      <path d="${pathD}" fill="none" stroke="${dotColor}" stroke-opacity="0.55" stroke-width="2.5" stroke-dasharray="5 6"/>

      ${ticksHtml}
      ${markersHtml}

      <g style="pointer-events:none;">
        <circle cx="${orb.x}" cy="${orb.y}" r="42" fill="url(#sunHalo)"/>
        <circle cx="${orb.x}" cy="${orb.y}" r="14.5" fill="url(#sunOrbGrad)" stroke="#FFFFFF" stroke-width="3"/>
      </g>
    `;
  }

  function setMarkers(list) {
    taskMarkers = Array.isArray(list) ? list : [];
    render(currentHour);
  }

  return { render, setMarkers };
})();