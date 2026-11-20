/* daylight-init.js — Zero-GPS Cached Weather & Clock-Synced Sun/Moon Engine */
document.addEventListener("DOMContentLoaded", () => {
  const WEATHER_CACHE_KEY = "zenwork_weather_cache";
  const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours cache

  function getNowHour() {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  }

  function formatTime12(hourFloat) {
    const totalMins = Math.floor((((hourFloat % 24) + 24) % 24) * 60) % 1440;
    const hh24 = Math.floor(totalMins / 60);
    const mm = String(totalMins % 60).padStart(2, "0");
    const ampm = hh24 >= 12 ? "pm" : "am";
    const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
    return `${hh12}:${mm} ${ampm}`;
  }

  function decodeWeatherCode(code) {
    if (code === 0) return { label: "Clear Sky", isRainy: false, isCloudy: false };
    if (code >= 1 && code <= 3) return { label: "Partly Cloudy", isRainy: false, isCloudy: true };
    if (code >= 45 && code <= 48) return { label: "Misty", isRainy: false, isCloudy: true };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) {
      return { label: "Rainy", isRainy: true, isCloudy: true };
    }
    return { label: "Bright Day", isRainy: false, isCloudy: false };
  }

  function syncDaylight() {
    const nowHour = getNowHour();
    const palette = window.DaylightTheme
      ? window.DaylightTheme.apply(nowHour)
      : { name: "Daylight", cycleLine: "24h Solar & Lunar Sync" };

    if (window.DaylightSky) {
      window.DaylightSky.render(nowHour);
    }

    const cycleEl = document.getElementById("cycleStatusLabel");
    if (cycleEl && palette.cycleLine) {
      cycleEl.textContent = palette.cycleLine;
    }

    const out = document.getElementById("timeOutput");
    if (out) {
      const w = window.DaylightTheme?.getWeather?.();
      const weatherTag = w && w.temp !== null ? ` • ${Math.round(w.temp)}°C ${w.label}` : "";
      out.textContent = `${formatTime12(nowHour)} • ${palette.name}${weatherTag}`;
      out.style.cursor = "default";
    }
  }

  async function fetchWeatherWithoutGPS() {
    try {
      // 1. Use cached weather if fetched within last 2 hours
      const cachedRaw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.savedAt < CACHE_TTL_MS && window.DaylightTheme) {
          window.DaylightTheme.setWeather(cached.weather);
          syncDaylight();
          return;
        }
      }

      // 2. Get approximate city coordinates via IP (no GPS or permission popup needed)
      const locRes = await fetch("https://ipwho.is/");
      const loc = await locRes.json();
      if (!loc || !loc.success) return;

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`
      );
      const data = await weatherRes.json();
      const cw = data?.current_weather;

      if (cw && window.DaylightTheme) {
        const decoded = decodeWeatherCode(cw.weathercode);
        const weatherObj = { ...decoded, temp: cw.temperature };
        localStorage.setItem(
          WEATHER_CACHE_KEY,
          JSON.stringify({ savedAt: Date.now(), weather: weatherObj })
        );
        window.DaylightTheme.setWeather(weatherObj);
        syncDaylight();
      }
    } catch (_) {
      // Silently stay on clock-synced bright theme if offline
    }
  }

  if (window.DaylightChart) {
    window.DaylightChart.render();
  }

  syncDaylight();
  fetchWeatherWithoutGPS();

  // Smooth clock tick every 60s (uses local clock only)
  setInterval(() => {
    if (!document.hidden) syncDaylight();
  }, 60000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncDaylight();
  });
});