const SETTINGS_STORAGE_KEY = "zenwork_workspace_prefs";

function getWorkspacePrefs() {
    const defaults = {
        taskAlerts: true,
        chatApprovalGuard: true,
        muteMicOnJoin: true,
        shiftReminders: true,
        timeFormat24h: false,
        compactCards: false,
        ambientThemeEnabled: true,
        weekStart: "Monday"
    };
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
        return { ...defaults, ...saved };
    } catch (_) {
        return defaults;
    }
}

function saveWorkspacePrefsToStorage(prefs) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(prefs));
    applyWorkspacePrefsToUI(prefs);
}

function applyWorkspacePrefsToUI(prefs = getWorkspacePrefs()) {
    document.body.classList.toggle("zen-compact", !!prefs.compactCards);
    if (window.DaylightTheme && prefs.ambientThemeEnabled === false) {
        const root = document.documentElement.style;
        root.setProperty("--bg1", "#DCECE6");
        root.setProperty("--bg2", "#F8FAFC");
        root.setProperty("--accent", "#1D6B52");
        root.setProperty("--accent-ink", "#FFFFFF");
        document.body.classList.remove("is-night");
        document.body.style.background = "linear-gradient(160deg, #DCECE6 0%, #EEF6F3 55%, #F8FAFC 100%)";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    applyWorkspacePrefsToUI();
});

async function renderSettingsSection() {
    const container = document.getElementById("section-dynamic");
    if (!container) return;

    if (!currentUser) {
        const saved = localStorage.getItem("zenwork_user");
        currentUser = saved ? JSON.parse(saved) : await apiRequest("/users/me");
    }

    const prefs = getWorkspacePrefs();
    const companyLabel = `${currentUser?.company_name || "Zenwork Workspace"}${currentUser?.company_code ? ` (${currentUser.company_code})` : ""}`;

    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">PREFERENCES, SECURITY &amp; HELP</p>
                <h1 class="text-2xl font-semibold text-gray-900 mt-0.5">Settings &amp; Support</h1>
                <p class="text-xs text-gray-500 mt-0.5">Manage alerts, privacy, work preferences, security, and workspace support for ${esc(companyLabel)}.</p>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" onclick="resetWorkspacePrefs()" class="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50">
                    Reset Defaults
                </button>
                <button type="button" onclick="switchSection('queries')" class="px-4 py-2 rounded-xl bg-[#1E6B52] text-white text-xs font-semibold hover:opacity-95">
                    Contact Support / IT
                </button>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 sm:gap-5 items-start mt-4">

            <!-- LEFT COLUMN (8 cols) -->
            <div class="col-span-12 lg:col-span-8 space-y-5">

                <!-- 1. Notifications & Chat Privacy -->
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-sm font-semibold text-gray-900">Notifications &amp; Chat Privacy</h2>
                            <p class="text-[11px] text-gray-500">Control real-time alerts, direct message requests, and audio rooms.</p>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#E6F4EA] text-[#1E6B52]">Active</span>
                    </div>

                    <div class="space-y-2.5 text-xs">
                        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-semibold text-gray-800">Task &amp; Blocker Instant Alerts</p>
                                <p class="text-[11px] text-gray-500">Notify immediately when tasks are assigned, due soon, or marked blocked.</p>
                            </div>
                            <input type="checkbox" id="prefTaskAlerts" ${prefs.taskAlerts ? "checked" : ""} class="w-4 h-4 shrink-0">
                        </label>

                        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-semibold text-gray-800">Direct Message Approval Guard</p>
                                <p class="text-[11px] text-gray-500">Require Accept / Decline / Ignore before new teammates start a DM.</p>
                            </div>
                            <input type="checkbox" id="prefChatGuard" ${prefs.chatApprovalGuard ? "checked" : ""} class="w-4 h-4 shrink-0">
                        </label>

                        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-semibold text-gray-800">Mute Microphone on Voice Room Join</p>
                                <p class="text-[11px] text-gray-500">Join team voice lounges muted by default to avoid background noise.</p>
                            </div>
                            <input type="checkbox" id="prefMuteMic" ${prefs.muteMicOnJoin ? "checked" : ""} class="w-4 h-4 shrink-0">
                        </label>

                        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-semibold text-gray-800">Attendance &amp; Shift Reminders</p>
                                <p class="text-[11px] text-gray-500">Show check-in status indicators and daily shift summary prompts.</p>
                            </div>
                            <input type="checkbox" id="prefShiftReminders" ${prefs.shiftReminders ? "checked" : ""} class="w-4 h-4 shrink-0">
                        </label>
                    </div>
                </div>

                <!-- 2. Workspace Display & Workday Preferences -->
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-4">
                    <div>
                        <h2 class="text-sm font-semibold text-gray-900">Workspace &amp; Display Preferences</h2>
                        <p class="text-[11px] text-gray-500">Customize ambient sky theme, layout density, and calendar start day.</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div class="p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8]">
                            <label class="block font-semibold text-gray-800 mb-1">Calendar Week Starts On</label>
                            <select id="prefWeekStart" class="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white">
                                <option value="Monday" ${prefs.weekStart === "Monday" ? "selected" : ""}>Monday (Standard Workweek)</option>
                                <option value="Sunday" ${prefs.weekStart === "Sunday" ? "selected" : ""}>Sunday</option>
                            </select>
                        </div>

                        <div class="p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] flex items-center justify-between gap-3">
                            <div>
                                <p class="font-semibold text-gray-800">Weather &amp; Time Sky Theme</p>
                                <p class="text-[11px] text-gray-500">Auto-shift colors across day, rain &amp; night</p>
                            </div>
                            <input type="checkbox" id="prefAmbientTheme" ${prefs.ambientThemeEnabled ? "checked" : ""} class="w-4 h-4 shrink-0">
                        </div>
                    </div>

                    <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer text-xs">
                        <div>
                            <p class="font-semibold text-gray-800">Compact Card Spacing</p>
                            <p class="text-[11px] text-gray-500">Tighter padding so more tasks and cards fit on smaller screens.</p>
                        </div>
                        <input type="checkbox" id="prefCompactCards" ${prefs.compactCards ? "checked" : ""} class="w-4 h-4 shrink-0">
                    </label>

                    <div class="flex justify-end">
                        <button type="button" id="saveSettingsPrefsBtn" class="px-5 py-2.5 rounded-xl bg-[#1E6B52] text-white text-xs font-semibold hover:opacity-95">
                            Save preferences
                        </button>
                    </div>
                </div>

                <!-- 3. Password & Security -->
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-4">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h2 class="text-sm font-semibold text-gray-900">Password &amp; Security</h2>
                            <p class="text-[11px] text-gray-500">Update your account password to keep your workspace account secure.</p>
                        </div>
                        <button type="button" onclick="window.location.href='login.html'" class="text-xs font-semibold text-[#1E6B52] hover:underline">
                            Forgot current password?
                        </button>
                    </div>

                    <form id="changePasswordForm" class="space-y-3 text-xs">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Current Password *</label>
                            <input type="password" id="secCurrentPass" required placeholder="Enter your existing password"
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200">
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block font-medium text-gray-700 mb-1">New Password *</label>
                                <input type="password" id="secNewPass" required minlength="6" placeholder="Min 6 characters"
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200">
                            </div>
                            <div>
                                <label class="block font-medium text-gray-700 mb-1">Confirm New Password *</label>
                                <input type="password" id="secConfirmPass" required minlength="6" placeholder="Re-enter new password"
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200">
                            </div>
                        </div>

                        <div class="pt-1 flex justify-end">
                            <button type="submit" id="secSavePassBtn" class="px-5 py-2.5 rounded-xl bg-[#1E6B52] text-white font-semibold hover:opacity-95">
                                Update password
                            </button>
                        </div>
                    </form>
                </div>

            </div>

            <!-- RIGHT COLUMN (4 cols): Shortcuts, Support & Diagnostics -->
            <div class="col-span-12 lg:col-span-4 space-y-4">

                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-3 text-xs">
                    <h2 class="text-sm font-semibold text-gray-900">Keyboard Shortcuts</h2>
                    <div class="flex items-center justify-between py-1.5 border-b border-[#F0F4F2]">
                        <span class="text-gray-600">Global Search &amp; Jump</span>
                        <kbd class="px-2 py-0.5 rounded bg-[#F6F8F7] border border-gray-200 font-semibold">Ctrl / ⌘ K</kbd>
                    </div>
                    <div class="flex items-center justify-between py-1.5 border-b border-[#F0F4F2]">
                        <span class="text-gray-600">New Task Modal</span>
                        <span class="font-semibold text-gray-700">Tasks &rarr; + New Task</span>
                    </div>
                    <div class="flex items-center justify-between py-1.5">
                        <span class="text-gray-600">Shift Check-in / Out</span>
                        <span class="font-semibold text-gray-700">Right Rail / Top Bar</span>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-3 text-xs">
                    <h2 class="text-sm font-semibold text-gray-900">Need Workspace Support?</h2>
                    <p class="text-[11px] text-gray-500 leading-relaxed">
                        Having trouble with attendance logs, leave/WFH approvals, role permissions, or task assignment? Raise an internal query for your workspace Admin or IT team.
                    </p>
                    <button type="button" onclick="switchSection('queries')" class="w-full py-2.5 px-4 rounded-xl bg-[#1E6B52] text-white font-semibold hover:opacity-95">
                        Open Helpdesk Query &rarr;
                    </button>
                    <button type="button" onclick="copySupportDiagnostics()" class="w-full py-2 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50">
                        Copy Workspace Diagnostics ID
                    </button>
                </div>

                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-2.5 text-xs">
                    <h2 class="text-sm font-semibold text-gray-900">Session &amp; System Info</h2>
                    <div class="flex justify-between py-1 border-b border-[#F0F4F2]">
                        <span class="text-gray-500">Workspace</span>
                        <span class="font-semibold text-gray-800">${esc(currentUser?.company_name || "Zenwork")}</span>
                    </div>
                    <div class="flex justify-between py-1 border-b border-[#F0F4F2]">
                        <span class="text-gray-500">Role Tier</span>
                        <span class="font-semibold text-[#1E6B52]">${esc(currentUser?.role_tier || "MEMBER")}</span>
                    </div>
                    <div class="flex justify-between py-1">
                        <span class="text-gray-500">Auth Mode</span>
                        <span class="font-medium text-gray-700">JWT Session</span>
                    </div>
                </div>

            </div>

        </div>
    `;

    document.getElementById("saveSettingsPrefsBtn")?.addEventListener("click", () => {
        const updated = {
            taskAlerts: !!document.getElementById("prefTaskAlerts")?.checked,
            chatApprovalGuard: !!document.getElementById("prefChatGuard")?.checked,
            muteMicOnJoin: !!document.getElementById("prefMuteMic")?.checked,
            shiftReminders: !!document.getElementById("prefShiftReminders")?.checked,
            weekStart: document.getElementById("prefWeekStart")?.value || "Monday",
            ambientThemeEnabled: !!document.getElementById("prefAmbientTheme")?.checked,
            compactCards: !!document.getElementById("prefCompactCards")?.checked
        };
        saveWorkspacePrefsToStorage(updated);
        if (typeof showToast === "function") showToast("Workspace preferences saved!", "success");
    });

    document.getElementById("changePasswordForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById("secCurrentPass").value;
        const newPassword = document.getElementById("secNewPass").value;
        const confirmPassword = document.getElementById("secConfirmPass").value;
        const btn = document.getElementById("secSavePassBtn");

        if (newPassword.length < 6) {
            if (typeof showToast === "function") showToast("New password must be at least 6 characters.", "error");
            return;
        }
        if (newPassword !== confirmPassword) {
            if (typeof showToast === "function") showToast("New password and confirm password do not match.", "error");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Updating...";

        try {
            await apiRequest("/users/change-password", "POST", {
                current_password: currentPassword,
                new_password: newPassword
            });
            document.getElementById("changePasswordForm").reset();
            if (typeof showToast === "function") showToast("Password updated successfully!", "success");
        } catch (err) {
            if (typeof showToast === "function") showToast(err.message || "Could not update password.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Update password";
        }
    });
}

function resetWorkspacePrefs() {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    applyWorkspacePrefsToUI(getWorkspacePrefs());
    if (typeof showToast === "function") showToast("Reset settings to defaults.", "info");
    renderSettingsSection();
}

function copySupportDiagnostics() {
    const empIdLabel = currentUser?.employee_code || `#ZW-00${currentUser?.id || "?"}`;
    const info = [
        `Workspace: ${currentUser?.company_name || "N/A"} (${currentUser?.company_code || "N/A"})`,
        `User: ${currentUser?.full_name || "N/A"} <${currentUser?.email || "N/A"}>`,
        `Role: ${currentUser?.role_tier || "N/A"} | ID: ${empIdLabel}`,
        `Timestamp: ${new Date().toISOString()}`
    ].join(" | ");

    navigator.clipboard?.writeText(info).catch(() => {});
    if (typeof showToast === "function") showToast("Diagnostics copied for support/IT.", "success");
}