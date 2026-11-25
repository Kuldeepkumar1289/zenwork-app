let currentUser = null;
let allTasks = [];
let todayAttendance = null;

// Clean production toast notification (replaces raw browser alert popups)
function showToast(message, type = "info") {
    const existing = document.getElementById("zenToast");
    if (existing) existing.remove();

    const colors = {
        success: { bg: "#ECFDF5", border: "#A7F3D0", text: "#065F46", icon: "✓" },
        error:   { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: "!" },
        info:    { bg: "#F8FAFC", border: "#CBD5E1", text: "#0F172A", icon: "•" }
    };
    const theme = colors[type] || colors.info;

    const toast = document.createElement("div");
    toast.id = "zenToast";
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 340px;
        background: ${theme.bg};
        color: ${theme.text};
        border: 1px solid ${theme.border};
        border-radius: 14px;
        padding: 12px 16px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        transition: opacity 0.25s ease;
    `;
    toast.innerHTML = `
        <span style="width:20px;height:20px;border-radius:999px;background:${theme.text};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;">${theme.icon}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 260);
    }, 3400);
}

// 1. APP STARTUP: Runs automatically when index.html opens
document.addEventListener("DOMContentLoaded", async () => {
    if (!getAuthToken()) {
        window.location.href = "login.html";
        return;
    }

    setTodayDate();
    drawMiniCalendar();

    try {
        currentUser = await apiRequest("/users/me");
        localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
        updateProfileUI(currentUser);

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

// Sets current date in top-right badge
function setTodayDate() {
    const dateEl = document.getElementById("heroDate") || document.getElementById("headerDate");
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }
}

// Updates user name, company workspace name, designation, and shows Admin tab if user is ADMIN
function updateProfileUI(user) {
    if (!user) return;
    const firstName = user.full_name.split(" ")[0];
    const hr = new Date().getHours();
    const hello = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 20 ? "Good evening" : "Good night";

    const greetEl = document.getElementById("heroGreeting") || document.getElementById("greetingText");
    if (greetEl) greetEl.textContent = `${hello}, ${firstName}`;

    const compEl = document.getElementById("sidebarCompanyName");
    if (compEl) compEl.textContent = user.company_name || "Zenwork Workspace";

    document.getElementById("topUserName").textContent = user.full_name;
    document.getElementById("topUserRole").textContent = user.designation;

    const topAvatar = document.getElementById("topAvatar");
    if (topAvatar) {
        if (user.avatar_url && typeof resolveAvatarSrc === "function") {
            topAvatar.style.overflow = "hidden";
            topAvatar.style.padding = "0";
            topAvatar.innerHTML = `<img src="${resolveAvatarSrc(user.avatar_url)}" alt="${user.full_name}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;">`;
        } else {
            topAvatar.textContent = firstName[0].toUpperCase();
        }
    }

    if (user.role_tier === "ADMIN") {
        document.getElementById("adminNavSection").classList.remove("hidden");
    }
}

// 2. TASKS KPI & SKY MARKERS
async function loadTasks() {
    try {
        const response = await apiRequest("/tasks/");
        allTasks = Array.isArray(response) ? response : (response.items || []);

        const completed = allTasks.filter(t => t.status === "COMPLETED").length;
        const countBadge = document.getElementById("taskCountBadge");
        if (countBadge) countBadge.textContent = allTasks.length;

        const completedEl = document.getElementById("statCompletedTasks");
        if (completedEl) completedEl.textContent = completed;

        const totalSubEl = document.getElementById("statTotalTasksSub");
        if (totalSubEl) totalSubEl.textContent = `of ${allTasks.length} assigned`;

        renderTasksTable(allTasks);

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
        const tbody = document.getElementById("dashboardTasksBody");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-red-500">Unable to load tasks right now.</td></tr>`;
        }
    }
}

function renderTasksTable(tasksList) {
    const tbody = document.getElementById("dashboardTasksBody");
    if (!tbody) return;

    if (!tasksList.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400">No tasks assigned yet. Create a task to get started.</td></tr>`;
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

function filterDashboardTasks(status, clickedBtn) {
    document.querySelectorAll(".dash-tab").forEach(tab => {
        tab.classList.remove("font-semibold", "text-gray-900", "border-b-2", "border-[#1E6B52]");
        tab.classList.add("font-medium", "text-gray-400");
        tab.style.borderColor = "transparent";
        tab.style.color = "";
    });
    clickedBtn.classList.add("font-semibold", "border-b-2");
    clickedBtn.classList.remove("font-medium", "text-gray-400");
    clickedBtn.style.borderColor = "var(--accent)";
    clickedBtn.style.color = "var(--accent)";

    if (status === "ALL") {
        renderTasksTable(allTasks);
    } else {
        renderTasksTable(allTasks.filter(t => t.status === status));
    }
}
const WORKSPACE_SECTIONS_INDEX = [
    { key: "dashboard", label: "Dashboard", desc: "Overview, sky arc, KPIs & tasks", adminOnly: false },
    { key: "performance", label: "Performance", desc: "Team scorecard & workload metrics", adminOnly: false },
    { key: "attendance", label: "Attendance & Leaves", desc: "Punch logs, WFH & leave approvals", adminOnly: false },
    { key: "calendar", label: "Calendar", desc: "Schedule, deadlines & meetings", adminOnly: false },
    { key: "events", label: "Events", desc: "Company socials & team syncs", adminOnly: false },
    { key: "chats", label: "Chats", desc: "Direct messages, lounge & files", adminOnly: false },
    { key: "queries", label: "Queries", desc: "Inter-department questions & helpdesk", adminOnly: false },
    { key: "tasks", label: "Tasks", desc: "All tasks, priorities & blockers", adminOnly: false },
    { key: "organization", label: "Organization", desc: "Reporting hierarchy & live team status", adminOnly: false },
    { key: "profile", label: "My Profile", desc: "Avatar cropper, name & designation", adminOnly: false },
    { key: "settings", label: "Settings & Support", desc: "Alerts, privacy, security & help", adminOnly: false },
    { key: "admin", label: "Admin Control", desc: "Onboard employees & role permissions", adminOnly: true }
];

function closeSearchResultsPopup() {
    document.getElementById("zenGlobalSearchPopup")?.remove();
}

function handleSearchFilter(query) {
    const trimmed = String(query || "").trim();
    const q = trimmed.toLowerCase();

    // Keep dashboard task table filtered when on dashboard
    if (typeof renderTasksTable === "function" && Array.isArray(allTasks)) {
        renderTasksTable(q ? allTasks.filter(t => String(t.title || "").toLowerCase().includes(q)) : allTasks);
    }

    const searchInput = document.getElementById("globalSearch");
    if (!searchInput) return;

    if (!q) {
        closeSearchResultsPopup();
        return;
    }

    const isAdmin = currentUser?.role_tier === "ADMIN";
    const matchedSections = WORKSPACE_SECTIONS_INDEX.filter(s => {
        if (s.adminOnly && !isAdmin) return false;
        return s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || s.key.includes(q);
    }).slice(0, 4);

    const matchedTasks = (Array.isArray(allTasks) ? allTasks : []).filter(t =>
        String(t.title || "").toLowerCase().includes(q) ||
        String(t.status || "").toLowerCase().includes(q) ||
        String(t.priority || "").toLowerCase().includes(q)
    ).slice(0, 5);

    const rect = searchInput.getBoundingClientRect();
    let popup = document.getElementById("zenGlobalSearchPopup");
    if (!popup) {
        popup = document.createElement("div");
        popup.id = "zenGlobalSearchPopup";
        document.body.appendChild(popup);
    }

    popup.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 8}px;
        left: ${Math.max(12, rect.left)}px;
        width: ${Math.min(420, window.innerWidth - 24)}px;
        background: #FFFFFF;
        color: #0F172A;
        border: 1px solid #CBD5E1;
        border-radius: 16px;
        box-shadow: 0 20px 44px rgba(15, 23, 42, 0.18);
        padding: 10px;
        z-index: 12000;
        font-size: 12px;
    `;

    const secHtml = matchedSections.map(s => `
        <button type="button" onclick="closeSearchResultsPopup(); switchSection('${s.key}');"
            style="width:100%;text-align:left;padding:8px 10px;border-radius:10px;border:0;background:transparent;display:flex;justify-content:space-between;align-items:center;cursor:pointer;"
            onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='transparent'">
            <div>
                <div style="font-weight:700;color:#0F172A;">${s.label}</div>
                <div style="font-size:11px;color:#64748B;">${s.desc}</div>
            </div>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#E2E8F0;color:#334155;">Section</span>
        </button>
    `).join("");

    const taskHtml = matchedTasks.map(t => `
        <button type="button" onclick="closeSearchResultsPopup(); switchSection('tasks');"
            style="width:100%;text-align:left;padding:8px 10px;border-radius:10px;border:0;background:transparent;display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer;"
            onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='transparent'">
            <div style="min-width:0;">
                <div style="font-weight:600;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
                <div style="font-size:11px;color:#64748B;">${t.priority || "MEDIUM"} &bull; ${(t.status || "TODO").replace("_", " ")}</div>
            </div>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#DCFCE7;color:#166534;flex-shrink:0;">Task</span>
        </button>
    `).join("");

    popup.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:2px 6px 8px;border-bottom:1px solid #E2E8F0;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:#475569;">Search results for "${trimmed}"</span>
            <button type="button" onclick="closeSearchResultsPopup()" style="border:0;background:none;color:#64748B;font-weight:700;cursor:pointer;">✕</button>
        </div>
        ${secHtml}${taskHtml}
        ${(!secHtml && !taskHtml) ? `<div style="padding:14px;text-align:center;color:#64748B;">No matching tasks or sections found.</div>` : ""}
    `;
}

document.addEventListener("click", (e) => {
    const popup = document.getElementById("zenGlobalSearchPopup");
    const searchInput = document.getElementById("globalSearch");
    if (popup && !popup.contains(e.target) && e.target !== searchInput) {
        closeSearchResultsPopup();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeSearchResultsPopup();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("globalSearch") || document.querySelector("input[placeholder*='Search']");
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
            if (searchInput.value.trim()) handleSearchFilter(searchInput.value);
        }
    }
});

async function markTaskDone(taskId) {
    try {
        await apiRequest(`/tasks/${taskId}/status`, "PATCH", { status: "COMPLETED" });
        showToast("Task marked as completed.", "success");
        await loadTasks();
    } catch (err) {
        showToast(err.message || "Could not update task.", "error");
    }
}

// 3. ATTENDANCE & SHIFT TIMER (Synced across Desktop Rail + Mobile Quick Bar)
let shiftTimerInterval = null;

function syncMobileAttendanceUI({ btnText, btnDisabled, statusText, timerText }) {
    const mBtn = document.getElementById("mobileCheckInBtn");
    const mStatus = document.getElementById("mobileShiftStatus");
    const mTimer = document.getElementById("mobileShiftTimer");

    if (mBtn && btnText !== undefined) {
        mBtn.textContent = btnText;
        mBtn.disabled = !!btnDisabled;
        mBtn.style.opacity = btnDisabled ? "0.6" : "1";
    }
    if (mStatus && statusText !== undefined) mStatus.textContent = statusText;
    if (mTimer && timerText !== undefined) mTimer.textContent = timerText;
}

async function loadTodayAttendance() {
    const timerDisplay = document.getElementById("shiftTimerDisplay");
    const statHours = document.getElementById("statHours");
    const statusLabel = document.getElementById("shiftStatusLabel");
    const btn = document.getElementById("punchActionBtn");
    const pulseDot = document.getElementById("livePulseDot");
    const statAttBadge = document.getElementById("statAttBadge");

    try {
        todayAttendance = await apiRequest("/attendance/me/today");

        if (shiftTimerInterval) clearInterval(shiftTimerInterval);

        if (!todayAttendance || !todayAttendance.punch_in) {
            if (btn) {
                btn.textContent = "Check in";
                btn.disabled = false;
                btn.className = "btn wide btn-primary";
            }
            if (statusLabel) statusLabel.textContent = "Not checked in";
            if (timerDisplay) timerDisplay.textContent = "0 min";
            if (statHours) statHours.textContent = "0 min";
            if (statAttBadge) statAttBadge.textContent = "Offline";
            if (pulseDot) pulseDot.className = "w-1.5 h-1.5 rounded-full bg-gray-400";

            syncMobileAttendanceUI({
                btnText: "Check in",
                btnDisabled: false,
                statusText: "Not checked in",
                timerText: "0 min"
            });
        } else if (!todayAttendance.punch_out) {
            if (btn) {
                btn.textContent = "Check out";
                btn.disabled = false;
                btn.className = "btn wide btn-primary";
            }
            if (statusLabel) statusLabel.textContent = "Checked in";
            if (pulseDot) pulseDot.className = "w-1.5 h-1.5 rounded-full bg-[#1E6B52] animate-pulse";

            let punchInStr = todayAttendance.punch_in;
            if (!punchInStr.endsWith("Z") && !punchInStr.includes("+") && !punchInStr.includes("gmt")) {
                punchInStr += "Z";
            }
            const punchIn = new Date(punchInStr);

            const updateClock = () => {
                const diffMs = Math.max(0, Date.now() - punchIn.getTime());
                const totalMins = Math.floor(diffMs / 60000);
                const hh = Math.floor(totalMins / 60);
                const mm = totalMins % 60;

                const liveStr = hh > 0 ? `${hh}h ${mm}m` : `${mm} min`;

                if (timerDisplay) timerDisplay.textContent = liveStr;
                if (statHours) statHours.textContent = liveStr;
                if (statAttBadge) statAttBadge.textContent = "Active";

                syncMobileAttendanceUI({
                    btnText: "Check out",
                    btnDisabled: false,
                    statusText: "Checked in • Live",
                    timerText: liveStr
                });
            };

            updateClock();
            shiftTimerInterval = setInterval(updateClock, 1000);
        } else {
            if (btn) {
                btn.textContent = "Shift Completed";
                btn.disabled = true;
                btn.className = "btn wide opacity-60 cursor-not-allowed";
            }
            if (pulseDot) pulseDot.className = "w-1.5 h-1.5 rounded-full bg-gray-400";

            const formattedTotal = formatDuration(todayAttendance.total_hours);
            if (timerDisplay) timerDisplay.textContent = formattedTotal;
            if (statusLabel) statusLabel.textContent = todayAttendance.status || "Completed";
            if (statHours) statHours.textContent = formattedTotal;
            if (statAttBadge) statAttBadge.textContent = todayAttendance.status || "Completed";

            syncMobileAttendanceUI({
                btnText: "Completed",
                btnDisabled: true,
                statusText: todayAttendance.status || "Shift completed",
                timerText: formattedTotal
            });
        }
    } catch (e) {
        console.error("Attendance API Error:", e);
        if (timerDisplay) timerDisplay.textContent = "0 min";
        if (statHours) statHours.textContent = "0 min";
        if (statusLabel) statusLabel.textContent = "Not checked in";
        if (btn) {
            btn.textContent = "Check in";
            btn.disabled = false;
        }
        syncMobileAttendanceUI({
            btnText: "Check in",
            btnDisabled: false,
            statusText: "Not checked in",
            timerText: "0 min"
        });
    }
}

async function handlePunchToggle() {
    const desktopBtn = document.getElementById("punchActionBtn");
    const mobileBtn = document.getElementById("mobileCheckInBtn");
    if (desktopBtn) desktopBtn.disabled = true;
    if (mobileBtn) mobileBtn.disabled = true;

    try {
        if (!todayAttendance || !todayAttendance.punch_in) {
            await apiRequest("/attendance/punch-in", "POST", { notes: "Checked in via Zenwork" });
            showToast("Checked in! Your work session timer has started.", "success");
        } else if (!todayAttendance.punch_out) {
            await apiRequest("/attendance/punch-out", "POST", { notes: "Checked out via Zenwork" });
            showToast("Checked out! Today's work hours have been logged.", "success");
        }
        await loadTodayAttendance();
    } catch (err) {
        showToast(err.message || "Unable to update attendance right now.", "error");
        if (desktopBtn) desktopBtn.disabled = false;
        if (mobileBtn) mobileBtn.disabled = false;
    }
}

// 4. ANNOUNCEMENTS, PERFORMANCE & QUERIES COUNT
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
        const perf = await apiRequest("/analytics/scorecard");
        if (!perf) return;

        const rate = Math.round(perf.on_time_delivery_rate ?? 0);
        const hoursLogged = Number(perf.total_hours_logged || 0);
        const blockers = Number(perf.active_blockers_count || 0);

        const attendanceBonus = hoursLogged > 0 ? Math.min(20, Math.round(hoursLogged * 2.5)) : 10;
        const score = (perf.total_assigned > 0 || hoursLogged > 0)
            ? Math.max(0, Math.min(100, Math.round((rate * 0.8) + attendanceBonus - (blockers * 5))))
            : 0;

        const statEl = document.getElementById("statPerformance");
        if (statEl) statEl.textContent = `${rate}%`;

        const bigScoreEl = document.getElementById("analyticsBigScore");
        if (bigScoreEl) bigScoreEl.textContent = `${score}%`;
    } catch (e) {
        console.warn("Scorecard error:", e.message);
    }
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

// 5. MINI CALENDAR & TASK CREATE MODAL
function drawMiniCalendar() {
    const now = new Date();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const today = now.getDate();
    const container = document.getElementById("miniCalDays");

    document.getElementById("miniCalMonth").textContent =
        now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const offset = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
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

async function renderDashboardLiveTeamPulse() {
    const feedEl = document.getElementById("dashboardLiveTeamFeed");
    const chipEl = document.getElementById("dashboardLiveSummaryChip");
    if (!feedEl || !window.LivePresence) return;

    const { usersById } = await window.LivePresence.refresh(true);
    const people = Object.values(usersById);

    const checkedIn = people.filter(p => window.LivePresence.getStatus(p.id).state === "CHECKED_IN").length;
    const wfhOrLeave = people.filter(p => ["WFH", "ON_LEAVE"].includes(window.LivePresence.getStatus(p.id).state)).length;
    if (chipEl) {
        chipEl.textContent = `${checkedIn} Checked in • ${wfhOrLeave} WFH/Leave`;
    }

    if (!people.length) {
        feedEl.innerHTML = `<p class="text-xs muted">No teammates in workspace yet.</p>`;
        return;
    }

    feedEl.innerHTML = people.map(p => {
        const activeTasks = (Array.isArray(allTasks) ? allTasks : []).filter(
            t => t.assigned_to_id === p.id && t.status !== "COMPLETED"
        );
        const topTask = activeTasks[0];
        const activityText = topTask
            ? `${topTask.status === "BLOCKED" ? "Blocked:" : topTask.status === "PENDING_REVIEW" ? "Review:" : "Working on:"} ${topTask.title}`
            : (p.designation || p.role_tier);

        return `
            <div class="live-member-card">
                <span class="avatar sm">${typeof initials === "function" ? initials(p.full_name) : p.full_name[0]}</span>
                <div class="flex-1 min-w-0">
                    <b>${typeof esc === "function" ? esc(p.full_name) : p.full_name} <span class="font-mono text-[11px] opacity-70">[${window.LivePresence.formatId(p)}]</span></b>
                    <small class="truncate">${typeof esc === "function" ? esc(activityText) : activityText}</small>
                    <div class="mt-1">${window.LivePresence.badgeHtml(p.id, true)}</div>
                </div>
            </div>
        `;
    }).join("");
}

async function openTaskModal() {
    const modal = document.getElementById("taskModal");
    if (modal) modal.classList.remove("hidden");

    const selectEl = document.getElementById("taskAssigneeId");
    if (selectEl && window.LivePresence) {
        const { usersById } = await window.LivePresence.refresh();
        const people = Object.values(usersById);
        selectEl.innerHTML = `<option value="">Select teammate...</option>` + people.map(u => {
            const st = window.LivePresence.getStatus(u.id).label;
            return `<option value="${u.id}">${window.LivePresence.formatNameWithId(u)} • ${u.role_tier} (${st})</option>`;
        }).join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(renderDashboardLiveTeamPulse, 900);
});


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
        showToast("Task assigned successfully.", "success");
        await loadTasks();
    } catch (err) {
        showToast(err.message || "Failed to assign task.", "error");
    }
});

// 6. MOBILE DRAWER & SIDEBAR NAVIGATION ROUTER
function toggleMobileSidebar(forceState) {
    const sidebar = document.getElementById("appSidebar");
    const backdrop = document.getElementById("mobileSidebarBackdrop");
    if (!sidebar || !backdrop) return;

    const shouldOpen = typeof forceState === "boolean"
        ? forceState
        : !sidebar.classList.contains("is-mobile-open");

    sidebar.classList.toggle("is-mobile-open", shouldOpen);
    backdrop.classList.toggle("hidden", !shouldOpen);
}

function switchSection(sectionName) {
    toggleMobileSidebar(false);

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
    } else if (typeof SECTION_RENDERERS !== "undefined" && SECTION_RENDERERS[sectionName]) {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        SECTION_RENDERERS[sectionName]();
    } else {
        dashView.classList.add("hidden");
        dynView.classList.remove("hidden");
        dynView.innerHTML = `
            <div class="bg-white p-6 rounded-2xl border border-[#E6ECE8]">
                <h2 class="text-lg font-semibold text-gray-900 capitalize">${sectionName} Workspace</h2>
                <p class="text-xs text-gray-500 mt-1">Workspace module ready.</p>
            </div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
  const notifBtn = document.querySelector('.topbar-right button[title="Notifications"]');

  function closeHeaderPopovers() {
    document.getElementById("zenPopover")?.remove();
  }

  function showHeaderPopover(anchorEl, key, title, bodyHtml) {
    const existing = document.getElementById("zenPopover");
    if (existing && existing.dataset.owner === key) {
      existing.remove();
      return;
    }
    closeHeaderPopovers();

    const isMobile = window.innerWidth <= 900;
    const rect = anchorEl.getBoundingClientRect();
    const box = document.createElement("div");
    box.id = "zenPopover";
    box.dataset.owner = key;
    box.style.cssText = isMobile
      ? `
        position: fixed;
        top: ${rect.bottom + 10}px;
        left: 14px;
        right: 14px;
        width: auto;
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 16px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
        padding: 14px 16px;
        z-index: 9999;
        color: #0F172A;
      `
      : `
        position: fixed;
        top: ${rect.bottom + 10}px;
        right: ${Math.max(16, window.innerWidth - rect.right)}px;
        width: 315px;
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 16px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
        padding: 14px 16px;
        z-index: 9999;
        color: #0F172A;
      `;
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <b style="font-size:13px;color:#0F172A;">${title}</b>
        <button type="button" onclick="document.getElementById('zenPopover')?.remove()" style="font-size:13px;color:#64748B;cursor:pointer;">✕</button>
      </div>
      ${bodyHtml}
    `;
    document.body.appendChild(box);
  }

  if (notifBtn) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      const dot = notifBtn.querySelector(".notif-dot");
      if (dot) dot.style.display = "none";

      const pendingTasks = (typeof allTasks !== "undefined" ? allTasks : []).filter(t => t.status !== "COMPLETED");
      const openQ = document.getElementById("statQueries")?.textContent?.trim()
        || document.getElementById("openQueriesCount")?.textContent?.trim()
        || "0";

      const unreadChats = typeof window.getUnreadChatSummaries === "function"
        ? window.getUnreadChatSummaries()
        : [];

      const chatNotifRows = unreadChats.map(c => `
        <div onclick="document.getElementById('zenPopover')?.remove(); switchSection('chats'); setTimeout(() => openChat('dm-${c.partnerId}'), 120);"
          style="padding:8px 10px;border-radius:10px;background:#EEF2FF;border:1px solid #C7D2FE;margin-bottom:6px;font-size:12px;cursor:pointer;">
          <div style="display:flex;justify-content:space-between;font-weight:700;color:#1E1B4B;">
            <span>${c.title}</span>
            <span style="font-size:10px;color:#4F46E5;">${c.time}</span>
          </div>
          <div style="color:#475569;font-size:11px;margin-top:2px;">${c.sub}</div>
        </div>
      `).join("");

      const taskRows = pendingTasks.slice(0, 3).map(t => `
        <div style="padding:8px 10px;border-radius:10px;background:#F8FAFC;margin-bottom:6px;font-size:12px;">
          <div style="font-weight:600;color:#0F172A;">${t.title}</div>
          <div style="color:#64748B;font-size:11px;">Status: ${t.status} • Priority: ${t.priority}</div>
        </div>
      `).join("");

      showHeaderPopover(notifBtn, "notif", "Workspace Notifications", `
        <div style="font-size:12px;color:#475569;margin-bottom:8px;line-height:1.5;">
          • <b>${unreadChats.length}</b> unread chat alert(s)<br>
          • <b>${pendingTasks.length}</b> active task(s) in your queue<br>
          • <b>${openQ}</b> open query awaiting response
        </div>
        ${chatNotifRows}
        ${taskRows || (!chatNotifRows ? `<p style="font-size:12px;color:#94A3B8;margin:6px 0;">You're all caught up!</p>` : "")}
        <button type="button" onclick="document.getElementById('zenPopover')?.remove(); switchSection('chats');"
          style="margin-top:8px;width:100%;padding:8px;border-radius:10px;background:var(--accent);color:#FFFFFF;font-size:12px;font-weight:600;cursor:pointer;">
          Open Chats
        </button>
      `);
    });
  }

  document.addEventListener("click", (e) => {
    const pop = document.getElementById("zenPopover");
    if (pop && !pop.contains(e.target)) closeHeaderPopovers();
  });
});

function formatDuration(totalHours) {
    const totalMins = Math.round(Number(totalHours || 0) * 60);
    if (totalMins < 1) return "0 min";
    if (totalMins < 60) return `${totalMins} min`;
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    const searchInput = document.querySelector("input[placeholder*='Search']");
    if (searchInput) searchInput.focus();
  }
});