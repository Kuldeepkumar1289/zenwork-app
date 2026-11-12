/* =========================================================
   theme.js — colours that follow the time of day
   Public API:  DaylightTheme.apply(hour)   hour = 0..24 (decimals ok)
                DaylightTheme.formatHour(hour)  ->  "9:30 am"
   ========================================================= */
const DaylightTheme = (() => {

  // Colour stops: the page blends smoothly between neighbouring stops.
  // bg1/bg2 = sky gradient, ink = text, accent = buttons, accentInk = text on buttons
  const STOPS = [
    { hour: 0,    bg1: '#0e1a2b', bg2: '#1d2d4a', ink: '#e8f0ff', accent: '#7fd6b0', accentInk: '#0e1a2b' }, // night
    { hour: 5.5,  bg1: '#f5b49a', bg2: '#f7e3c4', ink: '#2a2a3a', accent: '#c4502f', accentInk: '#ffffff' }, // dawn
    { hour: 8,    bg1: '#bfe3d6', bg2: '#f3efd9', ink: '#10372c', accent: '#1d6b52', accentInk: '#ffffff' }, // day
    { hour: 17,   bg1: '#f2b179', bg2: '#e7c6d9', ink: '#3a1f33', accent: '#a53f4f', accentInk: '#ffffff' }, // dusk
    { hour: 20,   bg1: '#16223a', bg2: '#2c2b52', ink: '#eef0ff', accent: '#8ad7c1', accentInk: '#10202e' }, // evening
    { hour: 24,   bg1: '#0e1a2b', bg2: '#1d2d4a', ink: '#e8f0ff', accent: '#7fd6b0', accentInk: '#0e1a2b' }  // night again
  ];

  /** Blend two hex colours. f = 0 gives a, f = 1 gives b. */
  function mixHex(a, b, f) {
    const x = parseInt(a.slice(1), 16);
    const y = parseInt(b.slice(1), 16);
    let out = '#';
    [16, 8, 0].forEach(shift => {
      const v = Math.round(((x >> shift) & 255) * (1 - f) + ((y >> shift) & 255) * f);
      out += v.toString(16).padStart(2, '0');
    });
    return out;
  }

  /** Find the two stops around `hour` and blend every colour. */
  function colorsAt(hour) {
    let i = 0;
    while (STOPS[i + 1].hour <= hour) i++;
    const from = STOPS[i], to = STOPS[i + 1];
    const f = (hour - from.hour) / (to.hour - from.hour);
    const out = {};
    ['bg1', 'bg2', 'ink', 'accent', 'accentInk'].forEach(key => {
      out[key] = mixHex(from[key], to[key], f);
    });
    return out;
  }

  /** Write the colours into the CSS variables used by daylight.css */
  function apply(hour) {
    const c = colorsAt(hour);
    const isDark = hour < 5.5 || hour >= 19.5;
    const root = document.documentElement.style;
    root.setProperty('--bg1', c.bg1);
    root.setProperty('--bg2', c.bg2);
    root.setProperty('--ink', c.ink);
    root.setProperty('--muted', c.ink + 'b3');
    root.setProperty('--line', c.ink + '33');
    root.setProperty('--accent', c.accent);
    root.setProperty('--accent-ink', c.accentInk);
    root.setProperty('--glass', isDark ? '#ffffff14' : '#ffffff8c');
  }

  function formatHour(hour) {
    let h = Math.floor(hour);
    let m = Math.round((hour - h) * 60);
    if (m === 60) { h++; m = 0; }
    h %= 24;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  }

  return { apply, formatHour };
})();