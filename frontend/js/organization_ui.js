let orgViewMode = "tree";
let cachedOrgRoots = [];
let cachedLiveStatus = {};

function formatOrgMemberId(person) {
  if (person && person.employee_code) return String(person.employee_code);
  return `#${person?.id ?? ""}`;
}

function getMemberCurrentActivity(userId) {
  const tasks = Array.isArray(allTasks) ? allTasks.filter(t => t.assigned_to_id === userId && t.status !== "COMPLETED") : [];
  if (!tasks.length) return "";
  const priorityOrder = { BLOCKED: 1, IN_PROGRESS: 2, PENDING_REVIEW: 3, TODO: 4 };
  tasks.sort((a, b) => (priorityOrder[a.status] || 9) - (priorityOrder[b.status] || 9));
  const top = tasks[0];
  const prefix = top.status === "BLOCKED" ? "Blocked on"
               : top.status === "PENDING_REVIEW" ? "In review"
               : top.status === "IN_PROGRESS" ? "Working on"
               : "Next up";
  return `${prefix}: ${top.title}`;
}

async function renderOrganizationSection() {
  const [tree, liveStatuses] = await Promise.all([
    fetchOr(API.orgTree, []),
    fetchOr("/attendance/team/live-status", {}),
    typeof loadTasks === "function" ? loadTasks() : Promise.resolve()
  ]);
  cachedOrgRoots = Array.isArray(tree) ? tree : [];
  cachedLiveStatus = liveStatuses || {};

  if (typeof currentUser !== "undefined" && currentUser && typeof todayAttendance !== "undefined" && todayAttendance) {
    const uid = String(currentUser.id);
    if (todayAttendance.punch_in && !todayAttendance.punch_out) {
      cachedLiveStatus[uid] = {
        ...(cachedLiveStatus[uid] || {}),
        state: "CHECKED_IN",
        label: "Checked in",
        punch_in: todayAttendance.punch_in
      };
    } else if (todayAttendance.punch_out) {
      cachedLiveStatus[uid] = {
        ...(cachedLiveStatus[uid] || {}),
        state: "CHECKED_OUT",
        label: `Checked out (${todayAttendance.total_hours || 0}h)`,
        punch_in: todayAttendance.punch_in
      };
    }
  }

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

function getRoleBadgeStyle(roleTier) {
  switch (roleTier) {
    case "ADMIN":
      return "background: var(--accent); color: var(--accent-ink);";
    case "HR":
      return "background: rgba(14, 116, 144, 0.14); color: #0e7490;";
    case "MANAGER":
      return "background: rgba(29, 107, 82, 0.14); color: var(--accent);";
    case "TEAM_LEAD":
      return "background: rgba(217, 119, 6, 0.14); color: #b45309;";
    case "INTERN":
      return "background: rgba(109, 40, 217, 0.12); color: #6d28d9;";
    default:
      return "";
  }
}

function drawOrganization() {
  const roots = cachedOrgRoots;
  const people = flattenOrgTree(roots);
  const countRole = role => people.filter(p => p.role_tier === role).length;

  const getSt = (id) => cachedLiveStatus[id] || cachedLiveStatus[String(id)] || { state: "NOT_CHECKED_IN" };
  const checkedInCount = people.filter(p => getSt(p.id).state === "CHECKED_IN").length;
  const wfhOrLeaveCount = people.filter(p => ["WFH", "ON_LEAVE"].includes(getSt(p.id).state)).length;
  const approverLeadsCount = countRole("MANAGER") + countRole("TEAM_LEAD") + countRole("HR");

  const managerOf = {};
  const mapReports = (nodes, managerLabel = "Workspace Leadership") => {
    for (const n of nodes || []) {
      managerOf[n.id] = managerLabel;
      const label = `${n.full_name} (${formatOrgMemberId(n)})`;
      if (Array.isArray(n.subordinates) && n.subordinates.length) {
        mapReports(n.subordinates, label);
      }
    }
  };
  mapReports(roots);

  const treeHtml = roots.length
    ? roots.map(r => renderOrgBranch(r, 0, managerOf)).join("")
    : emptyState("No organization members found in this workspace yet.");

  const roleGroups = [
    { tier: "ADMIN",     title: "Workspace Admins",     desc: "Workspace setup, onboarding, roles, events & holidays" },
    { tier: "HR",        title: "Human Resources (HR)", desc: "People operations, leave/WFH governance & employee support" },
    { tier: "MANAGER",   title: "Team Managers",        desc: "Leave/WFH approvals, task/report review & escalations" },
    { tier: "TEAM_LEAD", title: "Team Leads (TL)",      desc: "Task assignment, completion verification & work report sign-off" },
    { tier: "MEMBER",    title: "Team Members",         desc: "Core task execution, work reports, attendance & leave requests" },
    { tier: "INTERN",    title: "Interns",              desc: "Guided deliverables, progress reports & shift tracking" }
  ];

  const rolesHtml = roleGroups.map(group => {
    const members = people.filter(p => p.role_tier === group.tier);
    return `
      <div class="mb-6 last:mb-0">
        <div class="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line)]">
          <div>
            <h3 class="text-sm font-bold text-gray-900">${esc(group.title)}</h3>
            <p class="text-xs muted">${esc(group.desc)}</p>
          </div>
          <span class="chip">${members.length} ${members.length === 1 ? "person" : "people"}</span>
        </div>
        ${members.length ? members.map(p => {
          const directReports = (p.subordinates || [])
            .map(s => `${s.full_name} (${formatOrgMemberId(s)})`)
            .join(", ");
          const activeTask = getMemberCurrentActivity(p.id);
          return `
            <div class="org-card flex-wrap gap-2" data-name="${esc((p.full_name + " " + formatOrgMemberId(p) + " " + p.role_tier).toLowerCase())}">
              <span class="avatar">${initials(p.full_name)}</span>
              <div class="flex-1 min-w-0">
                <b>${esc(p.full_name)} <span class="text-xs font-mono opacity-75">[${esc(formatOrgMemberId(p))}]</span></b>
                <small>${esc(p.designation || "Member")} • ${esc(p.email || "")}</small>
                <small class="block mt-0.5 text-[11px]">
                  Reports to: <b>${esc(managerOf[p.id] || "Workspace Leadership")}</b>
                  ${directReports ? ` &nbsp;|&nbsp; Supervises: <b>${esc(directReports)}</b>` : ""}
                </small>
                ${activeTask ? `<small class="block mt-0.5 text-[11px]" style="color:var(--accent);font-weight:600;">${esc(activeTask)}</small>` : ""}
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                ${renderStatusBadge(p.id)}
                <span class="chip" style="${getRoleBadgeStyle(p.role_tier)}">${esc(p.role_tier)}</span>
              </div>
            </div>`;
        }).join("") : emptyState(`No users in ${group.tier} role yet.`)}
      </div>`;
  }).join("");

  const roleBreakdownSub = [
    `${countRole("ADMIN")} Admin`,
    `${countRole("HR")} HR`,
    `${countRole("MANAGER")} Mgr`,
    `${countRole("TEAM_LEAD")} TL`,
    `${countRole("MEMBER")} Member`,
    `${countRole("INTERN")} Intern`
  ].join(" • ");

  setSection(`
    ${pageHead("Organization & Live Team Status", "Reporting hierarchy, live shift status, and what each teammate is currently working on.",
      `<div class="flex items-center gap-2.5 flex-wrap">
        ${segmented([["tree", "Reporting Tree"], ["roles", "Role Structure"]], orgViewMode, "setOrgViewMode")}
        <input id="orgSearch" class="search-box" placeholder="Find by name or ID…" oninput="filterOrg(this.value)">
      </div>`)}

    <div class="kpis">
      ${kpi("Total Members", people.length, roleBreakdownSub)}
      ${kpi("Checked In Now", checkedInCount, "Active in workspace today")}
      ${kpi("WFH / On Leave", wfhOrLeaveCount, "Remote or approved time off")}
      ${kpi("Leads & Reviewers", approverLeadsCount, "Managers, TLs & HR")}
    </div>

    <section class="card glass" id="orgTree">
      ${orgViewMode === "tree" ? treeHtml : rolesHtml}
    </section>
  `);
}

function renderOrgBranch(person, depth = 0, managerOf = {}) {
  const reports = person.subordinates || [];
  const roleBadgeStyle = getRoleBadgeStyle(person.role_tier);
  const activeTask = getMemberCurrentActivity(person.id);

  const teamLeadLine = depth > 0
    ? `<small class="block text-[11px] mt-0.5">Reports to: <b>${esc(managerOf[person.id] || "Leadership")}</b></small>`
    : `<small class="block text-[11px] mt-0.5">Workspace Leadership</small>`;

  const card = `
    <div class="org-card flex-wrap gap-2" data-name="${esc((person.full_name + " " + formatOrgMemberId(person) + " " + person.role_tier).toLowerCase())}">
      <span class="avatar">${initials(person.full_name)}</span>
      <div class="flex-1 min-w-0">
        <b>${esc(person.full_name)} <span class="text-xs font-mono opacity-75">[${esc(formatOrgMemberId(person))}]</span></b>
        <small>${esc(person.designation || "Team Member")} • ${esc(person.email || "")}</small>
        ${teamLeadLine}
        ${activeTask ? `<small class="block text-[11px] mt-0.5" style="color:var(--accent);font-weight:600;">${esc(activeTask)}</small>` : ""}
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