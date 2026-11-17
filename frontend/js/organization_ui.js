let orgViewMode = "tree"; // "tree" (Reporting Hierarchy) | "roles" (By Role Tier)
let cachedOrgRoots = [];
let cachedLiveStatus = {};

async function renderOrganizationSection() {
  const [tree, liveStatuses] = await Promise.all([
    fetchOr(API.orgTree, []),
    fetchOr("/attendance/team/live-status", {})
  ]);
  cachedOrgRoots = Array.isArray(tree) ? tree : [];
  cachedLiveStatus = liveStatuses || {};
  drawOrganization();
}

function setOrgViewMode(mode) {
  orgViewMode = mode;
  drawOrganization();
}

function renderStatusBadge(userId) {
  const st = cachedLiveStatus[userId] || cachedLiveStatus[String(userId)] || { state: "NOT_CHECKED_IN", label: "Not checked in" };
  const styles = {
    CHECKED_IN:     "background:#DCFCE7;color:#166534;border:1px solid #86EFAC;",
    CHECKED_OUT:    "background:#E0F2FE;color:#075985;border:1px solid #7DD3FC;",
    WFH:            "background:#F3E8FF;color:#6B21A8;border:1px solid #D8B4FE;",
    ON_LEAVE:       "background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;",
    NOT_CHECKED_IN: "background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;"
  };
  const dotColors = {
    CHECKED_IN: "#16A34A",
    CHECKED_OUT: "#0284C7",
    WFH: "#9333EA",
    ON_LEAVE: "#D97706",
    NOT_CHECKED_IN: "#94A3B8"
  };

  let timeSuffix = "";
  if (st.state === "CHECKED_IN" && st.punch_in) {
    const iso = st.punch_in.endsWith("Z") ? st.punch_in : st.punch_in + "Z";
    const tStr = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    timeSuffix = ` (${tStr})`;
  }

  const modeTag = (st.state === "CHECKED_IN" && st.mode === "WFH") ? " • WFH" : "";

  return `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap;${styles[st.state] || styles.NOT_CHECKED_IN}">
      <span style="width:7px;height:7px;border-radius:999px;background:${dotColors[st.state] || "#94A3B8"};"></span>
      ${esc(st.label)}${timeSuffix}${modeTag}
    </span>
  `;
}

function drawOrganization() {
  const roots = cachedOrgRoots;
  const people = flattenOrgTree(roots);
  const countRole = role => people.filter(p => p.role_tier === role).length;

  const checkedInCount = people.filter(p => (cachedLiveStatus[p.id]?.state === "CHECKED_IN")).length;
  const wfhOrLeaveCount = people.filter(p => ["WFH", "ON_LEAVE"].includes(cachedLiveStatus[p.id]?.state)).length;

  // Build parent lookup map so every person shows their exact reporting line
  const managerOf = {};
  const mapReports = (nodes, managerName = "Top-Level Leadership") => {
    for (const n of nodes || []) {
      managerOf[n.id] = managerName;
      if (Array.isArray(n.subordinates) && n.subordinates.length) {
        mapReports(n.subordinates, n.full_name);
      }
    }
  };
  mapReports(roots);

  const treeHtml = roots.length
    ? roots.map(r => renderOrgBranch(r, 0, managerOf)).join("")
    : emptyState("No organization members found in this workspace yet.");

  const roleGroups = [
    { tier: "ADMIN",   title: "Tier 1 • Workspace Admins",   desc: "Full system control, user provisioning, and final approvals" },
    { tier: "MANAGER", title: "Tier 2 • Team Managers",      desc: "Department leads managing tasks, leaves, and direct reports" },
    { tier: "MEMBER",  title: "Tier 3 • Team Members",       desc: "Individual contributors executing assigned tasks and sprints" }
  ];

  const rolesHtml = roleGroups.map(group => {
    const members = people.filter(p => p.role_tier === group.tier);
    return `
      <div class="mb-6 last:mb-0">
        <div class="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line)]">
          <div>
            <h3 class="text-sm font-bold text-gray-900">${group.title}</h3>
            <p class="text-xs muted">${group.desc}</p>
          </div>
          <span class="chip">${members.length} ${members.length === 1 ? "person" : "people"}</span>
        </div>
        ${members.length ? members.map(p => {
          const directReports = (p.subordinates || []).map(s => s.full_name).join(", ");
          return `
            <div class="org-card flex-wrap gap-2" data-name="${esc(p.full_name.toLowerCase())}">
              <span class="avatar">${initials(p.full_name)}</span>
              <div class="flex-1 min-w-0">
                <b>${esc(p.full_name)}</b>
                <small>${esc(p.designation || "Member")} • ${esc(p.email || "")}</small>                <small class="block mt-0.5 text-[11px]">
                  Team / Reports to: <b>${esc(managerOf[p.id] || "Top-Level")}</b>
                  ${directReports ? ` &nbsp;|&nbsp; Manages: <b>${esc(directReports)}</b>` : ""}
                </small>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                ${renderStatusBadge(p.id)}
                <span class="chip">${esc(p.role_tier)}</span>
              </div>
            </div>`;
        }).join("") : emptyState(`No users in ${group.tier} role yet.`)}
      </div>`;
  }).join("");

  setSection(`
    ${pageHead("Organization & Live Team Status", "Reporting hierarchy, team structure, and real-time check-in/WFH/leave availability.",
      `<div class="flex items-center gap-2.5 flex-wrap">
        ${segmented([["tree", "Reporting Tree"], ["roles", "Role Structure"]], orgViewMode, "setOrgViewMode")}
        <input id="orgSearch" class="search-box" placeholder="Find a teammate…" oninput="filterOrg(this.value)">
      </div>`)}

    <div class="kpis">
      ${kpi("Total Members", people.length, `${countRole("ADMIN")} Admin • ${countRole("MANAGER")} Mgr • ${countRole("MEMBER")} Member`)}
      ${kpi("Checked In Now", checkedInCount, "Active in workspace today")}
      ${kpi("WFH / On Leave", wfhOrLeaveCount, "Remote or approved time off")}
      ${kpi("Managers & Leads", countRole("MANAGER") + countRole("ADMIN"), "Team approvers")}
    </div>

    <section class="card glass" id="orgTree">
      ${orgViewMode === "tree" ? treeHtml : rolesHtml}
    </section>
  `);
}

function renderOrgBranch(person, depth = 0, managerOf = {}) {
  const reports = person.subordinates || [];
  const roleBadgeStyle =
    person.role_tier === "ADMIN"   ? "background: var(--accent); color: var(--accent-ink);" :
    person.role_tier === "MANAGER" ? "background: rgba(29, 107, 82, 0.14); color: var(--accent);" : "";

  const teamLeadLine = depth > 0
    ? `<small class="block text-[11px] mt-0.5">Team: <b>${esc(managerOf[person.id] || "Leadership")}</b></small>`
    : `<small class="block text-[11px] mt-0.5">Workspace Leadership</small>`;

  const card = `
    <div class="org-card flex-wrap gap-2" data-name="${esc(person.full_name.toLowerCase())}">
      <span class="avatar">${initials(person.full_name)}</span>
      <div class="flex-1 min-w-0">
        <b>${esc(person.full_name)}</b>
        <small>${esc(person.designation || "Team Member")} • ${esc(person.email || "")}</small>
        ${teamLeadLine}
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${renderStatusBadge(person.id)}
        ${reports.length ? `<small class="font-medium">${reports.length} report${reports.length > 1 ? "s" : ""}</small>` : ""}
        <span class="chip" style="${roleBadgeStyle}">${esc(person.role_tier)}</span>
      </div>
    </div>`;

  if (!reports.length) {
    return `<div class="org-branch">${card}</div>`;
  }

  return `
    <div class="org-branch">
      ${card}
      <div class="org-children" style="display: block;">
        ${reports.map(child => renderOrgBranch(child, depth + 1, managerOf)).join("")}
      </div>
    </div>`;
}

function filterOrg(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll("#orgTree .org-card").forEach(card => {
    const hit = !q || card.dataset.name.includes(q);
    card.classList.toggle("is-dim", !hit);
    card.classList.toggle("is-hit", !!q && hit);
  });
}

registerSection("organization", renderOrganizationSection);