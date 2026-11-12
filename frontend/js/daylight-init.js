/* =========================================================
   daylight-init.js — starts the visual modules once the page is ready
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  DaylightSky.init();      // sun arc + time-of-day theme
  DaylightChart.render();  // weekly ridge chart (demo data until your API sends real numbers)
});