/* theme.js — Weather + 24-Hour Daylight & Lunar Color Engine (High-Contrast Safe) */
window.DaylightTheme = (() => {
  let activeWeather = { label: "Clear Sky", isRainy: false, isCloudy: false, temp: null };

  const STOPS = [
    {
      hour: 0, name: "Midnight Sapphire", cycleLine: "Night mode • Calm focus hours", isNight: true,
      sky1: "#0F172A", sky2: "#1E3A8A", sky3: "#1E40AF",
      accent: "#2563EB", sun1: "#93C5FD", sun2: "#3B82F6",
      t1Bg: "#DBEAFE", t1Ink: "#1E40AF", t2Bg: "#E0E7FF", t2Ink: "#3730A3", t3Bg: "#FCE7F3", t3Ink: "#BE185D"
    },
    {
      hour: 2, name: "Cosmic Indigo", cycleLine: "Deep night • Quiet lunar arc", isNight: true,
      sky1: "#1E1B4B", sky2: "#312E81", sky3: "#4338CA",
      accent: "#4F46E5", sun1: "#C4B5FD", sun2: "#818CF8",
      t1Bg: "#E0E7FF", t1Ink: "#3730A3", t2Bg: "#EDE9FE", t2Ink: "#5B21B6", t3Bg: "#FFE4E6", t3Ink: "#BE123C"
    },
    {
      hour: 4, name: "Pre-Dawn Twilight", cycleLine: "Early dawn • Preparing for sunrise", isNight: true,
      sky1: "#2E1065", sky2: "#581C87", sky3: "#831843",
      accent: "#A21CAF", sun1: "#F5D0FE", sun2: "#E879F9",
      t1Bg: "#FAE8FF", t1Ink: "#86198F", t2Bg: "#FCE7F3", t2Ink: "#9D174D", t3Bg: "#FFEDD5", t3Ink: "#C2410C"
    },
    {
      hour: 6, name: "Crisp Coral Sunrise", cycleLine: "Morning flow • Sunrise to noon", isNight: false,
      sky1: "#FDBA74", sky2: "#FED7AA", sky3: "#FFFBEB",
      accent: "#D97706", sun1: "#FEF08A", sun2: "#F59E0B",
      t1Bg: "#FEF3C7", t1Ink: "#92400E", t2Bg: "#FFEDD5", t2Ink: "#C2410C", t3Bg: "#FCE7F3", t3Ink: "#9D174D"
    },
    {
      hour: 8, name: "Bright Morning Gold", cycleLine: "Morning flow • Fresh daylight", isNight: false,
      sky1: "#FDE047", sky2: "#FEF08A", sky3: "#FEFCE8",
      accent: "#CA8A04", sun1: "#FEF9C3", sun2: "#EAB308",
      t1Bg: "#FEF9C3", t1Ink: "#854D0E", t2Bg: "#FFEDD5", t2Ink: "#9A3412", t3Bg: "#DCFCE7", t3Ink: "#166534"
    },
    {
      hour: 10, name: "Sunlit Spring Sky", cycleLine: "Mid-morning • Bright clear sky", isNight: false,
      sky1: "#6EE7B7", sky2: "#A7F3D0", sky3: "#ECFDF5",
      accent: "#059669", sun1: "#FDE047", sun2: "#F59E0B",
      t1Bg: "#D1FAE5", t1Ink: "#065F46", t2Bg: "#FEF3C7", t2Ink: "#92400E", t3Bg: "#E0F2FE", t3Ink: "#075985"
    },
    {
      hour: 12, name: "High Noon Crystal", cycleLine: "Peak daylight • Noon sun", isNight: false,
      sky1: "#38BDF8", sky2: "#7DD3FC", sky3: "#F0F9FF",
      accent: "#0284C7", sun1: "#FEF08A", sun2: "#F59E0B",
      t1Bg: "#E0F2FE", t1Ink: "#075985", t2Bg: "#FEF3C7", t2Ink: "#92400E", t3Bg: "#DCFCE7", t3Ink: "#166534"
    },
    {
      hour: 14, name: "Vivid Afternoon Azure", cycleLine: "Peak daylight • Afternoon sprint", isNight: false,
      sky1: "#60A5FA", sky2: "#93C5FD", sky3: "#EFF6FF",
      accent: "#2563EB", sun1: "#FEF08A", sun2: "#F59E0B",
      t1Bg: "#DBEAFE", t1Ink: "#1E40AF", t2Bg: "#FEF3C7", t2Ink: "#92400E", t3Bg: "#E0E7FF", t3Ink: "#3730A3"
    },
    {
      hour: 16, name: "Breezy Cobalt Sky", cycleLine: "Late afternoon • Steady focus", isNight: false,
      sky1: "#93C5FD", sky2: "#BFDBFE", sky3: "#F8FAFC",
      accent: "#1D4ED8", sun1: "#FDE68A", sun2: "#F97316",
      t1Bg: "#DBEAFE", t1Ink: "#1E3A8A", t2Bg: "#FEF3C7", t2Ink: "#92400E", t3Bg: "#FCE7F3", t3Ink: "#9D174D"
    },
    {
      hour: 18, name: "Golden Hour Sunset", cycleLine: "Golden hour • Wrapping up the day", isNight: false,
      sky1: "#FDA4AF", sky2: "#FED7AA", sky3: "#FFF1F2",
      accent: "#E11D48", sun1: "#FDE68A", sun2: "#F43F5E",
      t1Bg: "#FFE4E6", t1Ink: "#9F1239", t2Bg: "#FFEDD5", t2Ink: "#9A3412", t3Bg: "#FAE8FF", t3Ink: "#86198F"
    },
    {
      hour: 20, name: "Electric Dusk Violet", cycleLine: "Evening dusk • Winding down", isNight: true,
      sky1: "#4C1D95", sky2: "#6D28D9", sky3: "#7E22CE",
      accent: "#7C3AED", sun1: "#F5D0FE", sun2: "#C084FC",
      t1Bg: "#F3E8FF", t1Ink: "#6B21A8", t2Bg: "#FCE7F3", t2Ink: "#9D174D", t3Bg: "#E0E7FF", t3Ink: "#3730A3"
    },
    {
      hour: 22, name: "Starlight Night Blue", cycleLine: "Night mode • Calm focus hours", isNight: true,
      sky1: "#172554", sky2: "#1E3A8A", sky3: "#1D4ED8",
      accent: "#1D4ED8", sun1: "#BAE6FD", sun2: "#38BDF8",
      t1Bg: "#DBEAFE", t1Ink: "#1E3A8A", t2Bg: "#E0F2FE", t2Ink: "#075985", t3Bg: "#EDE9FE", t3Ink: "#5B21B6"
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

  function setWeather(weatherObj) {
    if (weatherObj) activeWeather = { ...activeWeather, ...weatherObj };
  }

  function getPalette(hourFloat) {
    const h = ((hourFloat % 24) + 24) % 24;
    const idx = Math.floor(h / 2) % STOPS.length;
    const nextIdx = (idx + 1) % STOPS.length;
    const t = (h - idx * 2) / 2;

    const c = STOPS[idx];
    const n = STOPS[nextIdx];
    const isNight = h >= 19.5 || h < 5.5;

    // Bright Rain / Overcast Daytime Override (keeps UI super crisp & readable)
    if (!isNight && (activeWeather.isRainy || activeWeather.isCloudy)) {
      const isRain = activeWeather.isRainy;
      return {
        name: isRain ? "Rainy Daylight" : "Bright Overcast",
        cycleLine: isRain ? "Rainy breeze • Cozy indoor focus" : "Soft clouds • Balanced daylight",
        isNight: false,
        sky1: isRain ? "#7DD3FC" : "#BAE6FD",
        sky2: isRain ? "#CBD5E1" : "#E2E8F0",
        sky3: "#F8FAFC",
        accent: isRain ? "#0369A1" : "#0284C7",
        accentInk: "#FFFFFF",
        sun1: "#E0F2FE",
        sun2: "#38BDF8",
        t1Bg: "#E0F2FE", t1Ink: "#075985",
        t2Bg: "#F1F5F9", t2Ink: "#334155",
        t3Bg: "#FCE7F3", t3Ink: "#9D174D"
      };
    }

    return {
      name: c.name,
      cycleLine: c.cycleLine,
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

    // Guaranteed high-contrast text & glass tokens so text NEVER disappears
    root.setProperty("--ink", "#0F172A");
    root.setProperty("--muted", "#475569");
    root.setProperty("--line", "rgba(15, 23, 42, 0.12)");
    root.setProperty("--glass", "rgba(255, 255, 255, 0.88)");

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

  return { STOPS, getPalette, setWeather, apply, getWeather: () => activeWeather };
})();