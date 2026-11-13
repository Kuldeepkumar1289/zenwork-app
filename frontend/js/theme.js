/* theme.js — 12-Stop Pure Day-to-Night Color Engine (Unified Hue Sync)
   Eliminates opposite-hue splits & syncs all status badges
    */
window.DaylightTheme = (() => {
  const STOPS = [
    {
      hour: 0, name: "Midnight Sapphire", isNight: true,
      sky1: "#0F172A", sky2: "#1E3A8A", sky3: "#1E40AF",
      accent: "#2563EB", sun1: "#93C5FD", sun2: "#3B82F6",
      t1Bg: "#DBEAFE", t1Ink: "#1E40AF",
      t2Bg: "#E0E7FF", t2Ink: "#3730A3",
      t3Bg: "#FCE7F3", t3Ink: "#BE185D"
    },
    {
      hour: 2, name: "Cosmic Indigo", isNight: true,
      sky1: "#1E1B4B", sky2: "#312E81", sky3: "#4338CA",
      accent: "#4F46E5", sun1: "#C4B5FD", sun2: "#818CF8",
      t1Bg: "#E0E7FF", t1Ink: "#3730A3",
      t2Bg: "#EDE9FE", t2Ink: "#5B21B6",
      t3Bg: "#FFE4E6", t3Ink: "#BE123C"
    },
    {
      hour: 4, name: "Pre-Dawn Twilight", isNight: true,
      sky1: "#2E1065", sky2: "#701A75", sky3: "#9D174D",
      accent: "#C026D3", sun1: "#F5D0FE", sun2: "#E879F9",
      t1Bg: "#FAE8FF", t1Ink: "#86198F",
      t2Bg: "#FCE7F3", t2Ink: "#9D174D",
      t3Bg: "#FFEDD5", t3Ink: "#C2410C"
    },
    {
      hour: 6, name: "Crisp Coral Sunrise", isNight: false,
      sky1: "#FF8A65", sky2: "#FFAB91", sky3: "#FFF3E0",
      accent: "#E65100", sun1: "#FFE082", sun2: "#FF6D00",
      t1Bg: "#FFE0B2", t1Ink: "#BF360C",
      t2Bg: "#FFF9C4", t2Ink: "#F57F17",
      t3Bg: "#FCE4EC", t3Ink: "#AD1457"
    },
    {
      hour: 8, name: "Bright Morning Gold", isNight: false,
      sky1: "#FFD54F", sky2: "#FFE082", sky3: "#FFFDE7",
      accent: "#D97706", sun1: "#FFF176", sun2: "#F59E0B",
      t1Bg: "#FEF3C7", t1Ink: "#92400E",
      t2Bg: "#FFEDD5", t2Ink: "#C2410C",
      t3Bg: "#DCFCE7", t3Ink: "#166534"
    },
    {
      hour: 10, name: "Sunlit Spring Sky", isNight: false,
      sky1: "#34D399", sky2: "#6EE7B7", sky3: "#ECFDF5",
      accent: "#059669", sun1: "#FDE047", sun2: "#F59E0B",
      t1Bg: "#D1FAE5", t1Ink: "#065F46",
      t2Bg: "#FEF3C7", t2Ink: "#B45309",
      t3Bg: "#E0F2FE", t3Ink: "#0369A1"
    },
    {
      hour: 12, name: "High Noon Crystal", isNight: false,
      sky1: "#38BDF8", sky2: "#7DD3FC", sky3: "#F0F9FF",
      accent: "#0284C7", sun1: "#FDE047", sun2: "#F59E0B",
      t1Bg: "#E0F2FE", t1Ink: "#075985",
      t2Bg: "#FEF3C7", t2Ink: "#B45309",
      t3Bg: "#DCFCE7", t3Ink: "#166534"
    },
    {
      hour: 14, name: "Vivid Afternoon Azure", isNight: false,
      sky1: "#60A5FA", sky2: "#93C5FD", sky3: "#EFF6FF",
      accent: "#2563EB", sun1: "#FDE047", sun2: "#F59E0B",
      t1Bg: "#DBEAFE", t1Ink: "#1E40AF",
      t2Bg: "#FEF3C7", t2Ink: "#B45309",
      t3Bg: "#E0E7FF", t3Ink: "#3730A3"
    },
    {
      hour: 16, name: "Breezy Cobalt Sky", isNight: false,
      sky1: "#818CF8", sky2: "#A5B4FC", sky3: "#EEF2FF",
      accent: "#4F46E5", sun1: "#FCD34D", sun2: "#F97316",
      t1Bg: "#E0E7FF", t1Ink: "#3730A3",
      t2Bg: "#FEF3C7", t2Ink: "#B45309",
      t3Bg: "#FCE7F3", t3Ink: "#BE185D"
    },
    {
      hour: 18, name: "Fiery Sunset Crimson", isNight: false,
      sky1: "#FB7185", sky2: "#FDBA74", sky3: "#FFF1F2",
      accent: "#E11D48", sun1: "#FDBA74", sun2: "#E11D48",
      t1Bg: "#FFE4E6", t1Ink: "#9F1239",
      t2Bg: "#FFEDD5", t2Ink: "#C2410C",
      t3Bg: "#FAE8FF", t3Ink: "#86198F"
    },
    {
      hour: 20, name: "Electric Dusk Violet", isNight: true,
      sky1: "#4C1D95", sky2: "#831843", sky3: "#9D174D",
      accent: "#9333EA", sun1: "#F472B6", sun2: "#C084FC",
      t1Bg: "#F3E8FF", t1Ink: "#6B21A8",
      t2Bg: "#FCE7F3", t2Ink: "#9D174D",
      t3Bg: "#E0E7FF", t3Ink: "#3730A3"
    },
    {
      hour: 22, name: "Starlight Night Blue", isNight: true,
      sky1: "#172554", sky2: "#1E3A8A", sky3: "#1D4ED8",
      accent: "#1D4ED8", sun1: "#7DD3FC", sun2: "#38BDF8",
      t1Bg: "#DBEAFE", t1Ink: "#1E3A8A",
      t2Bg: "#E0F2FE", t2Ink: "#075985",
      t3Bg: "#EDE9FE", t3Ink: "#5B21B6"
    }
  ];

  function hexToHsl(hex) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function mixHsl(c1, c2, t) {
    const [h1, s1, l1] = hexToHsl(c1);
    const [h2, s2, l2] = hexToHsl(c2);
    let dh = h2 - h1;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = (h1 + dh * t + 360) % 360;
    const s = s1 + (s2 - s1) * t;
    const l = l1 + (l2 - l1) * t;
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }

  function getPalette(hourFloat) {
    const h = ((hourFloat % 24) + 24) % 24;
    const idx = Math.floor(h / 2) % STOPS.length;
    const nextIdx = (idx + 1) % STOPS.length;
    const t = (h - idx * 2) / 2;

    const c = STOPS[idx];
    const n = STOPS[nextIdx];
    const isNight = h >= 19.5 || h < 5.5;

    return {
      name: c.name,
      isNight,
      sky1: mixHsl(c.sky1, n.sky1, t),
      sky2: mixHsl(c.sky2, n.sky2, t),
      sky3: mixHsl(c.sky3, n.sky3, t),
      accent: mixHsl(c.accent, n.accent, t),
      accentInk: "#FFFFFF",
      sun1: mixHsl(c.sun1, n.sun1, t),
      sun2: mixHsl(c.sun2, n.sun2, t),
      t1Bg: mixHsl(c.t1Bg, n.t1Bg, t),
      t1Ink: mixHsl(c.t1Ink, n.t1Ink, t),
      t2Bg: mixHsl(c.t2Bg, n.t2Bg, t),
      t2Ink: mixHsl(c.t2Ink, n.t2Ink, t),
      t3Bg: mixHsl(c.t3Bg, n.t3Bg, t),
      t3Ink: mixHsl(c.t3Ink, n.t3Ink, t)
    };
  }

  function apply(hourFloat) {
    const p = getPalette(hourFloat);
    const root = document.documentElement.style;

    root.setProperty("--bg1", p.sky1);
    root.setProperty("--bg2", p.sky3);
    root.setProperty("--sky-top", p.sky1);
    root.setProperty("--sky-bot", p.sky3);
    root.setProperty("--accent", p.accent);
    root.setProperty("--accent-ink", p.accentInk);
    root.setProperty("--sun", p.sun2);

    root.setProperty("--tone-1-bg", p.t1Bg);
    root.setProperty("--tone-1-ink", p.t1Ink);
    root.setProperty("--tone-2-bg", p.t2Bg);
    root.setProperty("--tone-2-ink", p.t2Ink);
    root.setProperty("--tone-3-bg", p.t3Bg);
    root.setProperty("--tone-3-ink", p.t3Ink);

    document.body.classList.toggle("is-night", p.isNight);

    if (p.isNight) {
      document.body.style.background = `
        radial-gradient(ellipse 100% 390px at 50% 0%, ${p.sky1} 0%, ${p.sky2} 55%, transparent 92%),
        linear-gradient(180deg, ${p.sky1} 0%, ${p.sky2} 340px, #EEF2FF 520px, #F8FAFC 100%)
      `;
    } else {
      document.body.style.background = `
        radial-gradient(ellipse 105% 380px at 50% 0%, ${p.sky1} 0%, transparent 78%),
        linear-gradient(160deg, ${p.sky1} 0%, ${p.sky2} 30%, ${p.sky3} 65%, #F8FAFC 100%)
      `;
    }

    return p;
  }

  return { STOPS, getPalette, apply };
})();