

// 1. Central API endpoint map (change a URL once here if backend routes evolve)
const API = {
  analytics: "/analytics/PerformanceScorecard",
  orgTree:   "/users/org-tree",
  queries:   "/queries/",
  notices:   "/communications/",
  events:    "/events/"
};

// 2. Section Registry: maps sidebar tab names (e.g. "queries") -> render functions
const SECTION_RENDERERS = {};
function registerSection(name, renderFn) {
  SECTION_RENDERERS[name] = renderFn;
}

// 3. Security & Formatting Helpers
/** Escapes HTML special characters to prevent Cross-Site Scripting (XSS). */
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Extracts up to 2 uppercase initials from a full name (e.g., "Kuldeep Kumar" -> "KK"). */
function initials(name) {
  return String(name || "?").trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(value, opts = { month: "short", day: "numeric" }) {
  return value ? new Date(value).toLocaleDateString("en-US", opts) : "—";
}

function fmtTime(value) {
  return value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

function sameDay(a, b) {
  return a && b && a.toDateString() === b.toDateString();
}

/** Returns an ISO timestamp `n` days from today at `hour`:00 (used for sample events). */
function inDays(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Normalizes different possible event start field names from FastAPI. */
function evStart(e) {
  const v = e?.starts_at || e?.start_time || e?.date;
  return v ? new Date(v) : null;
}

/** Fault-tolerant API wrapper: returns `fallback` instead of crashing if an endpoint isn't built yet. */
async function fetchOr(endpoint, fallback) {
  try {
    return (await apiRequest(endpoint)) ?? fallback;
  } catch (err) {
    return fallback;
  }
}

/** Recursive helper to flatten a nested manager->subordinates tree into a 1D array. */
window.flattenOrgTree = window.flattenOrgTree || function(nodes, out = []) {
  for (const node of nodes || []) {
    out.push(node);
    if (Array.isArray(node.subordinates) && node.subordinates.length) {
      window.flattenOrgTree(node.subordinates, out);
    }
  }
  return out;
};

// 4. Reusable HTML Component Builders
function pageHead(title, subtitle, actionHtml = "") {
  return `
    <div class="page-head">
      <div>
        <h1>${esc(title)}</h1>
        <p class="muted">${esc(subtitle)}</p>
      </div>
      ${actionHtml}
    </div>`;
}

function kpi(label, value, note = "") {
  return `
    <article class="kpi glass">
      <span>${esc(label)}</span>
      <b>${esc(value)}</b>
      <small>${esc(note)}</small>
    </article>`;
}

function emptyState(text) {
  return `<div class="empty-state">${esc(text)}</div>`;
}

function segmented(items, active, onclickFn) {
  return `
    <div class="seg">
      ${items.map(([key, label]) =>
        `<button type="button" class="${key === active ? "on" : ""}" onclick="${onclickFn}('${key}')">${esc(label)}</button>`
      ).join("")}
    </div>`;
}

function setSection(html) {
  const host = document.getElementById("section-dynamic");
  if (host) host.innerHTML = html;
}