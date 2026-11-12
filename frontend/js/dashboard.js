let currentUser = null;
let allTasks = [];
let todayAttendance = null;

// Initialize Dashboard on Page Load
document.addEventListener("DOMContentLoaded", async () => {
    if (!getAuthToken()) {
        window.location.href = "login.html";
        return;
    }

    setupHeaderDate();
    renderMiniCalendar();

    try {
        // 1. Fetch Logged-in User Profile
        currentUser = await apiRequest("/users/me");
        localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
        renderUserProfile(currentUser);

        // 2. Load Dashboard Data in Parallel
        await Promise.all([
            loadTasks(),
            loadTodayAttendance(),
            loadNotices(),
            loadPerformance(),
            loadMeetings()
        ]);
    } catch (err) {
        console.error("Initialization error:", err);
    }
});

function setupHeaderDate() {
    const now = new Date();
    const options = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById("headerDate").textContent = now.toLocaleDateString('en-US', options);
}

function renderUserProfile(user) {
    const firstName = user.full_name.split(" ")[0];
    document.getElementById("greetingText").textContent = `Good morning, ${firstName}`;
    document.getElementById("sidebarUserName").textContent = user.full_name;
    document.getElementById("sidebarUserRole").textContent = `${user.designation} (${user.role_tier})`;
    document.getElementById("sidebarAvatar").textContent = firstName[0].toUpperCase();

    // Show Super Admin Navigation if role_tier === ADMIN
    if (user.role_tier === "ADMIN") {
        document.getElementById("adminNavSection").classList.remove("hidden");
    }
}

// ================= TASKS ENGINE =================
async function loadTasks() {
    try {
        // Backend  tasks endpoint  fetch
        let response = await apiRequest("/tasks/");
        // if paginated object returns  ({items: [...]}) so handle 
        allTasks = Array.isArray(response) ? response : (response.items || []);

        document.getElementById("taskCountBadge").textContent = allTasks.length;
        const completedCount = allTasks.filter(t => t.status === "COMPLETED").length;
        document.getElementById("statCompletedTasks").textContent = completedCount;

        renderTasksTable(allTasks);
    } catch (err) {
        console.error("Tasks load error:", err);
        document.getElementById("dashboardTasksBody").innerHTML =
            `<tr><td colspan="5" class="py-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

function renderTasksTable(tasks) {
    const tbody = document.getElementById("dashboardTasksBody");
    if (!tasks.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400">No tasks assigned yet. Click "+ Create new" to start.</td></tr>`;
        return;
    }

    tbody.innerHTML = tasks.map(task => {
        const statusColors = {
            "TODO": "bg-gray-100 text-gray-700",
            "IN_PROGRESS": "bg-amber-50 text-amber-700 border border-amber-200",
            "BLOCKED": "bg-red-50 text-red-700 border border-red-200",
            "COMPLETED": "bg-[#E6F4EA] text-[#1E6B52]"
        };

        const priorityColors = {
            "LOW": "text-gray-500",
            "MEDIUM": "text-blue-600",
            "HIGH": "text-amber-600 font-semibold",
            "CRITICAL": "text-red-600 font-bold"
        };

        const dueStr = task.due_date ? new Date(task.due_date).toLocaleDateString() : "No deadline";

        return `
            <tr class="hover:bg-[#F9FBFA] transition">
                <td class="py-3 font-medium text-gray-900">${task.title}</td>
                <td class="py-3 ${priorityColors[task.priority] || ''}">${task.priority}</td>
                <td class="py-3">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusColors[task.status] || ''}">
                        ${task.status.replace("_", " ")}
                    </span>
                </td>
                <td class="py-3 text-gray-500">${dueStr}</td>
                <td class="py-3 text-right">
                    ${task.status !== "COMPLETED" 
                        ? `<button onclick="markTaskDone(${task.id})" class="text-[11px] font-medium text-[#1E6B52] hover:underline">Mark Done</button>`
                        : `<span class="text-[11px] text-gray-400">✓ Done</span>`
                    }
                </td>
            </tr>
        `;
    }).join("");
}

function filterDashboardTasks(status) {
    if (status === "ALL") {
        renderTasksTable(allTasks);
    } else {
        renderTasksTable(allTasks.filter(t => t.status === status));
    }
}

async function markTaskDone(taskId) {
    try {
        await apiRequest(`/tasks/${taskId}/status`, "PATCH", { status: "COMPLETED" });
        await loadTasks();
    } catch (err) {
        alert("Could not update task: " + err.message);
    }
}

// ================= ATTENDANCE & SHIFT TIMER =================
async function loadTodayAttendance() {
    try {
        todayAttendance = await apiRequest("/attendance/me/today");
        const btn = document.getElementById("punchActionBtn");
        const timerDisplay = document.getElementById("shiftTimerDisplay");
        const statusLabel = document.getElementById("shiftStatusLabel");
        const pulseDot = document.getElementById("livePulseDot");

        if (!todayAttendance) {
            btn.textContent = "Check in";
            btn.className = "w-full py-2.5 px-4 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold transition cursor-pointer";
            statusLabel.textContent = "Not checked in";
        } else if (todayAttendance && !todayAttendance.punch_out) {
            btn.textContent = "Check out";
            btn.className = "w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer";
            pulseDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
            
            const punchInTime = new Date(todayAttendance.punch_in + "Z");
            const diffMins = Math.floor((new Date() - punchInTime) / 60000);
            const hrs = String(Math.floor(diffMins / 60)).padStart(2, '0');
            const mins = String(diffMins % 60).padStart(2, '0');
            timerDisplay.textContent = `${hrs}:${mins}`;
            statusLabel.textContent = "Checked in • Active";
            document.getElementById("statAttBadge").textContent = "PRESENT";
            document.getElementById("statAttBadge").className = "text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#1E6B52]";
        } else {
            btn.textContent = "Shift Completed";
            btn.disabled = true;
            btn.className = "w-full py-2.5 px-4 rounded-xl bg-gray-200 text-gray-500 text-xs font-semibold cursor-not-allowed";
            timerDisplay.textContent = `${todayAttendance.total_hours}h`;
            statusLabel.textContent = `Status: ${todayAttendance.status}`;
            document.getElementById("statHours").textContent = `${todayAttendance.total_hours}h`;
            document.getElementById("statAttBadge").textContent = todayAttendance.status;
        }
    } catch (err) {
        console.error("Attendance fetch error", err);
    }
}

async function handlePunchToggle() {
    try {
        if (!todayAttendance) {
            await apiRequest("/attendance/punch-in", "POST", { notes: "Checked in via Zenwork Web UI" });
        } else if (!todayAttendance.punch_out) {
            await apiRequest("/attendance/punch-out", "POST", { notes: "Checked out via Zenwork Web UI" });
        }
        await loadTodayAttendance();
    } catch (err) {
        alert(err.message);
    }
}

// ================= NOTICES, ANALYTICS & MEETINGS =================
async function loadNotices() {
    try {
        const notices = await apiRequest("/communications/");
        const feed = document.getElementById("noticesFeed");
        if (!notices.length) {
            feed.innerHTML = `<p class="text-gray-400">No announcements posted yet.</p>`;
            return;
        }
        feed.innerHTML = notices.slice(0, 3).map(n => `
            <div class="p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8]">
                <p class="font-semibold text-gray-800">${n.title}</p>
                <p class="text-gray-500 mt-0.5 line-clamp-2">${n.content}</p>
            </div>
        `).join("");
    } catch (e) {}
}

async function loadPerformance() {
    try {
        const perf = await apiRequest("/analytics/me");
        if (perf && perf.overall_score !== undefined) {
            document.getElementById("statPerformance").textContent = `${Math.round(perf.overall_score)}%`;
            document.getElementById("analyticsBigScore").textContent = `${Math.round(perf.overall_score)}%`;
        }
    } catch (e) {}
}

async function loadMeetings() {
    try {
        const events = await apiRequest("/calendar/events");
        const container = document.getElementById("upcomingMeetingsList");
        if (!events || !events.length) return;

        container.innerHTML = events.slice(0, 3).map(ev => `
            <div class="p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8]">
                <p class="font-semibold text-gray-900">${ev.title}</p>
                <p class="text-[11px] text-gray-500 mt-0.5">${new Date(ev.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </div>
        `).join("");
    } catch (e) {}
}

// ================= MINI CALENDAR =================
function renderMiniCalendar() {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const today = now.getDate();
    const container = document.getElementById("miniCalDays");

    let html = "";
    for (let d = 1; d <= daysInMonth; d++) {
        if (d === today) {
            html += `<span class="w-6 h-6 mx-auto flex items-center justify-center rounded-full bg-[#1E6B52] text-white font-semibold">${d}</span>`;
        } else {
            html += `<span class="py-1 text-gray-700">${d}</span>`;
        }
    }
    container.innerHTML = html;
}

// ================= MODAL & NAVIGATION =================
function openTaskModal() {
    document.getElementById("taskModal").classList.remove("hidden");
}

function closeTaskModal() {
    document.getElementById("taskModal").classList.add("hidden");
}

document.getElementById("createTaskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById("taskTitle").value,
        description: document.getElementById("taskDesc").value,
        priority: document.getElementById("taskPriority").value,
        assigned_to_id: parseInt(document.getElementById("taskAssigneeId").value),
        due_date: new Date(document.getElementById("taskDueDate").value).toISOString()
    };

    try {
        await apiRequest("/tasks/", "POST", payload);
        closeTaskModal();
        document.getElementById("createTaskForm").reset();
        await loadTasks();
    } catch (err) {
        alert("Error creating task: " + err.message);
    }
});

function switchSection(sectionName) {
    // Highlight active nav item
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.remove("bg-[#EBF3EF]", "text-[#1E6B52]");
        btn.classList.add("text-gray-600");
    });
    const activeBtn = document.getElementById(`nav-${sectionName}`);
    if (activeBtn) {
        activeBtn.classList.add("bg-[#EBF3EF]", "text-[#1E6B52]");
        activeBtn.classList.remove("text-gray-600");
    }

    document.getElementById("breadcrumbTitle").textContent = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);

    if (sectionName === "dashboard") {
        document.getElementById("section-dashboard").classList.remove("hidden");
        document.getElementById("section-dynamic").classList.add("hidden");
    } else if (sectionName === "attendance") {
        document.getElementById("section-dashboard").classList.add("hidden");
        document.getElementById("section-dynamic").classList.remove("hidden");
        renderAttendanceSection();
    } else if (sectionName === "tasks") {
        document.getElementById("section-dashboard").classList.add("hidden");
        document.getElementById("section-dynamic").classList.remove("hidden");
        renderTasksSection();
    } else if (sectionName === "admin") {
        document.getElementById("section-dashboard").classList.add("hidden");
        document.getElementById("section-dynamic").classList.remove("hidden");
        renderAdminSection();
    } else {
        document.getElementById("section-dashboard").classList.add("hidden");
        const dyn = document.getElementById("section-dynamic");
        dyn.classList.remove("hidden");
        dyn.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-[#E6ECE8]">
            <h2 class="text-lg font-semibold text-gray-900 capitalize">${sectionName} Workspace</h2>
            <p class="text-xs text-gray-500 mt-1">Module view ready to connect.</p>
        </div>`;
    }
}