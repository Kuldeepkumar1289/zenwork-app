

let eventsList = [];
let eventsFilter = "upcoming";

async function renderEventsSection() {
  const data = await fetchOr(API.events, []);
  eventsList = Array.isArray(data) ? data : [];
  drawEvents();
  syncRightRailEvents();
}

function setEventsFilter(key) {
  eventsFilter = key;
  drawEvents();
}

function openEventModal(defaultDateStr = "") {
  const modal = document.getElementById("eventCreateModal");
  if (!modal) return;
  if (defaultDateStr) {
    document.getElementById("evStartInput").value = `${defaultDateStr}T16:00`;
  }
  modal.classList.remove("hidden");
}

function closeEventModal() {
  const modal = document.getElementById("eventCreateModal");
  if (modal) modal.classList.add("hidden");
}

async function submitNewEvent(event) {
  event.preventDefault();
  const payload = {
    title: document.getElementById("evTitleInput").value.trim(),
    event_type: document.getElementById("evTypeInput").value,
    location: document.getElementById("evLocInput").value.trim() || "Workspace Room",
    starts_at: new Date(document.getElementById("evStartInput").value).toISOString(),
    description: document.getElementById("evDescInput").value.trim()
  };

  try {
    await apiRequest(API.events, "POST", payload);
    closeEventModal();
    await renderEventsSection();
    if (document.getElementById("calGridHost")) await renderCalendarSection();
  } catch (err) {
    alert("Could not create event: " + err.message);
  }
}

async function rsvpEvent(id, response) {
  try {
    const updated = await apiRequest(`${API.events}${id}/rsvp`, "POST", { response });
    const idx = eventsList.findIndex(e => e.id === id);
    if (idx !== -1 && updated) eventsList[idx] = updated;
    drawEvents();
    syncRightRailEvents();
  } catch (err) {
    alert("RSVP failed: " + err.message);
  }
}

/** Keeps the right-rail "Your meetings" widget synced with real upcoming events */
function syncRightRailEvents() {
  const host = document.getElementById("upcomingMeetingsList");
  if (!host) return;
  const upcoming = eventsList
    .filter(e => evStart(e) && evStart(e) >= new Date())
    .sort((a, b) => evStart(a) - evStart(b))
    .slice(0, 2);

  if (!upcoming.length) return;
  host.innerHTML = upcoming.map(e => `
    <div class="meeting">
      <span class="chip">${esc(e.event_type || "Upcoming")}</span>
      <b>${esc(e.title)}</b>
      <small>${fmtDate(evStart(e))} • ${fmtTime(evStart(e))} • ${esc(e.location)}</small>
      <button class="btn btn-primary" onclick="switchSection('calendar')">View in Calendar</button>
    </div>
  `).join("");
}

function drawEvents() {
  const now = new Date();
  const shown = eventsList
    .filter(e => {
      const start = evStart(e);
      if (!start) return false;
      return eventsFilter === "upcoming" ? start >= now : start < now;
    })
    .sort((a, b) => evStart(a) - evStart(b));

  const cards = shown.map(e => {
    const start = evStart(e);
    const past = start < now;
    const btn = (key, label) =>
      `<button class="btn ${e.my_response === key ? "btn-primary" : "btn-ghost"}" ${past ? "disabled" : ""} onclick="rsvpEvent(${e.id},'${key}')">${label}</button>`;

    return `
      <article class="card glass event">
        <div class="flex items-start justify-between gap-3">
          <div class="date-badge"><small>${fmtDate(start, { month: "short" })}</small><b>${start.getDate()}</b></div>
          <span class="chip">${esc(e.event_type || "EVENT")}</span>
        </div>
        <div class="event-body">
          <h2>${esc(e.title)}</h2>
          <p class="muted">${fmtTime(start)} • ${esc(e.location || "Workspace Room")}</p>
          ${e.description ? `<p class="muted text-xs mt-1">${esc(e.description)}</p>` : ""}
          <p class="muted mt-1"><b>${esc(e.going ?? 0)}</b> going</p>
        </div>
        <div class="event-actions">${btn("GOING", "Going")}${btn("MAYBE", "Maybe")}${btn("NO", "Can’t")}</div>
      </article>`;
  }).join("");

  setSection(`
    ${pageHead("Events", "Real company socials, demos, and team meetings.",
      `<button class="btn btn-primary" onclick="openEventModal()">+ Create Event</button>`)}

    ${segmented([["upcoming", "Upcoming"], ["past", "Past"]], eventsFilter, "setEventsFilter")}

    <div class="grid-cards">
      ${cards || emptyState("No events scheduled yet. Click '+ Create Event' to add one.")}
    </div>

    <!-- Create Event Modal -->
    <div id="eventCreateModal" class="modal hidden">
      <div class="modal-box">
        <div class="card-head">
          <h2>Schedule Company Event</h2>
          <button class="link push" onclick="closeEventModal()">&times;</button>
        </div>
        <form class="form" onsubmit="submitNewEvent(event)">
          <label>Event title <input id="evTitleInput" required placeholder="e.g. Sprint Demo & Friday Social"></label>
          <div class="form-row">
            <label>Category
              <select id="evTypeInput">
                <option value="MEETING">Meeting</option>
                <option value="SOCIAL">Team Social</option>
                <option value="DEMO">Demo Day</option>
                <option value="REVIEW">Quarterly Review</option>
              </select>
            </label>
            <label>Location / Link <input id="evLocInput" placeholder="e.g. Rooftop Lounge / Meet Link"></label>
          </div>
          <label>Date &amp; time <input id="evStartInput" type="datetime-local" required></label>
          <label>Notes <textarea id="evDescInput" rows="2" placeholder="Agenda or details..."></textarea></label>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" onclick="closeEventModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Publish Event</button>
          </div>
        </form>
      </div>
    </div>
  `);
}

registerSection("events", renderEventsSection);