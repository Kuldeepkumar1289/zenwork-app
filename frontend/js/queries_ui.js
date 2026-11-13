/* queries_ui.js — Inter-Department Queries (Matched to QueryCreate & QueryResolve)
    */

let queriesList = [];
let queryFilter = "OPEN";

async function renderQueriesSection() {
  const data = await fetchOr(API.queries, []);
  queriesList = Array.isArray(data) ? data : [];
  drawQueries();
}

function setQueryFilter(key) {
  queryFilter = key;
  drawQueries();
}

function formatApiError(err) {
  if (!err) return "Unknown error";
  if (typeof err.message === "string" && err.message !== "[object Object]") return err.message;
  if (Array.isArray(err.detail)) {
    return err.detail.map(d => `${(d.loc || []).slice(-1)[0] || "Field"}: ${d.msg}`).join(", ");
  }
  return JSON.stringify(err.detail || err.message || err);
}

async function submitQuery(event) {
  event.preventDefault();

  const rawTaskId = document.getElementById("qTaskId").value.trim();
  const payload = {
    title: document.getElementById("qTitle").value.trim(),
    description: document.getElementById("qDesc").value.trim(),
    target_department: document.getElementById("qDept").value,
    priority: document.getElementById("qPriority").value,
    task_id: rawTaskId ? parseInt(rawTaskId, 10) : null
  };

  try {
    await apiRequest(API.queries, "POST", payload);
    event.target.reset();
    await renderQueriesSection();
    if (typeof loadOpenQueriesCount === "function") loadOpenQueriesCount();
  } catch (err) {
    alert("Could not raise query: " + formatApiError(err));
  }
}

async function resolveQuery(id) {
  const input = prompt("Enter resolution notes for this query:", "Checked and resolved.");
  if (input === null) return; // User cancelled prompt

  const payload = {
    resolution_notes: input.trim() || "Resolved by team lead.",
    status: "RESOLVED"
  };

  try {
    // Supports both PATCH /queries/{id}/resolve and PATCH /queries/{id}
    try {
      await apiRequest(`${API.queries}${id}/resolve`, "PATCH", payload);
    } catch (routeErr) {
      await apiRequest(`${API.queries}${id}`, "PATCH", payload);
    }
    await renderQueriesSection();
    if (typeof loadOpenQueriesCount === "function") loadOpenQueriesCount();
  } catch (err) {
    alert("Could not update query: " + formatApiError(err));
  }
}

function drawQueries() {
  const canResolve = ["ADMIN", "MANAGER"].includes(currentUser?.role_tier);
  const openCount = queriesList.filter(q => q.status === "OPEN" || q.status === "IN_REVIEW").length;
  const resolvedCount = queriesList.filter(q => q.status === "RESOLVED").length;

  const shown = queriesList.filter(q => {
    if (queryFilter === "ALL") return true;
    if (queryFilter === "OPEN") return q.status === "OPEN" || q.status === "IN_REVIEW";
    return q.status === queryFilter;
  });

  const priorityColors = {
    URGENT: "background:#FEE2E2;color:#B91C1C;",
    HIGH:   "background:#FEF3C7;color:#B45309;",
    MEDIUM: "",
    LOW:    "opacity:0.75;"
  };

  const items = shown.map(q => `
    <article class="q-item">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <b>${esc(q.title)}</b>
          <span class="chip" style="font-size:10px;padding:2px 8px;">${esc(q.target_department || "General")}</span>
          <span class="chip" style="font-size:10px;padding:2px 8px;${priorityColors[q.priority] || ""}">${esc(q.priority || "MEDIUM")}</span>
        </div>
        <p class="muted">${esc(q.description)}</p>
        ${q.resolution_notes ? `<p class="text-xs mt-1" style="color:var(--accent);"><b>Resolution:</b> ${esc(q.resolution_notes)}</p>` : ""}
        <small>${fmtDate(q.created_at)} • Query #${esc(q.id)}${q.task_id ? ` • Task #${esc(q.task_id)}` : ""}</small>
      </div>
      <span class="chip">${esc(q.status || "OPEN")}</span>
      ${canResolve && (q.status === "OPEN" || q.status === "IN_REVIEW")
        ? `<button class="btn btn-ghost" onclick="resolveQuery(${q.id})">Resolve</button>`
        : ""}
    </article>`).join("");

  setSection(`
    ${pageHead("Queries", "Ask once, get clarity. Raise a question for Admin, HR, IT or Engineering.")}

    <div class="kpis">
      ${kpi("Open", openCount, "Awaiting response")}
      ${kpi("Resolved", resolvedCount, "Closed with notes")}
      ${kpi("Total", queriesList.length, "All time")}
    </div>

    <div class="split">
      <section class="card glass">
        <div class="card-head">
          <h2>Queries</h2>
          <span class="push">${segmented([["OPEN", "Open"], ["RESOLVED", "Resolved"], ["ALL", "All"]], queryFilter, "setQueryFilter")}</span>
        </div>
        ${items || emptyState("No queries in this view.")}
      </section>

      <section class="card glass">
        <div class="card-head"><h2>Raise a query</h2></div>
        <form class="form" onsubmit="submitQuery(event)">
          <label>Title
            <input id="qTitle" required placeholder="e.g. Attendance log is missing yesterday's punch-in">
          </label>

          <div class="form-row">
            <label>Target Department
              <select id="qDept" required>
                <option value="HR & Admin">HR &amp; Admin</option>
                <option value="IT Support">IT Support</option>
                <option value="Engineering">Engineering</option>
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
              </select>
            </label>

            <label>Priority
              <select id="qPriority">
                <option value="LOW">Low</option>
                <option value="MEDIUM" selected>Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
          </div>

          <label>Related Task ID <span class="muted text-xs">(optional)</span>
            <input id="qTaskId" type="number" min="1" placeholder="e.g. 4">
          </label>

          <label>Details
            <textarea id="qDesc" rows="3" required placeholder="What happened, and what do you need?"></textarea>
          </label>

          <button type="submit" class="btn btn-primary">Submit query</button>
        </form>
      </section>
    </div>
  `);
}

registerSection("queries", renderQueriesSection);