// 1. Central API endpoint map
const API = {
  analytics: "/analytics/scorecard",
  orgTree:   "/users/org-tree",
  queries:   "/queries/",
  notices:   "/communications/",
  events:    "/events/"
};

// 2. Section Registry: maps sidebar tab names -> render functions
const SECTION_RENDERERS = {};
function registerSection(name, renderFn) {
  SECTION_RENDERERS[name] = renderFn;
}

// 3. Security & Formatting Helpers
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

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

function inDays(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function evStart(e) {
  const v = e?.starts_at || e?.start_time || e?.date;
  return v ? new Date(v) : null;
}

async function fetchOr(endpoint, fallback) {
  try {
    return (await apiRequest(endpoint)) ?? fallback;
  } catch (err) {
    return fallback;
  }
}

window.flattenOrgTree = window.flattenOrgTree || function(nodes, out = []) {
  for (const node of nodes || []) {
    out.push(node);
    if (Array.isArray(node.subordinates) && node.subordinates.length) {
      window.flattenOrgTree(node.subordinates, out);
    }
  }
  return out;
};

// 4. Shared Live Teammate Status & Custom Employee ID Helper
window.LivePresence = (() => {
  let usersById = {};
  let statusById = {};
  let lastLoadedAt = 0;

  async function refresh(force = false) {
    if (!force && Date.now() - lastLoadedAt < 15000 && Object.keys(usersById).length) {
      return { usersById, statusById };
    }
    const [tree, statuses] = await Promise.all([
      fetchOr(API.orgTree, []),
      fetchOr("/attendance/team/live-status", {})
    ]);
    const list = window.flattenOrgTree(Array.isArray(tree) ? tree : []);
    const nextUsers = {};
    for (const u of list) nextUsers[String(u.id)] = u;
    usersById = nextUsers;
    statusById = statuses || {};

    if (typeof currentUser !== "undefined" && currentUser && typeof todayAttendance !== "undefined" && todayAttendance) {
      const uid = String(currentUser.id);
      if (todayAttendance.punch_in && !todayAttendance.punch_out) {
        statusById[uid] = {
          ...(statusById[uid] || {}),
          state: "CHECKED_IN",
          label: "Checked in",
          punch_in: todayAttendance.punch_in
        };
      } else if (todayAttendance.punch_out) {
        statusById[uid] = {
          ...(statusById[uid] || {}),
          state: "CHECKED_OUT",
          label: `Checked out (${todayAttendance.total_hours || 0}h)`,
          punch_in: todayAttendance.punch_in
        };
      }
    }
    lastLoadedAt = Date.now();
    return { usersById, statusById };
  }

  function getUser(userId) {
    return usersById[String(userId)] || null;
  }

  function formatId(personOrId) {
    if (!personOrId) return "";
    if (typeof personOrId === "object") {
      return personOrId.employee_code ? String(personOrId.employee_code) : `#${personOrId.id}`;
    }
    const u = getUser(personOrId);
    return u?.employee_code ? String(u.employee_code) : `#${personOrId}`;
  }

  function formatNameWithId(personOrId, fallbackPrefix = "User") {
    if (!personOrId) return "Unassigned";
    const u = typeof personOrId === "object" ? personOrId : getUser(personOrId);
    if (!u) return `${fallbackPrefix} #${personOrId}`;
    const code = u.employee_code ? ` (${u.employee_code})` : ` (#${u.id})`;
    return `${u.full_name}${code}`;
  }

  function getStatus(userId) {
    return statusById[String(userId)] || { state: "NOT_CHECKED_IN", label: "Not checked in" };
  }

  function badgeHtml(userId, compact = false) {
    const st = getStatus(userId);
    const styles = {
      CHECKED_IN:     "background:#DCFCE7;color:#166534;border:1px solid #86EFAC;",
      CHECKED_OUT:    "background:#E0F2FE;color:#075985;border:1px solid #7DD3FC;",
      WFH:            "background:#F3E8FF;color:#6B21A8;border:1px solid #D8B4FE;",
      ON_LEAVE:       "background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;",
      NOT_CHECKED_IN: "background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;"
    };
    const dots = {
      CHECKED_IN: "#16A34A",
      CHECKED_OUT: "#0284C7",
      WFH: "#9333EA",
      ON_LEAVE: "#D97706",
      NOT_CHECKED_IN: "#94A3B8"
    };
    let timeSuffix = "";
    if (!compact && st.state === "CHECKED_IN" && st.punch_in) {
      const iso = st.punch_in.endsWith("Z") ? st.punch_in : st.punch_in + "Z";
      const tStr = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      timeSuffix = ` (${tStr})`;
    }
    const modeTag = (!compact && st.state === "CHECKED_IN" && st.mode === "WFH") ? " • WFH" : "";
    const pad = compact ? "2px 8px;font-size:10px;" : "4px 10px;font-size:11px;";
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:${pad}border-radius:999px;font-weight:600;white-space:nowrap;${styles[st.state] || styles.NOT_CHECKED_IN}">
      <span style="width:6px;height:6px;border-radius:999px;background:${dots[st.state] || "#94A3B8"};"></span>
      ${esc(st.label)}${timeSuffix}${modeTag}
    </span>`;
  }

  return { refresh, getUser, formatId, formatNameWithId, getStatus, badgeHtml };
})();

// 5. Reusable HTML Component Builders
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