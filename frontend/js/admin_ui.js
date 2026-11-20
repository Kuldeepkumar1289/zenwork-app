function flattenOrgTree(nodes, list = []) {
    for (const node of nodes) {
        list.push(node);
        if (node.subordinates && node.subordinates.length > 0) {
            flattenOrgTree(node.subordinates, list);
        }
    }
    return list;
}

async function renderAdminSection() {
    const container = document.getElementById("section-dynamic");

    if (!currentUser || currentUser.role_tier !== "ADMIN") {
        container.innerHTML = `<div class="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-700 text-sm">
            Access Denied: Super Admin privileges required.
        </div>`;
        return;
    }

    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <span class="text-[10px] font-semibold uppercase tracking-wider text-amber-600">MASTER CONTROL</span>
                <h1 class="text-2xl font-semibold text-gray-900">Super Admin Panel</h1>
                <p class="text-xs text-gray-500 mt-0.5">Onboard employees into <b>${currentUser.company_name}</b>, manage roles, and oversee workspace metrics.</p>
            </div>
        </div>

        <!-- 5 Global Master KPI Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-[11px] text-gray-500">Total Members</p>
                <p id="admTotalUsers" class="text-2xl font-bold text-gray-900 mt-1">0</p>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-[11px] text-gray-500">Total Tasks</p>
                <p id="admTotalTasks" class="text-2xl font-bold text-gray-900 mt-1">0</p>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-[11px] text-gray-500">Active Blockers</p>
                <p id="admBlockers" class="text-2xl font-bold text-red-600 mt-1">0</p>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-[11px] text-gray-500">Pending Leaves/WFH</p>
                <p id="admLeaves" class="text-2xl font-bold text-amber-600 mt-1">0</p>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8] col-span-2 sm:col-span-1">
                <p class="text-[11px] text-gray-500">Open Queries</p>
                <p id="admQueries" class="text-2xl font-bold text-[#1E6B52] mt-1">0</p>
            </div>
        </div>

        <!-- Onboard New Employee Card -->
        <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5 mt-4">
            <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                    <h2 class="text-sm font-semibold text-gray-900">Onboard New Employee</h2>
                    <p class="text-[11px] text-gray-400">
                        Creates an employee locked to <b>${currentUser.company_name}</b> (${currentUser.company_code || "ORG"}) with an auto-generated temporary password.
                    </p>
                </div>
                <span class="chip">Organization Locked</span>
            </div>

            <form id="adminAddEmployeeForm" onsubmit="handleAdminAddEmployee(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                    <label class="block font-medium text-gray-700 mb-1">Employee Full Name</label>
                    <input type="text" id="admNewEmpName" required placeholder="Priya Verma" class="w-full px-3 py-2 rounded-xl border border-gray-200">
                </div>
                <div>
                    <label class="block font-medium text-gray-700 mb-1">Work Email</label>
                    <input type="email" id="admNewEmpEmail" required placeholder="priya@company.com" class="w-full px-3 py-2 rounded-xl border border-gray-200">
                </div>
                <div>
                    <label class="block font-medium text-gray-700 mb-1">Designation</label>
                    <input type="text" id="admNewEmpDesig" required placeholder="Backend Developer" class="w-full px-3 py-2 rounded-xl border border-gray-200">
                </div>
                <div>
                    <label class="block font-medium text-gray-700 mb-1">Role Tier</label>
                    <select id="admNewEmpRole" class="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white">
                        <option value="MEMBER">MEMBER</option>
                        <option value="MANAGER">MANAGER</option>
                    </select>
                </div>
                <div>
                    <label class="block font-medium text-gray-700 mb-1">Reporting Manager ID (Optional)</label>
                    <input type="number" id="admNewEmpMgr" placeholder="e.g. 1" class="w-full px-3 py-2 rounded-xl border border-gray-200">
                </div>
                <div class="flex items-end">
                    <button type="submit" id="admAddEmpBtn" class="w-full py-2 px-4 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold cursor-pointer">
                        + Create Employee Account
                    </button>
                </div>
            </form>

            <div id="admCreatedCredsBox" class="hidden mt-4 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46]"></div>
        </div>

        <!-- User Role & Co-Admin Delegation Table -->
        <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5 mt-4">
            <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div>
                    <h2 class="text-sm font-semibold text-gray-900">Workspace Members & Role Permissions</h2>
                    <p class="text-[11px] text-gray-400">Promote trusted members to Manager or Co-Admin (Max 3 Admins allowed)</p>
                </div>
                <span id="adminSlotBadge" class="text-xs font-medium px-3 py-1 rounded-full bg-[#EBF3EF] text-[#1E6B52]">Admins: 1 / 3</span>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full min-w-[640px] text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[#F0F4F2] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            <th class="py-2.5">ID</th>
                            <th class="py-2.5">Employee</th>
                            <th class="py-2.5">Designation</th>
                            <th class="py-2.5">Manager ID</th>
                            <th class="py-2.5">Role Tier</th>
                            <th class="py-2.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="adminUsersTableBody" class="divide-y divide-[#F0F4F2] text-xs">
                        <tr><td colspan="6" class="py-6 text-center text-gray-400">Loading workspace members...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    await loadAdminDashboardData();
}

async function handleAdminAddEmployee(e) {
    e.preventDefault();
    const btn = document.getElementById("admAddEmpBtn");
    const credsBox = document.getElementById("admCreatedCredsBox");
    btn.disabled = true;
    btn.textContent = "Creating...";

    try {
        const mgrVal = document.getElementById("admNewEmpMgr").value.trim();
        const res = await apiRequest("/users/admin/add-employee", "POST", {
            full_name: document.getElementById("admNewEmpName").value.trim(),
            email: document.getElementById("admNewEmpEmail").value.trim(),
            designation: document.getElementById("admNewEmpDesig").value.trim(),
            role_tier: document.getElementById("admNewEmpRole").value,
            manager_id: mgrVal ? parseInt(mgrVal, 10) : null
        });

        e.target.reset();
        if (credsBox) {
            credsBox.classList.remove("hidden");
            credsBox.innerHTML = `
                <b>✓ Employee Account Created!</b> Share these first-login credentials with <b>${res.employee.full_name}</b>:<br>
                <div class="mt-1.5 font-mono text-[12px] bg-white px-3 py-2 rounded-lg border border-[#A7F3D0]">
                    Email: <b>${res.employee.email}</b> &nbsp;|&nbsp; Temporary Password: <b>${res.temp_password}</b>
                </div>
                <span class="block mt-1 text-[11px] opacity-80">The employee will set their own personal password upon first sign-in.</span>
            `;
        }
        if (typeof showToast === "function") showToast("Employee account created!", "success");
        await loadAdminDashboardData();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message || "Could not create employee.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "+ Create Employee Account";
    }
}

async function loadAdminDashboardData() {
    try {
        const [overview, orgTree] = await Promise.all([
            apiRequest("/admin/overview"),
            apiRequest("/users/org-tree")
        ]);

        const users = flattenOrgTree(orgTree);

        document.getElementById("admTotalUsers").textContent = overview.total_users;
        document.getElementById("admTotalTasks").textContent = overview.total_tasks;
        document.getElementById("admBlockers").textContent = overview.active_blockers;
        document.getElementById("admLeaves").textContent = overview.pending_leaves;
        document.getElementById("admQueries").textContent = overview.open_queries;

        const adminCount = users.filter(u => u.role_tier === "ADMIN").length;
        document.getElementById("adminSlotBadge").textContent = `Admins: ${adminCount} / 3`;

        const tbody = document.getElementById("adminUsersTableBody");
        tbody.innerHTML = users.map(u => {
            const isSelf = u.id === currentUser.id;
            return `
                <tr class="hover:bg-[#F9FBFA]">
                    <td class="py-3 text-gray-400 font-mono">#${u.id}</td>
                    <td class="py-3">
                        <p class="font-semibold text-gray-900">${u.full_name} ${isSelf ? '<span class="text-[10px] text-[#1E6B52]">(You)</span>' : ''}</p>
                        <p class="text-[11px] text-gray-400">${u.email}</p>
                    </td>
                    <td class="py-3 text-gray-600">${u.designation}</td>
                    <td class="py-3">
                        <input type="number" id="mgr-${u.id}" value="${u.manager_id || ''}" placeholder="None"
                            class="w-16 px-2 py-1 rounded-lg border border-gray-200 text-xs">
                    </td>
                    <td class="py-3">
                        <select id="role-${u.id}" class="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium ${u.role_tier === 'ADMIN' ? 'bg-amber-50 text-amber-800 border-amber-200' : ''}">
                            <option value="MEMBER" ${u.role_tier === 'MEMBER' ? 'selected' : ''}>MEMBER</option>
                            <option value="MANAGER" ${u.role_tier === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
                            <option value="ADMIN" ${u.role_tier === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                        </select>
                    </td>
                    <td class="py-3 text-right whitespace-nowrap space-x-2">
                        <button onclick="saveUserAdminChanges(${u.id})" class="px-3 py-1 rounded-lg bg-[#1E6B52] hover:bg-[#15523E] text-white text-[11px] font-medium cursor-pointer">
                            Save
                        </button>
                        ${!isSelf ? `
                            <button onclick="deleteUserByAdmin(${u.id}, '${u.full_name}')" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] hover:bg-red-100 cursor-pointer">
                                Remove
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("Admin load error:", err);
    }
}

async function saveUserAdminChanges(userId) {
    const role_tier = document.getElementById(`role-${userId}`).value;
    const mgrVal = document.getElementById(`mgr-${userId}`).value;
    const payload = {
        role_tier,
        manager_id: mgrVal ? parseInt(mgrVal) : null
    };

    try {
        await apiRequest(`/admin/users/${userId}`, "PATCH", payload);
        if (typeof showToast === "function") showToast("User permissions updated!", "success");
        await loadAdminDashboardData();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message, "error");
        await loadAdminDashboardData();
    }
}

async function deleteUserByAdmin(userId, name) {
    if (!confirm(`Are you sure you want to remove ${name} from the workspace?`)) return;
    try {
        await apiRequest(`/admin/users/${userId}`, "DELETE");
        if (typeof showToast === "function") showToast(`${name} removed from workspace.`, "info");
        await loadAdminDashboardData();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message, "error");
    }
}