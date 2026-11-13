/* daylight-init.js — Automatic Clock-Synced Sun & Theme Engine
   No manual overrides; updates automatically with system time
    */
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

  function syncDaylight() {
    const nowHour = getNowHour();

    const palette = window.DaylightTheme
      ? window.DaylightTheme.apply(nowHour)
      : { name: "Daylight" };

    if (window.DaylightSky) {
      window.DaylightSky.render(nowHour);
    }

    const out = document.getElementById("timeOutput");
    if (out) {
      out.textContent = `Real-time: ${formatTime12(nowHour)} • ${palette.name}`;
      out.style.cursor = "default";
      out.title = "Automatically synced with live clock";
    }
  }

  if (window.DaylightChart) {
    window.DaylightChart.render();
  }

  // Initial sync + automatic update every 60s when tab is active
  syncDaylight();
  setInterval(() => {
    if (!document.hidden) syncDaylight();
  }, 60000);

  // Instant sync when returning to the browser tab
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncDaylight();
  });
});