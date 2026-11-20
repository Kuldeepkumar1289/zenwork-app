/* daylight-init.js — Automatic Weather & Clock-Synced Sun/Moon Engine */
document.addEventListener("DOMContentLoaded", () => {
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

  function fetchLocalWeather() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
          );
          const data = await res.json();
          const cw = data?.current_weather;
          if (cw && window.DaylightTheme) {
            const decoded = decodeWeatherCode(cw.weathercode);
            window.DaylightTheme.setWeather({ ...decoded, temp: cw.temperature });
            syncDaylight();
          }
        } catch (_) {}
      },
      () => {},
      { timeout: 4000 }
    );
  }

  if (window.DaylightChart) {
    window.DaylightChart.render();
  }

  syncDaylight();
  fetchLocalWeather();

  setInterval(() => {
    if (!document.hidden) syncDaylight();
  }, 60000);

  setInterval(() => {
    if (!document.hidden) fetchLocalWeather();
  }, 15 * 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncDaylight();
  });
});