let userQuotas = { leave_balance: 2, wfh_balance: 2 };
let cachedLeavesList = [];
let currentAttFilter = "ALL";

async function renderAttendanceSection() {
    const container = document.getElementById("section-dynamic");
    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900">Attendance, Leaves & WFH</h1>
                <p class="text-xs text-gray-500 mt-0.5">Track work sessions, regularize missed check-ins, and manage leave/WFH quotas.</p>
            </div>
            <div class="flex items-center gap-2.5 flex-wrap">
                <button onclick="openRegModal()" class="px-4 py-2.5 rounded-xl border border-amber-500 text-amber-700 hover:bg-amber-50 text-xs font-semibold transition cursor-pointer">
                    Regularize Attendance
                </button>
                <button onclick="openLeaveModal('WFH')" class="px-4 py-2.5 rounded-xl border border-[#1E6B52] text-[#1E6B52] hover:bg-[#EBF3EF] text-xs font-semibold transition cursor-pointer">
                    + Apply WFH
                </button>
                <button onclick="openLeaveModal('CASUAL')" class="bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer">
                    + Apply Leave
                </button>
            </div>
        </div>

        <!-- 4 KPI Cards: Shift, Leave Balance, Monthly WFH Left, Work Mode -->
        <div class="grid grid-cols-4 gap-4">
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#1E6B52]">Today's Shift</span>
                <p id="attTabTimer" class="text-2xl font-bold text-gray-900 mt-2">00h 00m</p>
                <p id="attTabHours" class="text-[11px] text-gray-400 mt-0.5">0.0 hrs logged</p>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Leave Balance</p>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EBF3EF] text-[#1E6B52]">+2 / mo</span>
                </div>
                <p id="attLeaveBalance" class="text-2xl font-bold text-gray-900 mt-2">2.0 days</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Carry-forward (min -5 allowed)</p>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Monthly WFH Left</p>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700">Resets monthly</span>
                </div>
                <p id="attWfhBalance" class="text-2xl font-bold text-gray-900 mt-2">2 / 2</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Refreshes to 2 every month (min 0)</p>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-xs text-gray-500">Today's Work Mode</p>
                <p id="attTabMode" class="text-2xl font-semibold text-[#1E6B52] mt-2">Office</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Active workspace status</p>
            </div>
        </div>

        <!-- Leave & WFH Requests Table with Separate Filter Tabs -->
        <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h2 class="text-sm font-semibold text-gray-900">Leave & WFH Approval Queue</h2>
                    <p class="text-[11px] text-gray-400">Balances deduct only when approved by a Manager or Admin.</p>
                </div>
                <div class="flex items-center gap-1.5 text-xs">
                    <button onclick="filterAttendanceTable('ALL', this)" class="att-filter-btn px-3 py-1 rounded-lg bg-[#EBF3EF] text-[#1E6B52] font-semibold">All</button>
                    <button onclick="filterAttendanceTable('LEAVE', this)" class="att-filter-btn px-3 py-1 rounded-lg text-gray-500">Leaves Only</button>
                    <button onclick="filterAttendanceTable('WFH', this)" class="att-filter-btn px-3 py-1 rounded-lg text-gray-500">WFH Only</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[#F0F4F2] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            <th class="py-2.5">Applicant</th>
                            <th class="py-2.5">Category</th>
                            <th class="py-2.5">Dates</th>
                            <th class="py-2.5">Days</th>
                            <th class="py-2.5">Reason</th>
                            <th class="py-2.5">Status</th>
                            <th class="py-2.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="leavesTableBody" class="divide-y divide-[#F0F4F2] text-xs">
                        <tr><td colspan="7" class="py-6 text-center text-gray-400">Loading leave & WFH records...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Attendance Regularization Queue -->
        <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 mt-4">
            <div class="mb-3">
                <h2 class="text-sm font-semibold text-gray-900">Attendance Regularization Requests</h2>
                <p class="text-[11px] text-gray-400">Forgot to check in? Submit your actual shift start time for Manager/Admin approval.</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[#F0F4F2] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            <th class="py-2.5">Employee</th>
                            <th class="py-2.5">Date</th>
                            <th class="py-2.5">Requested Shift</th>
                            <th class="py-2.5">Reason</th>
                            <th class="py-2.5">Status</th>
                            <th class="py-2.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="regTableBody" class="divide-y divide-[#F0F4F2] text-xs">
                        <tr><td colspan="6" class="py-5 text-center text-gray-400">Loading regularizations...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Apply Leave / WFH Modal -->
        <div id="leaveModal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
            <div class="bg-white rounded-2xl border border-[#E6ECE8] w-full max-w-md p-6 shadow-xl">
                <div class="flex items-center justify-between mb-3">
                    <h3 id="leaveModalTitle" class="text-base font-semibold text-gray-900">Apply for Time Off</h3>
                    <button onclick="closeLeaveModal()" class="text-gray-400 hover:text-gray-700 text-lg">&times;</button>
                </div>
                <div id="modalQuotaHint" class="mb-3 p-2.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] text-[11px] text-gray-600"></div>
                <form id="applyLeaveForm" class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-medium text-gray-700 mb-1">Request Category</label>
                        <select id="leaveType" onchange="updateModalQuotaHint()" class="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#1E6B52] focus:outline-none">
                            <option value="CASUAL">Casual Leave (Carry-forward quota)</option>
                            <option value="SICK">Sick Leave (Carry-forward quota)</option>
                            <option value="EARNED">Earned Leave (Carry-forward quota)</option>
                            <option value="WFH">Work From Home (Monthly quota)</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Start Date</label>
                            <input type="date" id="leaveStartDate" required class="w-full px-3 py-2 rounded-xl border border-gray-200">
                        </div>
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">End Date</label>
                            <input type="date" id="leaveEndDate" required class="w-full px-3 py-2 rounded-xl border border-gray-200">
                        </div>
                    </div>
                    <div>
                        <label class="block font-medium text-gray-700 mb-1">Reason / Work Plan</label>
                        <textarea id="leaveReason" rows="3" required placeholder="Mention reason or WFH deliverables..."
                            class="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#1E6B52] focus:outline-none"></textarea>
                    </div>
                    <div class="pt-2 flex justify-end gap-2">
                        <button type="button" onclick="closeLeaveModal()" class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
                        <button type="submit" class="px-4 py-2 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold">Submit Request</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Regularize Attendance Modal -->
        <div id="regModal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
            <div class="bg-white rounded-2xl border border-[#E6ECE8] w-full max-w-md p-6 shadow-xl">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-base font-semibold text-gray-900">Regularize Missed Attendance</h3>
                    <button onclick="closeRegModal()" class="text-gray-400 hover:text-gray-700 text-lg">&times;</button>
                </div>
                <form id="applyRegForm" class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-medium text-gray-700 mb-1">Attendance Date</label>
                        <input type="date" id="regTargetDate" required class="w-full px-3 py-2 rounded-xl border border-gray-200">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Actual Check-In Time</label>
                            <input type="time" id="regInTime" value="09:30" required class="w-full px-3 py-2 rounded-xl border border-gray-200">
                        </div>
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Check-Out (Optional)</label>
                            <input type="time" id="regOutTime" class="w-full px-3 py-2 rounded-xl border border-gray-200">
                        </div>
                    </div>
                    <p class="text-[11px] text-gray-400">Leave Check-Out blank if you are still working today — your live shift timer will resume from Check-In time once approved.</p>
                    <div>
                        <label class="block font-medium text-gray-700 mb-1">Reason</label>
                        <textarea id="regReason" rows="2" required placeholder="e.g. Forgot to punch in at 9:30 AM due to morning client call..."
                            class="w-full px-3 py-2 rounded-xl border border-gray-200"></textarea>
                    </div>
                    <div class="pt-2 flex justify-end gap-2">
                        <button type="button" onclick="closeRegModal()" class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
                        <button type="submit" class="px-4 py-2 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold">Submit Request</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById("applyLeaveForm").addEventListener("submit", handleLeaveSubmit);
    document.getElementById("applyRegForm").addEventListener("submit", handleRegSubmit);

    if (todayAttendance) {
        document.getElementById("attTabHours").textContent = `${todayAttendance.total_hours} hrs logged`;
        document.getElementById("attTabTimer").textContent = document.getElementById("shiftTimerDisplay").textContent;
    }

    await Promise.all([loadUserQuotas(), loadLeavesData(), loadRegularizations()]);
}

/* ---------- Quotas & Leave / WFH Handlers ---------- */
async function loadUserQuotas() {
    try {
        userQuotas = await apiRequest("/attendance/quotas");
        const leaveEl = document.getElementById("attLeaveBalance");
        const wfhEl = document.getElementById("attWfhBalance");

        if (leaveEl) {
            leaveEl.textContent = `${userQuotas.leave_balance} days`;
            leaveEl.classList.toggle("text-amber-600", userQuotas.leave_balance < 0);
        }
        if (wfhEl) {
            wfhEl.textContent = `${userQuotas.wfh_balance} / 2`;
            wfhEl.classList.toggle("text-red-600", userQuotas.wfh_balance === 0);
        }
    } catch (e) {
        console.error("Quota fetch error:", e);
    }
}

function updateModalQuotaHint() {
    const type = document.getElementById("leaveType").value;
    const hint = document.getElementById("modalQuotaHint");
    const title = document.getElementById("leaveModalTitle");
    if (type === "WFH") {
        title.textContent = "Apply for Work From Home (WFH)";
        hint.innerHTML = `Available WFH this month: <b>${userQuotas.wfh_balance} of 2 days</b>. (Cannot go below 0; refreshes to 2 next month)`;
    } else {
        title.textContent = "Apply for Leave";
        hint.innerHTML = `Available Leave Balance: <b>${userQuotas.leave_balance} days</b>. (Increments +2/month; overdraft allowed up to <b>-5 days</b>)`;
    }
}

function openLeaveModal(defaultType = "CASUAL") {
    document.getElementById("leaveType").value = defaultType;
    updateModalQuotaHint();
    document.getElementById("leaveModal").classList.remove("hidden");
}

function closeLeaveModal() {
    document.getElementById("leaveModal").classList.add("hidden");
}

async function handleLeaveSubmit(e) {
    e.preventDefault();
    const leave_type = document.getElementById("leaveType").value;
    const start_date = document.getElementById("leaveStartDate").value;
    const end_date = document.getElementById("leaveEndDate").value;
    const reason = document.getElementById("leaveReason").value;

    const days = Math.floor((new Date(end_date) - new Date(start_date)) / 86400000) + 1;
    if (days <= 0) {
        alert("End date must be on or after start date.");
        return;
    }

    if (leave_type === "WFH" && userQuotas.wfh_balance - days < 0) {
        alert(`Insufficient WFH balance (${userQuotas.wfh_balance} left). WFH cannot go below 0.`);
        return;
    }
    if (leave_type !== "WFH" && userQuotas.leave_balance - days < -5) {
        alert(`Leave overdraft limit exceeded. Current balance: ${userQuotas.leave_balance} days (minimum allowed is -5).`);
        return;
    }

    try {
        await apiRequest("/attendance/leaves", "POST", { leave_type, start_date, end_date, reason });
        closeLeaveModal();
        e.target.reset();
        await loadLeavesData();
    } catch (err) {
        alert("Failed to submit: " + err.message);
    }
}

function filterAttendanceTable(filterType, btn) {
    currentAttFilter = filterType;
    document.querySelectorAll(".att-filter-btn").forEach(b => {
        b.classList.remove("bg-[#EBF3EF]", "text-[#1E6B52]", "font-semibold");
        b.classList.add("text-gray-500");
    });
    btn.classList.add("bg-[#EBF3EF]", "text-[#1E6B52]", "font-semibold");
    btn.classList.remove("text-gray-500");
    renderFilteredLeavesTable();
}

async function loadLeavesData() {
    try {
        cachedLeavesList = await apiRequest("/attendance/leaves");

        const todayStr = new Date().toISOString().split("T")[0];
        const activeWfh = cachedLeavesList.find(l => l.leave_type === "WFH" && l.status === "APPROVED" && l.start_date <= todayStr && l.end_date >= todayStr);
        if (activeWfh) {
            document.getElementById("attTabMode").textContent = "WFH (Remote)";
        }
        renderFilteredLeavesTable();
    } catch (err) {
        console.error(err);
    }
}

function renderFilteredLeavesTable() {
    const tbody = document.getElementById("leavesTableBody");
    const list = cachedLeavesList.filter(item => {
        if (currentAttFilter === "WFH") return item.leave_type === "WFH";
        if (currentAttFilter === "LEAVE") return item.leave_type !== "WFH";
        return true;
    });

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-400">No requests in this category.</td></tr>`;
        return;
    }

    const canApprove = currentUser && (currentUser.role_tier === "ADMIN" || currentUser.role_tier === "MANAGER");

    tbody.innerHTML = list.map(item => {
        const statusBadges = {
            "PENDING": "bg-amber-50 text-amber-700 border border-amber-200",
            "APPROVED": "bg-[#E6F4EA] text-[#1E6B52]",
            "REJECTED": "bg-red-50 text-red-700"
        };
        const typeBadge = item.leave_type === "WFH"
            ? `<span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">WFH (-${item.days_count}d)</span>`
            : `<span class="px-2 py-0.5 rounded-md bg-[#EBF3EF] text-[#1E6B52] font-semibold">${item.leave_type} LEAVE (-${item.days_count}d)</span>`;

        const applicantName = item.applicant ? item.applicant.full_name : `User #${item.user_id}`;

        return `
            <tr class="hover:bg-[#F9FBFA]">
                <td class="py-3 font-medium text-gray-900">${applicantName}</td>
                <td class="py-3">${typeBadge}</td>
                <td class="py-3 text-gray-600">${item.start_date} → ${item.end_date}</td>
                <td class="py-3 font-medium">${item.days_count}d</td>
                <td class="py-3 text-gray-500 max-w-xs truncate">${item.reason}</td>
                <td class="py-3">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusBadges[item.status]}">${item.status}</span>
                </td>
                <td class="py-3 text-right space-x-2">
                    ${(canApprove && item.status === "PENDING") ? `
                        <button onclick="reviewLeaveAction(${item.id}, 'APPROVED')" class="px-2.5 py-1 rounded-lg bg-[#1E6B52] text-white text-[11px] hover:bg-[#15523E]">Approve</button>
                        <button onclick="reviewLeaveAction(${item.id}, 'REJECTED')" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] hover:bg-red-100">Reject</button>
                    ` : `<span class="text-[11px] text-gray-400">—</span>`}
                </td>
            </tr>
        `;
    }).join("");
}

async function reviewLeaveAction(requestId, status) {
    try {
        await apiRequest(`/attendance/leaves/${requestId}/review`, "PATCH", { status });
        await Promise.all([loadUserQuotas(), loadLeavesData()]);
    } catch (err) {
        alert(err.message);
    }
}

/* ---------- Attendance Regularization Handlers ---------- */
function openRegModal() {
    const todayLocal = new Date();
    const yyyy = todayLocal.getFullYear();
    const mm = String(todayLocal.getMonth() + 1).padStart(2, "0");
    const dd = String(todayLocal.getDate()).padStart(2, "0");
    document.getElementById("regTargetDate").value = `${yyyy}-${mm}-${dd}`;
    document.getElementById("regModal").classList.remove("hidden");
}

function closeRegModal() {
    document.getElementById("regModal").classList.add("hidden");
}

async function handleRegSubmit(e) {
    e.preventDefault();
    const dateStr = document.getElementById("regTargetDate").value;
    const inStr = document.getElementById("regInTime").value;
    const outStr = document.getElementById("regOutTime").value;
    const reason = document.getElementById("regReason").value.trim();

    const payload = {
        target_date: dateStr,
        requested_punch_in: new Date(`${dateStr}T${inStr}`).toISOString(),
        requested_punch_out: outStr ? new Date(`${dateStr}T${outStr}`).toISOString() : null,
        reason
    };

    try {
        await apiRequest("/attendance/regularize", "POST", payload);
        closeRegModal();
        e.target.reset();
        await loadRegularizations();
    } catch (err) {
        alert("Regularization failed: " + err.message);
    }
}

async function loadRegularizations() {
    const tbody = document.getElementById("regTableBody");
    if (!tbody) return;
    try {
        const list = await apiRequest("/attendance/regularizations");
        if (!list || !list.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-5 text-center text-gray-400">No regularization requests yet.</td></tr>`;
            return;
        }
        const canApprove = currentUser && (currentUser.role_tier === "ADMIN" || currentUser.role_tier === "MANAGER");
        const badges = {
            PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
            APPROVED: "bg-[#E6F4EA] text-[#1E6B52]",
            REJECTED: "bg-red-50 text-red-700"
        };

        tbody.innerHTML = list.map(r => {
            const fmtT = iso => {
                if (!iso) return "Active Shift";
                const s = iso.endsWith("Z") ? iso : iso + "Z";
                return new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            };
            const name = r.applicant ? r.applicant.full_name : `User #${r.user_id}`;
            return `
                <tr class="hover:bg-[#F9FBFA]">
                    <td class="py-3 font-medium text-gray-900">${name}</td>
                    <td class="py-3 text-gray-600">${r.target_date}</td>
                    <td class="py-3 font-medium text-gray-800">${fmtT(r.requested_punch_in)} → ${fmtT(r.requested_punch_out)}</td>
                    <td class="py-3 text-gray-500 max-w-xs truncate">${r.reason}</td>
                    <td class="py-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${badges[r.status]}">${r.status}</span></td>
                    <td class="py-3 text-right space-x-2">
                        ${(canApprove && r.status === "PENDING") ? `
                            <button onclick="reviewRegAction(${r.id}, 'APPROVED')" class="px-2.5 py-1 rounded-lg bg-[#1E6B52] text-white text-[11px] hover:bg-[#15523E]">Approve</button>
                            <button onclick="reviewRegAction(${r.id}, 'REJECTED')" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] hover:bg-red-100">Reject</button>
                        ` : `<span class="text-[11px] text-gray-400">—</span>`}
                    </td>
                </tr>`;
        }).join("");
    } catch (err) {
        console.error(err);
    }
}

async function reviewRegAction(requestId, status) {
    try {
        await apiRequest(`/attendance/regularizations/${requestId}/review`, "PATCH", { status });
        await Promise.all([loadRegularizations(), loadTodayAttendance()]);
        if (todayAttendance) {
            document.getElementById("attTabHours").textContent = `${todayAttendance.total_hours} hrs logged`;
            document.getElementById("attTabTimer").textContent = document.getElementById("shiftTimerDisplay").textContent;
        }
    } catch (err) {
        alert(err.message);
    }
}