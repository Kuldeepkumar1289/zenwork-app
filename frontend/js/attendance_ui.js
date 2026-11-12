async function renderAttendanceSection() {
    const container = document.getElementById("section-dynamic");
    container.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900">Attendance & Time Off</h1>
                <p class="text-xs text-gray-500 mt-0.5">Track work sessions, apply for Leaves or Work From Home (WFH).</p>
            </div>
            <button onclick="openLeaveModal()" class="bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition cursor-pointer">
                + Apply Leave / WFH
            </button>
        </div>

        <!-- 4 KPI Cards (Screen 04 Top Row) -->
        <div class="grid grid-cols-4 gap-4">
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#1E6B52]">Today's Shift</span>
                <p id="attTabTimer" class="text-2xl font-bold text-gray-900 mt-2">00h 00m</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Target: 8h 00m</p>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-xs text-gray-500">Logged Hours</p>
                <p id="attTabHours" class="text-2xl font-semibold text-gray-900 mt-2">0.0 hrs</p>
                <p class="text-[11px] text-[#1E6B52] mt-0.5">Verified session</p>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-xs text-gray-500">WFH / Leave Requests</p>
                <p id="attTabLeaveCount" class="text-2xl font-semibold text-gray-900 mt-2">0</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Total submitted</p>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-[#E6ECE8]">
                <p class="text-xs text-gray-500">Work Mode</p>
                <p id="attTabMode" class="text-2xl font-semibold text-[#1E6B52] mt-2">Office</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Active workspace status</p>
            </div>
        </div>

        <!-- Leave & WFH Requests Table -->
        <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-semibold text-gray-900">Leave & Work From Home (WFH) Requests</h2>
                <span class="text-xs text-gray-400">Manager & Admin Approval Queue</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[#F0F4F2] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            <th class="py-2.5">Applicant</th>
                            <th class="py-2.5">Type</th>
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

        <!-- Apply Leave / WFH Modal -->
        <div id="leaveModal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
            <div class="bg-white rounded-2xl border border-[#E6ECE8] w-full max-w-md p-6 shadow-xl">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-base font-semibold text-gray-900">Apply for Leave or WFH</h3>
                    <button onclick="closeLeaveModal()" class="text-gray-400 hover:text-gray-700 text-lg">&times;</button>
                </div>
                <form id="applyLeaveForm" class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-medium text-gray-700 mb-1">Request Type</label>
                        <select id="leaveType" class="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#1E6B52] focus:outline-none">
                            <option value="WFH">Work From Home (WFH)</option>
                            <option value="CASUAL">Casual Leave</option>
                            <option value="SICK">Sick Leave</option>
                            <option value="EARNED">Earned Leave</option>
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
                        <button type="submit" class="px-4 py-2 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-medium">Submit Request</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Bind Form Submit
    document.getElementById("applyLeaveForm").addEventListener("submit", handleLeaveSubmit);

    // Sync Today's Hours
    if (todayAttendance) {
        document.getElementById("attTabHours").textContent = `${todayAttendance.total_hours} hrs`;
        document.getElementById("attTabTimer").textContent = document.getElementById("shiftTimerDisplay").textContent;
    }

    await loadLeavesData();
}

function openLeaveModal() {
    document.getElementById("leaveModal").classList.remove("hidden");
}

function closeLeaveModal() {
    document.getElementById("leaveModal").classList.add("hidden");
}

async function handleLeaveSubmit(e) {
    e.preventDefault();
    const payload = {
        leave_type: document.getElementById("leaveType").value,
        start_date: document.getElementById("leaveStartDate").value,
        end_date: document.getElementById("leaveEndDate").value,
        reason: document.getElementById("leaveReason").value
    };

    try {
        await apiRequest("/attendance/leaves", "POST", payload);
        closeLeaveModal();
        await loadLeavesData();
    } catch (err) {
        alert("Failed to submit: " + err.message);
    }
}

async function loadLeavesData() {
    try {
        const leaves = await apiRequest("/attendance/leaves");
        document.getElementById("attTabLeaveCount").textContent = leaves.length;

        // Check if user has an approved WFH today
        const todayStr = new Date().toISOString().split("T")[0];
        const activeWfh = leaves.find(l => l.leave_type === "WFH" && l.status === "APPROVED" && l.start_date <= todayStr && l.end_date >= todayStr);
        if (activeWfh) {
            document.getElementById("attTabMode").textContent = "WFH (Remote)";
        }

        const tbody = document.getElementById("leavesTableBody");
        if (!leaves.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-400">No leave or WFH requests yet.</td></tr>`;
            return;
        }

        const canApprove = currentUser && (currentUser.role_tier === "ADMIN" || currentUser.role_tier === "MANAGER");

        tbody.innerHTML = leaves.map(item => {
            const statusBadges = {
                "PENDING": "bg-amber-50 text-amber-700 border border-amber-200",
                "APPROVED": "bg-[#E6F4EA] text-[#1E6B52]",
                "REJECTED": "bg-red-50 text-red-700"
            };
            const typeBadge = item.leave_type === "WFH"
                ? `<span class="px-2 py-0.5 rounded-md bg-[#EBF3EF] text-[#1E6B52] font-semibold">WFH</span>`
                : `<span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">${item.leave_type}</span>`;

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
    } catch (err) {
        console.error(err);
    }
}

async function reviewLeaveAction(requestId, status) {
    try {
        await apiRequest(`/attendance/leaves/${requestId}/review`, "PATCH", { status });
        await loadLeavesData();
    } catch (err) {
        alert(err.message);
    }
}