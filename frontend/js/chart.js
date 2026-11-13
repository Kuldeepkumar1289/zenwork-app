
const DaylightChart = (() => {

  const W = 400, H = 150, PAD = 18, BOTTOM = 24;
  const DEFAULT_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

  /** Converts discrete (x, y) coordinates into a smooth Catmull-Rom cubic Bezier SVG path. */
  function smoothPath(pts) {
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C${cp1x} ${cp1y},${cp2x} ${cp2y},${p2.x} ${p2.y}`;
    }
    return d;
  }

  function render(values = [3, 7, 4, 9, 8, 2, 5], labels = DEFAULT_LABELS, hostId = "ridgeChart") {
    const host = document.getElementById(hostId);
    if (!host) return;

    // Unique gradient ID ensures dashboard chart and performance chart never collide
    const gradId = "fill-" + hostId;
    const max = Math.max(...values, 1);
    const step = (W - 2 * PAD) / Math.max(values.length - 1, 1);

    const pts = values.map((v, i) => ({
      x: PAD + i * step,
      y: H - BOTTOM - (v / max) * (H - 50)
    }));

    const line = smoothPath(pts);
    const first = pts[0], last = pts[pts.length - 1];

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--accent)" stop-opacity=".45"/>
            <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${line} L${last.x} ${H - BOTTOM} L${first.x} ${H - BOTTOM} Z" fill="url(#${gradId})"/>
        <path class="ridge-line" d="${line}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
              pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition:stroke-dashoffset 1.4s ease"/>
        ${pts.map((p, i) => `<text x="${p.x}" y="${H - 6}" text-anchor="middle" style="font-size:11px;fill:var(--muted)">${labels[i] || ""}</text>`).join("")}
        <circle class="ridge-dot" r="6" fill="var(--accent)" stroke="var(--bg2)" stroke-width="3" opacity="0"/>
      </svg>
      <div class="ridge-tip"></div>`;

    // Trigger SVG line draw-in animation on next browser paint frame
    const lineEl = host.querySelector(".ridge-line");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      lineEl.style.strokeDashoffset = 0;
    }));

    // Interactive pointer tracking for hover dot & tooltip
    const svg = host.querySelector("svg");
    const dot = host.querySelector(".ridge-dot");
    const tip = host.querySelector(".ridge-tip");

    host.onpointermove = e => {
      const box = svg.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width * W;
      const i = Math.max(0, Math.min(values.length - 1, Math.round((x - PAD) / step)));

      dot.setAttribute("cx", pts[i].x);
      dot.setAttribute("cy", pts[i].y);
      dot.setAttribute("opacity", 1);

      tip.style.left = (pts[i].x / W * box.width) + "px";
      tip.style.top  = (pts[i].y / H * box.height) + "px";
      tip.style.opacity = 1;
      tip.textContent = `${values[i]} tasks`;
    };

    host.onpointerleave = () => {
      tip.style.opacity = 0;
      dot.setAttribute("opacity", 0);
    };
  }

  return { render };
})();