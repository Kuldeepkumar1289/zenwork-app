// =============================================================
// GLOBAL STATE VARIABLES (Data stored in memory for fast UI)
// =============================================================
let currentUser = null;
let allTasks = [];
let todayAttendance = null;

// =============================================================
// 1. APP STARTUP: Runs automatically when index.html opens
// =============================================================
document.addEventListener("DOMContentLoaded", async () => {
    // Check if user is logged in; if not, go to login page
    if (!getAuthToken()) {
        window.location.href = "login.html";
        return;
    }

    setTodayDate();
    drawMiniCalendar();

    try {
        // Step A: Fetch current logged-in user details from backend
        currentUser = await apiRequest("/users/me");
        localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
        updateProfileUI(currentUser);

        // Step B: Load all dashboard widgets at the same time
        await Promise.all([
            loadTasks(),
            loadTodayAttendance(),
            loadAnnouncements(),
            loadPerformanceStats(),
            loadOpenQueriesCount()
        ]);
    } catch (err) {
        console.error("Dashboard startup error:", err);
    }
});

// Sets current date in top-right badge (e.g., "Thu, 12 November 2026")
function setTodayDate() {
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
    });
    document.getElementById("headerDate").textContent = formatted;
}

// Updates user name, designation, and shows Admin tab if user is ADMIN
function updateProfileUI(user) {
    const firstName = user.full_name.split(" ")[0];
    const hr = new Date().getHours();
    const hello = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 20 ? "Good evening" : "Good night";
    document.getElementById("greetingText").textContent = `${hello}, ${firstName}`;
    document.getElementById("topUserName").textContent = user.full_name;
    document.getElementById("topUserRole").textContent = user.designation;
    document.getElementById("topAvatar").textContent = firstName[0].toUpperCase();

    if (user.role_tier === "ADMIN") {
        document.getElementById("adminNavSection").classList.remove("hidden");
    }
}

// =============================================================
// 2. TASKS TABLE & FILTERING
// =============================================================
async function loadTasks() {
    try {
        const response = await apiRequest("/tasks/");
        allTasks = Array.isArray(response) ? response : (response.items || []);

        // Update KPI numbers
        const completed = allTasks.filter(t => t.status === "COMPLETED").length;
        document.getElementById("taskCountBadge").textContent = allTasks.length;
        document.getElementById("statCompletedTasks").textContent = completed;
        document.getElementById("statTotalTasksSub").textContent = `of ${allTasks.length} assigned`;

        renderTasksTable(allTasks);

        // Show today's deadlines as dots on the sky arc (sky.js)
        if (window.DaylightSky) {
            const todayStr = new Date().toDateString();
            DaylightSky.setMarkers(allTasks
                .filter(t => t.due_date && new Date(t.due_date).toDateString() === todayStr)
                .map(t => {
                    const d = new Date(t.due_date);
                    return { label: t.title, hour: d.getHours() + d.getMinutes() / 60, done: t.status === "COMPLETED" };
                }));
        }
    } catch (err) {
        document.getElementById("dashboardTasksBody").innerHTML =
            `<tr><td colspan="5" class="py-4 text-center text-red-500">Could not load tasks</td></tr>`;
    }
}

function renderTasksTable(tasksList) {
    const tbody = document.getElementById("dashboardTasksBody");

    if (!tasksList.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400">No tasks found. Click "+ Create new" to add one.</td></tr>`;
        return;
    }

    const statusStyles = {
        "TODO": "bg-gray-100 text-gray-600",
        "IN_PROGRESS": "bg-[#FEF7E0] text-amber-700",
        "BLOCKED": "bg-red-50 text-red-600",
        "COMPLETED": "bg-[#E6F4EA] text-[#1E6B52]"
    };

    tbody.innerHTML = tasksList.map(task => {
        const isDone = task.status === "COMPLETED";
        const dueText = task.due_date ? new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "Today";

        return `
            <tr class="hover:bg-[#F9FBFA] transition">
                <td class="py-3 flex items-center gap-2.5">
                    <input type="checkbox" ${isDone ? "checked disabled" : ""} onchange="markTaskDone(${task.id})"
                        class="w-4 h-4 rounded accent-[#1E6B52] cursor-pointer">
                    <span class="font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}">${task.title}</span>
                </td>
                <td class="py-3 text-gray-500">${task.priority}</td>
                <td class="py-3">
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-semibold ${statusStyles[task.status] || ''}">
                        ${task.status.replace("_", " ")}
                    </span>
                </td>
                <td class="py-3 text-amber-700 font-medium">${dueText}</td>
                <td class="py-3 text-right">
                    ${!isDone
                        ? `<button onclick="markTaskDone(${task.id})" class="text-[11px] font-medium text-[#1E6B52] hover:underline">Complete</button>`
                        : `<span class="text-[11px] text-gray-400">✓ Done</span>`
                    }
                </td>
            </tr>
        `;
    }).join("");
}

// Handles clicking "Upcoming", "In progress", or "Completed" tabs
function filterDashboardTasks(status, clickedBtn) {
    document.querySelectorAll(".dash-tab").forEach(tab => {
        tab.classList.remove("font-semibold", "text-gray-900", "border-b-2", "border-[#1E6B52]");
        tab.classList.add("font-medium", "text-gray-400");
    });
    clickedBtn.classList.add("font-semibold", "text-gray-900", "border-b-2", "border-[#1E6B52]");
    clickedBtn.classList.remove("font-medium", "text-gray-400");

    if (status === "ALL") {
        renderTasksTable(allTasks);
    } else {
        renderTasksTable(allTasks.filter(t => t.status === status));
    }
}

// Live search filter from top header input
function handleSearchFilter(query) {
    const q = query.toLowerCase();
    const filtered = allTasks.filter(t => t.title.toLowerCase().includes(q));
    renderTasksTable(filtered);
}

async function markTaskDone(taskId) {
    try {
        await apiRequest(`/tasks/${taskId}/status`, "PATCH", { status: "COMPLETED" });
        await loadTasks();
    } catch (err) {
        alert(err.message);
    }
}

// =============================================================
// 3. ATTENDANCE & SHIFT TIMER (Right Utility Panel)
// =============================================================
let shiftTimerInterval = null;

async function loadTodayAttendance() {
    try {
        todayAttendance = await apiRequest("/attendance/me/today");
        const btn = document.getElementById("punchActionBtn");
        const timerDisplay = document.getElementById("shiftTimerDisplay");
        const statusLabel = document.getElementById("shiftStatusLabel");
        const pulseDot = document.getElementById("livePulseDot");

        if (shiftTimerInterval) clearInterval(shiftTimerInterval);

        if (!todayAttendance) {
            btn.textContent = "Check in";
            statusLabel.textContent = "Not checked in";
        } else if (!todayAttendance.punch_out) {
            btn.textContent = "Check out";
            pulseDot.className = "w-1.5 h-1.5 rounded-full bg-[#1E6B52] animate-pulse";
            statusLabel.textContent = "Checked in";

            // Parse timestamp safely without forcing +5:30 UTC offset
            const rawStr = todayAttendance.punch_in.replace("Z", "");
            const punchIn = new Date(rawStr);

            const updateClock = () => {
                const diffMs = Math.max(0, Date.now() - punchIn.getTime());
                const totalMins = Math.floor(diffMs / 60000);
                const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
                const mm = String(totalMins % 60).padStart(2, '0');

                timerDisplay.textContent = `${hh}:${mm}`;
                document.getElementById("statHours").textContent = `${hh}:${mm}`;
                document.getElementById("statAttBadge").textContent = "Active";
            };

            updateClock();
            shiftTimerInterval = setInterval(updateClock, 30000); // Update every 30s
        } else {
            btn.textContent = "Shift Completed";
            btn.disabled = true;
            btn.className = "btn wide opacity-60 cursor-not-allowed";
            timerDisplay.textContent = `${todayAttendance.total_hours}h`;
            statusLabel.textContent = todayAttendance.status;
            document.getElementById("statHours").textContent = `${todayAttendance.total_hours}h`;
            document.getElementById("statAttBadge").textContent = todayAttendance.status;
        }
    } catch (e) {}
}

async function handlePunchToggle() {
    try {
        if (!todayAttendance) {
            await apiRequest("/attendance/punch-in", "POST", { notes: "Checked in via Zenwork" });
        } else if (!todayAttendance.punch_out) {
            await apiRequest("/attendance/punch-out", "POST", { notes: "Checked out via Zenwork" });
        }
        await loadTodayAttendance();
    } catch (err) {
        alert(err.message);
    }
}

// =============================================================
// 4. ANNOUNCEMENTS, PERFORMANCE & QUERIES COUNT
// =============================================================
async function loadAnnouncements() {
    const feed = document.getElementById("noticesFeed");
    try {
        const notices = await apiRequest("/communications/");
        if (!notices || !notices.length) {
            feed.innerHTML = `
                <div class="p-2.5 rounded-xl bg-[#F6F8F7] flex items-center justify-between">
                    <div><p class="font-semibold text-gray-800"># general-workspace</p><p class="text-[11px] text-gray-400">Welcome to Zenwork!</p></div>
                    <span class="px-1.5 py-0.5 text-[10px] rounded bg-[#E6F4EA] text-[#1E6B52] font-semibold">1</span>
                </div>`;
            return;
        }
        feed.innerHTML = notices.slice(0, 2).map(n => `
            <div class="p-2.5 rounded-xl bg-[#F6F8F7] flex items-center justify-between">
                <div class="truncate pr-2">
                    <p class="font-semibold text-gray-800 truncate"># ${n.title}</p>
                    <p class="text-[11px] text-gray-400 truncate">${n.content}</p>
                </div>
                <span class="px-1.5 py-0.5 text-[10px] rounded bg-[#E6F4EA] text-[#1E6B52] font-semibold">New</span>
            </div>
        `).join("");
    } catch (e) {}
}

async function loadPerformanceStats() {
    try {
        const perf = await apiRequest("/analytics/me");
        if (perf && perf.overall_score !== undefined) {
            const score = Math.round(perf.overall_score);
            document.getElementById("statPerformance").textContent = `${score}%`;
            document.getElementById("analyticsBigScore").textContent = `${score}%`;
        }
    } catch (e) {}
}

async function loadOpenQueriesCount() {
    try {
        const queries = await apiRequest("/queries/");
        const openCount = Array.isArray(queries) ? queries.filter(q => q.status === "OPEN").length : 0;
        document.getElementById("statQueries").textContent = String(openCount).padStart(2, '0');
        document.getElementById("bottomQueryAlertText").textContent = `${openCount} open queries awaiting response`;

        const badge = document.getElementById("navQueryBadge");
        if (openCount > 0) {
            badge.textContent = openCount;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    } catch (e) {}
}

// =============================================================
// 5. MINI CALENDAR & TASK CREATE MODAL
// =============================================================
function drawMiniCalendar() {
    const now = new Date();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const today = now.getDate();
    const container = document.getElementById("miniCalDays");

    document.getElementById("miniCalMonth").textContent =
        now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const offset = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;  // Monday-first
    let html = "<span></span>".repeat(offset);
    for (let d = 1; d <= totalDays; d++) {
        if (d === today) {
            html += `<span style="background:var(--accent);color:var(--accent-ink)" class="w-6 h-6 mx-auto flex items-center justify-center rounded-md font-semibold">${d}</span>`;
        } else {
            html += `<span class="py-1 text-gray-700">${d}</span>`;
        }
    }
    container.innerHTML = html;
}

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
        alert("Error: " + err.message);
    }
});

// =============================================================
// 6. SIDEBAR NAVIGATION ROUTER (Switches between tabs)
// =============================================================
function switchSection(sectionName) {
    // Highlight selected sidebar button
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.remove("is-active");
    });
    const activeBtn = document.getElementById(`nav-${sectionName}`);
    if (activeBtn) {
        activeBtn.classList.add("is-active");
    }

    document.getElementById("breadcrumbTitle").textContent = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);

    const dashView = document.getElementById("section-dashboard");
    const dynView = document.getElementById("section-dynamic");

    if (sectionName === "dashboard") {
        dashView.classList.remove("hidden");
        dynView.classList.add("hidden");
    } else if (sectionName === "attendance") {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        renderAttendanceSection();
    } else if (sectionName === "tasks") {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        renderTasksSection();
    } else if (sectionName === "admin") {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        renderAdminSection();
    
    } else if (sectionName === "profile") {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        renderProfileSection();    

    } else if (sectionName === "settings") {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        renderSettingsSection();

    } else {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        dynView.innerHTML = `
            <div class="bg-white p-6 rounded-2xl border border-[#E6ECE8]">
                <h2 class="text-lg font-semibold text-gray-900 capitalize">${sectionName} Workspace</h2>
                <p class="text-xs text-gray-500 mt-1">Ready for Step 2 module connection.</p>
            </div>`;
    }
}