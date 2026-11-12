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
        <div class="flex items-center justify-between">
            <div>
                <span class="text-[10px] font-semibold uppercase tracking-wider text-amber-600">MASTER CONTROL</span>
                <h1 class="text-2xl font-semibold text-gray-900">Super Admin Panel</h1>
                <p class="text-xs text-gray-500 mt-0.5">Manage workspace roles, promote up to 2 co-admins, and override records.</p>
            </div>
        </div>

        <!-- 5 Global Master KPI Cards -->
        <div class="grid grid-cols-5 gap-3">
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
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-[11px] text-gray-500">Open Queries</p>
                <p id="admQueries" class="text-2xl font-bold text-[#1E6B52] mt-1">0</p>
            </div>
        </div>

        <!-- User Role & Co-Admin Delegation Table -->
        <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h2 class="text-sm font-semibold text-gray-900">Workspace Members & Role Permissions</h2>
                    <p class="text-[11px] text-gray-400">Promote trusted members to Manager or Co-Admin (Max 3 Admins allowed)</p>
                </div>
                <span id="adminSlotBadge" class="text-xs font-medium px-3 py-1 rounded-full bg-[#EBF3EF] text-[#1E6B52]">Admins: 1 / 3</span>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
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
                    <td class="py-3 text-right space-x-2">
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
        alert("User permissions updated!");
        await loadAdminDashboardData();
    } catch (err) {
        alert(err.message);
        await loadAdminDashboardData();
    }
}

async function deleteUserByAdmin(userId, name) {
    if (!confirm(`Are you sure you want to remove ${name} from the workspace?`)) return;
    try {
        await apiRequest(`/admin/users/${userId}`, "DELETE");
        await loadAdminDashboardData();
    } catch (err) {
        alert(err.message);
    }
}