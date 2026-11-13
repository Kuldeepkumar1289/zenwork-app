

let orgViewMode = "tree"; // "tree" (Reporting Hierarchy) | "roles" (By Role Tier)
let cachedOrgRoots = [];

async function renderOrganizationSection() {
  const tree = await fetchOr(API.orgTree, []);
  cachedOrgRoots = Array.isArray(tree) ? tree : [];
  drawOrganization();
}

function setOrgViewMode(mode) {
  orgViewMode = mode;
  drawOrganization();
}

function drawOrganization() {
  const roots = cachedOrgRoots;
  const people = flattenOrgTree(roots);
  const countRole = role => people.filter(p => p.role_tier === role).length;

  // Build parent lookup map so every person knows who they report to
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
    ? roots.map(r => renderOrgBranch(r, 0)).join("")
    : emptyState("No organization data yet.");

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
            <div class="org-card" data-name="${esc(p.full_name.toLowerCase())}">
              <span class="avatar">${initials(p.full_name)}</span>
              <div class="flex-1 min-w-0">
                <b>${esc(p.full_name)}</b>
                <small>${esc(p.designation || "Member")} • ${esc(p.email || "")}</small>
                <small class="block mt-0.5 text-[11px]">
                  Reports to: <b>${esc(managerOf[p.id] || "Top-Level")}</b>
                  ${directReports ? ` &nbsp;|&nbsp; Manages: <b>${esc(directReports)}</b>` : ""}
                </small>
              </div>
              <span class="chip push">${esc(p.role_tier)}</span>
            </div>`;
        }).join("") : emptyState(`No users in ${group.tier} role yet.`)}
      </div>`;
  }).join("");

  setSection(`
    ${pageHead("Organization", "Complete reporting lines and role structure across your workspace.",
      `<div class="flex items-center gap-2.5 flex-wrap">
        ${segmented([["tree", "Reporting Tree"], ["roles", "Role Structure"]], orgViewMode, "setOrgViewMode")}
        <input id="orgSearch" class="search-box" placeholder="Find a teammate…" oninput="filterOrg(this.value)">
      </div>`)}

    <div class="kpis">
      ${kpi("Total Members", people.length, "Active in workspace")}
      ${kpi("Admins", countRole("ADMIN"), "Full workspace access")}
      ${kpi("Managers", countRole("MANAGER"), "Lead teams & approvals")}
      ${kpi("Members", countRole("MEMBER"), "Individual contributors")}
    </div>

    <section class="card glass" id="orgTree">
      ${orgViewMode === "tree" ? treeHtml : rolesHtml}
    </section>
  `);
}

/** Recursively renders every manager and all nested subordinates clearly without hidden <details> clipping */
function renderOrgBranch(person, depth = 0) {
  const reports = person.subordinates || [];
  const roleBadgeStyle =
    person.role_tier === "ADMIN"   ? "background: var(--accent); color: var(--accent-ink);" :
    person.role_tier === "MANAGER" ? "background: rgba(29, 107, 82, 0.14); color: var(--accent);" : "";

  const card = `
    <div class="org-card" data-name="${esc(person.full_name.toLowerCase())}">
      <span class="avatar">${initials(person.full_name)}</span>
      <div class="flex-1 min-w-0">
        <b>${esc(person.full_name)}</b>
        <small>${esc(person.designation || "Team Member")} • ${esc(person.email || "")}</small>
      </div>
      ${reports.length ? `<small class="font-medium">${reports.length} direct report${reports.length > 1 ? "s" : ""}</small>` : ""}
      <span class="chip" style="${roleBadgeStyle}">${esc(person.role_tier)}</span>
    </div>`;

  if (!reports.length) {
    return `<div class="org-branch">${card}</div>`;
  }

  return `
    <div class="org-branch">
      ${card}
      <div class="org-children" style="display: block;">
        ${reports.map(child => renderOrgBranch(child, depth + 1)).join("")}
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