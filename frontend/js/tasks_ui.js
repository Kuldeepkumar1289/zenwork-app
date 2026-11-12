let selectedTaskId = null;
let currentTaskFilter = "ALL";

async function renderTasksSection() {
    const container = document.getElementById("section-dynamic");
    container.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900">Tasks</h1>
                <p class="text-xs text-gray-500 mt-0.5">All tasks. Clear ownership, real-time blockers, and attachments.</p>
            </div>
            <button onclick="openTaskModal()" class="bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition cursor-pointer">
                + Create task
            </button>
        </div>

        <div class="grid grid-cols-12 gap-5 items-start">
            <div class="col-span-8 bg-white rounded-2xl border border-[#E6ECE8] p-5">
                <div class="flex items-center justify-between border-b border-[#F0F4F2] pb-3 mb-4">
                    <div class="flex items-center gap-1.5 text-xs">
                        <button onclick="setTaskTabFilter('ALL')" id="tab-task-ALL" class="task-filter-btn px-3 py-1.5 rounded-lg bg-[#EBF3EF] text-[#1E6B52] font-medium">All tasks</button>
                        <button onclick="setTaskTabFilter('TODO')" id="tab-task-TODO" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">To Do</button>
                        <button onclick="setTaskTabFilter('IN_PROGRESS')" id="tab-task-IN_PROGRESS" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">In Progress</button>
                        <button onclick="setTaskTabFilter('BLOCKED')" id="tab-task-BLOCKED" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Blocked</button>
                        <button onclick="setTaskTabFilter('COMPLETED')" id="tab-task-COMPLETED" class="task-filter-btn px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Completed</button>
                    </div>
                    <span id="tasksTabTotal" class="text-[11px] text-gray-400">0 tasks</span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-[#F0F4F2] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                <th class="py-2.5">Task / Deliverable</th>
                                <th class="py-2.5">Priority</th>
                                <th class="py-2.5">Status</th>
                                <th class="py-2.5 text-right">Due</th>
                            </tr>
                        </thead>
                        <tbody id="masterTasksBody" class="divide-y divide-[#F0F4F2] text-xs">
                            <tr><td colspan="4" class="py-6 text-center text-gray-400">Loading tasks...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="taskDetailDrawer" class="col-span-4 bg-white rounded-2xl border border-[#E6ECE8] p-5 sticky top-0">
                <p class="text-xs text-gray-400 text-center py-10">Select any task from the left list to view details or report blockers.</p>
            </div>
        </div>
    `;

    await loadTasks();
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
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-gray-400">No tasks in this category.</td></tr>`;
        return;
    }

    if (!selectedTaskId || !filtered.find(t => t.id === selectedTaskId)) {
        selectedTaskId = filtered[0].id;
    }

    const statusColors = {
        "TODO": "bg-gray-100 text-gray-700",
        "IN_PROGRESS": "bg-amber-50 text-amber-700 border border-amber-200",
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

        return `
            <tr onclick="selectTaskDetail(${task.id})" class="cursor-pointer transition ${isSelected ? 'bg-[#F2F8F5]' : 'hover:bg-[#F9FBFA]'}">
                <td class="py-3.5 pr-2">
                    <p class="font-semibold text-gray-900">${task.title}</p>
                    <p class="text-[11px] text-gray-400 truncate max-w-xs">${task.description || 'No description provided'}</p>
                </td>
                <td class="py-3.5"><span class="px-2 py-0.5 rounded-md text-[10px] font-medium ${priorityBadges[task.priority]}">${task.priority}</span></td>
                <td class="py-3.5"><span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusColors[task.status]}">${task.status.replace("_", " ")}</span></td>
                <td class="py-3.5 text-right text-gray-500">${dueStr}</td>
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

    drawer.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">TASK #${task.id}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-[#F6F8F7] border border-[#E6ECE8] text-gray-600">${task.priority}</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 leading-snug">${task.title}</h3>
        <p class="text-xs text-gray-500 mt-2 leading-relaxed">${task.description || "No additional notes attached."}</p>

        <div class="mt-4 pt-4 border-t border-[#F0F4F2] space-y-2.5 text-xs">
            <div class="flex justify-between"><span class="text-gray-400">Assignee ID</span><span class="font-medium text-gray-800">User #${task.assigned_to_id || 'Unassigned'}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Status</span><span class="font-semibold text-[#1E6B52]">${task.status}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Deadline</span><span class="font-medium text-gray-800">${dueFull}</span></div>
        </div>

        <div class="mt-5 pt-4 border-t border-[#F0F4F2] space-y-2">
            ${task.status !== 'COMPLETED' ? `<button onclick="updateTaskStatusFromDrawer(${task.id}, 'COMPLETED')" class="w-full py-2.5 px-4 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold transition cursor-pointer">✓ Mark Complete</button>` : ''}
            ${task.status === 'TODO' ? `<button onclick="updateTaskStatusFromDrawer(${task.id}, 'IN_PROGRESS')" class="w-full py-2 px-4 rounded-xl bg-[#EBF3EF] text-[#1E6B52] text-xs font-semibold hover:bg-[#DCECE4] transition cursor-pointer">▶ Start Progress</button>` : ''}
            ${task.status !== 'BLOCKED' && task.status !== 'COMPLETED' ? `<button onclick="promptBlocker(${task.id})" class="w-full py-2 px-4 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition cursor-pointer">⚠ Report Blocker</button>` : ''}
        </div>
    `;
}

async function updateTaskStatusFromDrawer(taskId, newStatus) {
    try {
        await apiRequest(`/tasks/${taskId}/status`, "PATCH", { status: newStatus });
        await loadTasks();
        renderMasterTasksList();
    } catch (err) {
        alert(err.message);
    }
}

async function promptBlocker(taskId) {
    const reason = prompt("What is blocking this task?");
    if (!reason) return;
    try {
        await apiRequest(`/tasks/${taskId}/blocker`, "POST", { reason });
        await loadTasks();
        renderMasterTasksList();
    } catch (err) {
        alert(err.message);
    }
}