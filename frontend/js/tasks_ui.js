let selectedTaskId = null;
let currentTaskFilter = "ALL";

async function renderTasksSection() {
    const container = document.getElementById("section-dynamic");
    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900">Tasks</h1>
                <p class="text-xs text-gray-500 mt-0.5">All tasks. Clear ownership, completion reports, and TL/Manager sign-off.</p>
            </div>
            <button onclick="openTaskModal()" class="bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition cursor-pointer">
                + Create task
            </button>
        </div>

        <div class="grid grid-cols-12 gap-4 sm:gap-5 items-start">
            <div class="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5">
                <div class="flex items-center justify-between flex-wrap gap-2 border-b border-[#F0F4F2] pb-3 mb-4">
                    <div class="flex items-center gap-1.5 flex-wrap text-xs">
                        <button onclick="setTaskTabFilter('ALL')" id="tab-task-ALL" class="task-filter-btn px-3 py-1.5 rounded-lg bg-[#EBF3EF] text-[#1E6B52] font-medium">All tasks</button>
                        <button onclick="setTaskTabFilter('TODO')" id="tab-task-TODO" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">To Do</button>
                        <button onclick="setTaskTabFilter('IN_PROGRESS')" id="tab-task-IN_PROGRESS" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">In Progress</button>
                        <button onclick="setTaskTabFilter('PENDING_REVIEW')" id="tab-task-PENDING_REVIEW" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Pending Review</button>
                        <button onclick="setTaskTabFilter('BLOCKED')" id="tab-task-BLOCKED" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Blocked</button>
                        <button onclick="setTaskTabFilter('COMPLETED')" id="tab-task-COMPLETED" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Completed</button>
                    </div>
                    <span id="tasksTabTotal" class="text-[11px] text-gray-400">0 tasks</span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full min-w-[540px] text-left border-collapse">
                        <thead>
                            <tr class="border-b border-[#F0F4F2] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                <th class="py-2.5 pr-2">Task / Deliverable</th>
                                <th class="py-2.5 pr-2">Assignee &amp; Live Status</th>
                                <th class="py-2.5 pr-2">Priority</th>
                                <th class="py-2.5 pr-2">Status</th>
                                <th class="py-2.5 text-right">Due</th>
                            </tr>
                        </thead>
                        <tbody id="masterTasksBody" class="divide-y divide-[#F0F4F2] text-xs">
                            <tr><td colspan="5" class="py-6 text-center text-gray-400">Loading tasks...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="taskDetailDrawer" class="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5 lg:sticky lg:top-0">
                <p class="text-xs text-gray-400 text-center py-10">Select any task from the list to view details, submit reports, or review completion.</p>
            </div>
        </div>
    `;

    await Promise.all([
        loadTasks(),
        window.LivePresence ? window.LivePresence.refresh() : Promise.resolve()
    ]);
    renderMasterTasksList();
}

function setTaskTabFilter(status) {
    currentTaskFilter = status;
    document.querySelectorAll(".task-filter-btn").forEach(btn => {
        btn.classList.remove("bg-[#EBF3EF]", "text-[#1E6B52]", "font-medium");
        btn.classList.add("text-gray-500");
    });
    const active = document.getElementById(`tab-task-${status}`);
    if (active) {
        active.classList.add("bg-[#EBF3EF]", "text-[#1E6B52]", "font-medium");
        active.classList.remove("text-gray-500");
    }
    renderMasterTasksList();
}

function renderMasterTasksList() {
    const tbody = document.getElementById("masterTasksBody");
    if (!tbody) return;

    const filtered = currentTaskFilter === "ALL" ? allTasks : allTasks.filter(t => t.status === currentTaskFilter);
    document.getElementById("tasksTabTotal").textContent = `${filtered.length} tasks`;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-400">No tasks in this category.</td></tr>`;
        return;
    }

    if (!selectedTaskId || !filtered.find(t => t.id === selectedTaskId)) {
        selectedTaskId = filtered[0].id;
    }

    const statusColors = {
        "TODO": "bg-gray-100 text-gray-700",
        "IN_PROGRESS": "bg-amber-50 text-amber-700 border border-amber-200",
        "PENDING_REVIEW": "bg-sky-50 text-sky-700 border border-sky-200",
        "BLOCKED": "bg-red-50 text-red-700 border border-red-200",
        "COMPLETED": "bg-[#E6F4EA] text-[#1E6B52]"
    };

    const priorityBadges = {
        "LOW": "bg-gray-50 text-gray-600",
        "MEDIUM": "bg-blue-50 text-blue-700",
        "HIGH": "bg-amber-50 text-amber-700",
        "CRITICAL": "bg-red-50 text-red-700 font-semibold"
    };

    tbody.innerHTML = filtered.map(task => {
        const isSelected = task.id === selectedTaskId;
        const dueStr = task.due_date ? new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "—";
        const assigneeLabel = task.assigned_to_id && window.LivePresence
            ? window.LivePresence.formatNameWithId(task.assignee || task.assigned_to_id)
            : (task.assigned_to_id ? `User #${task.assigned_to_id}` : "Unassigned");
        const livePill = task.assigned_to_id && window.LivePresence
            ? window.LivePresence.badgeHtml(task.assigned_to_id, true)
            : "";

        return `
            <tr onclick="selectTaskDetail(${task.id})" class="cursor-pointer transition ${isSelected ? 'bg-[#F2F8F5]' : 'hover:bg-[#F9FBFA]'}">
                <td class="py-3.5 pr-2">
                    <p class="font-semibold text-gray-900">${esc(task.title)}</p>
                    <p class="text-[11px] text-gray-400 truncate max-w-[180px] sm:max-w-xs">${esc(task.description || 'No description provided')}</p>
                </td>
                <td class="py-3.5 pr-2">
                    <p class="font-medium text-gray-800 whitespace-nowrap">${esc(assigneeLabel)}</p>
                    <div class="mt-0.5">${livePill}</div>
                </td>
                <td class="py-3.5 pr-2 whitespace-nowrap"><span class="px-2 py-0.5 rounded-md text-[10px] font-medium ${priorityBadges[task.priority] || ''}">${esc(task.priority)}</span></td>
                <td class="py-3.5 pr-2 whitespace-nowrap"><span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusColors[task.status] || ''}">${esc(task.status.replace("_", " "))}</span></td>
                <td class="py-3.5 text-right text-gray-500 whitespace-nowrap">${dueStr}</td>
            </tr>
        `;
    }).join("");

    renderTaskDetailDrawer(selectedTaskId);
}

function selectTaskDetail(taskId) {
    selectedTaskId = taskId;
    renderMasterTasksList();
}

function renderTaskDetailDrawer(taskId) {
    const drawer = document.getElementById("taskDetailDrawer");
    const task = allTasks.find(t => t.id === taskId);
    if (!drawer || !task) return;

    const dueFull = task.due_date ? new Date(task.due_date).toLocaleString() : "No deadline";
    const role = currentUser?.role_tier;
    const isReviewer = Boolean(role && ["TEAM_LEAD", "MANAGER"].includes(role));
    const isExecutor = Boolean(role && ["MEMBER", "INTERN"].includes(role));

    const assigneeText = task.assigned_to_id && window.LivePresence
        ? window.LivePresence.formatNameWithId(task.assignee || task.assigned_to_id)
        : (task.assigned_to_id ? `User #${task.assigned_to_id}` : "Unassigned");
    const assigneeStatusBadge = task.assigned_to_id && window.LivePresence
        ? window.LivePresence.badgeHtml(task.assigned_to_id)
        : "";

    drawer.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">TASK #${task.id}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-[#F6F8F7] border border-[#E6ECE8] text-gray-600">${esc(task.priority)}</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 leading-snug">${esc(task.title)}</h3>
        <p class="text-xs text-gray-500 mt-2 leading-relaxed">${esc(task.description || "No additional notes attached.")}</p>

        <div class="mt-4 pt-4 border-t border-[#F0F4F2] space-y-2.5 text-xs">
            <div class="flex justify-between items-center gap-2">
                <span class="text-gray-400">Assignee</span>
                <span class="font-medium text-gray-800 text-right">${esc(assigneeText)}</span>
            </div>
            ${assigneeStatusBadge ? `<div class="flex justify-between items-center gap-2"><span class="text-gray-400">Live Status</span><span>${assigneeStatusBadge}</span></div>` : ""}
            <div class="flex justify-between"><span class="text-gray-400">Task Status</span><span class="font-semibold text-[#1E6B52]">${esc(task.status.replace("_", " "))}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Deadline</span><span class="font-medium text-gray-800">${dueFull}</span></div>
            ${task.completion_report ? `
                <div class="p-2.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8]">
                    <span class="block text-[10px] font-semibold text-gray-500 mb-1">Submitted Work Report</span>
                    <p class="text-gray-800">${esc(task.completion_report)}</p>
                </div>` : ""}
            ${task.review_notes ? `
                <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span class="block text-[10px] font-semibold text-amber-800 mb-1">TL / Manager Review Note</span>
                    <p class="text-amber-900">${esc(task.review_notes)}</p>
                </div>` : ""}
        </div>

        <div class="mt-5 pt-4 border-t border-[#F0F4F2] space-y-2">
            ${task.status === 'TODO' ? `
                <button onclick="updateTaskStatusFromDrawer(${task.id}, 'IN_PROGRESS')" class="w-full py-2 px-4 rounded-xl bg-[#EBF3EF] text-[#1E6B52] text-xs font-semibold hover:bg-[#DCECE4] transition cursor-pointer">
                    ▶ Start Progress
                </button>` : ''}

            ${isExecutor && task.status !== 'COMPLETED' ? `
                <textarea id="taskReportInput-${task.id}" rows="2" placeholder="Summarize what you completed for TL/Manager review..."
                    class="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs">${esc(task.completion_report || "")}</textarea>
                <button onclick="submitTaskReportForReview(${task.id})" class="w-full py-2.5 px-4 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold transition cursor-pointer">
                    Submit Report for Review
                </button>` : ''}

            ${isReviewer && task.status !== 'COMPLETED' ? `
                <textarea id="taskReviewNoteInput-${task.id}" rows="2" placeholder="Optional review note or revision feedback..."
                    class="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs">${esc(task.review_notes || "")}</textarea>
                <button onclick="reviewTaskCompletionAction(${task.id}, 'COMPLETED')" class="w-full py-2.5 px-4 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold transition cursor-pointer">
                    ✓ Approve &amp; Mark Completed
                </button>
                <button onclick="reviewTaskCompletionAction(${task.id}, 'IN_PROGRESS')" class="w-full py-2 px-4 rounded-xl bg-[#EBF3EF] text-[#1E6B52] text-xs font-semibold hover:bg-[#DCECE4] transition cursor-pointer">
                    ↩ Request Revision
                </button>` : ''}

            ${!isExecutor && !isReviewer && task.status !== 'COMPLETED' ? `
                <p class="text-[11px] text-gray-400 text-center py-1">Task completion &amp; report sign-off is handled by Team Lead / Manager.</p>` : ''}

            ${task.status !== 'BLOCKED' && task.status !== 'COMPLETED' ? `
                <button onclick="promptBlocker(${task.id})" class="w-full py-2 px-4 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition cursor-pointer">
                    ⚠ Report Blocker
                </button>` : ''}
        </div>
    `;
}

async function submitTaskReportForReview(taskId) {
    const reportEl = document.getElementById(`taskReportInput-${taskId}`);
    const report = reportEl ? reportEl.value.trim() : "";
    if (!report) {
        if (typeof showToast === "function") showToast("Please write a completion report first.", "error");
        else alert("Please write a completion report first.");
        return;
    }
    try {
        await apiRequest(`/tasks/${taskId}/status`, "PATCH", {
            status: "PENDING_REVIEW",
            completion_report: report
        });
        if (typeof showToast === "function") showToast("Report submitted for TL / Manager review.", "success");
        await loadTasks();
        renderMasterTasksList();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message, "error");
        else alert(err.message);
    }
}

async function reviewTaskCompletionAction(taskId, targetStatus) {
    const noteEl = document.getElementById(`taskReviewNoteInput-${taskId}`);
    const reviewNotes = noteEl ? noteEl.value.trim() : "";
    try {
        await apiRequest(`/tasks/${taskId}/status`, "PATCH", {
            status: targetStatus,
            review_notes: reviewNotes || null
        });
        if (typeof showToast === "function") {
            showToast(targetStatus === "COMPLETED" ? "Task approved & completed!" : "Sent back for revision.", "success");
        }
        await loadTasks();
        renderMasterTasksList();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message, "error");
        else alert(err.message);
    }
}

async function updateTaskStatusFromDrawer(taskId, newStatus) {
    try {
        await apiRequest(`/tasks/${taskId}/status`, "PATCH", { status: newStatus });
        await loadTasks();
        renderMasterTasksList();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message, "error");
        else alert(err.message);
    }
}

async function promptBlocker(taskId) {
    const reason = prompt("What is blocking this task?");
    if (!reason) return;
    try {
        await apiRequest(`/tasks/${taskId}/block`, "POST", { reason });
        await loadTasks();
        renderMasterTasksList();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message, "error");
        else alert(err.message);
    }
}