
let calCursor = new Date();
let calPicked = new Date();
let calEvents = [];

async function renderCalendarSection() {
  const list = await fetchOr(API.events, []);
  calEvents = Array.isArray(list) ? list : [];
  calCursor = new Date();
  calCursor.setDate(1);
  calPicked = new Date();
  drawCalendar();
}

function calShift(delta) {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + delta, 1);
  drawCalendar();
}

function calToday() {
  calCursor = new Date();
  calCursor.setDate(1);
  calPicked = new Date();
  drawCalendar();
}

function calPick(y, m, d) {
  calPicked = new Date(y, m, d);
  drawCalendar();
}

function itemsOn(date) {
  return {
    tasks: allTasks.filter(t => t.due_date && sameDay(new Date(t.due_date), date)),
    events: calEvents.filter(e => evStart(e) && sameDay(evStart(e), date))
  };
}

function toLocalDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function quickAddCalendarEvent(e) {
  e.preventDefault();
  const dateStr = toLocalDateInput(calPicked);
  const timeStr = document.getElementById("calQuickTime").value || "15:00";
  const payload = {
    title: document.getElementById("calQuickTitle").value.trim(),
    location: document.getElementById("calQuickLoc").value.trim() || "Workspace Room",
    event_type: "MEETING",
    starts_at: new Date(`${dateStr}T${timeStr}`).toISOString()
  };

  try {
    await apiRequest(API.events, "POST", payload);
    const list = await fetchOr(API.events, []);
    calEvents = Array.isArray(list) ? list : [];
    drawCalendar();
  } catch (err) {
    alert("Could not schedule event: " + err.message);
  }
}

function drawCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  let cells = "<span></span>".repeat(offset);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const { tasks, events } = itemsOn(date);
    const cls = [
      "cal-cell",
      sameDay(date, new Date()) ? "is-today" : "",
      sameDay(date, calPicked) ? "is-picked" : ""
    ].join(" ");

    cells += `<button class="${cls}" onclick="calPick(${y},${m},${d})">${d}
      <span class="dots">${tasks.length ? "<i></i>" : ""}${events.length ? '<i class="ev"></i>' : ""}</span></button>`;
  }

  const { tasks, events } = itemsOn(calPicked);
  const agenda = (!tasks.length && !events.length)
    ? emptyState("Nothing scheduled for this day.")
    : events.map(e => `
        <div class="agenda-item">
          <i class="ev"></i>
          <div>
            <b>${esc(e.title)}</b>
            <small>${fmtTime(evStart(e))} • ${esc(e.location || "Workspace")} • ${esc(e.going ?? 0)} going</small>
          </div>
        </div>`).join("") +
      tasks.map(t => `
        <div class="agenda-item">
          <i></i>
          <div>
            <b>${esc(t.title)}</b>
            <small>Task deadline • ${esc(t.priority)} • ${esc(t.status.replace("_", " "))}</small>
          </div>
        </div>`).join("");

  setSection(`
    ${pageHead("Calendar", "Real deadlines, meetings, and company events in one place.",
      `<div class="seg"><button onclick="calShift(-1)">←</button><button onclick="calToday()">Today</button><button onclick="calShift(1)">→</button></div>`)}

    <div class="split" id="calGridHost">
      <section class="card glass">
        <div class="card-head">
          <h2>${calCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <span class="muted push"><i class="legend"></i> Task due &nbsp; <i class="legend ev"></i> Event</span>
        </div>
        <div class="cal-full">${["M", "T", "W", "T", "F", "S", "S"].map(d => `<div class="cal-dow">${d}</div>`).join("")}${cells}</div>
      </section>

      <section class="card glass">
        <div class="card-head">
          <h2>${calPicked.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</h2>
          <span class="chip push">${events.length + tasks.length} items</span>
        </div>
        ${agenda}

        <!-- Quick Schedule onto Selected Date -->
        <form class="form mt-4 pt-4 border-t border-[var(--line)]" onsubmit="quickAddCalendarEvent(event)">
          <b class="text-xs uppercase tracking-wider muted">Add event to this day</b>
          <input id="calQuickTitle" required placeholder="Meeting or event title...">
          <div class="form-row">
            <input id="calQuickTime" type="time" value="15:00" required>
            <input id="calQuickLoc" placeholder="Room / Link">
          </div>
          <button class="btn btn-primary">Schedule on ${fmtDate(calPicked)}</button>
        </form>
      </section>
    </div>
  `);
}

registerSection("calendar", renderCalendarSection);