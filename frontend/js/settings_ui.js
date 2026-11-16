function renderSettingsSection() {
    const container = document.getElementById("section-dynamic");

    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">PREFERENCES & HELP</p>
                <h1 class="text-2xl font-semibold text-gray-900 mt-0.5">Settings & Support</h1>
                <p class="text-xs text-gray-500 mt-0.5">Customize your notifications, chat privacy, security, and workspace help.</p>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 sm:gap-5 items-start">
            
            <!-- LEFT: Preferences & Security (Full width on mobile, 8 cols on PC) -->
            <div class="col-span-12 lg:col-span-8 space-y-4 sm:space-y-5">
                
                <!-- 1. Notification & Privacy Toggles -->
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-6 space-y-4">
                    <h2 class="text-sm font-semibold text-gray-900">Notifications & Chat Privacy</h2>
                    
                    <label class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                        <div>
                            <p class="text-xs font-semibold text-gray-800">Task & Blocker Instant Alerts</p>
                            <p class="text-[11px] text-gray-400">Notify immediately when a task is assigned to you or marked blocked</p>
                        </div>
                        <input type="checkbox" checked class="w-4 h-4 shrink-0 accent-[#1E6B52]">
                    </label>

                    <label class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                        <div>
                            <p class="text-xs font-semibold text-gray-800">Direct Message Approval Guard</p>
                            <p class="text-[11px] text-gray-400">Show Accept / Decline / Ignore prompt for incoming 1-on-1 chat requests</p>
                        </div>
                        <input type="checkbox" checked class="w-4 h-4 shrink-0 accent-[#1E6B52]">
                    </label>

                    <label class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                        <div>
                            <p class="text-xs font-semibold text-gray-800">Mute Mic on Voice Lounge Join</p>
                            <p class="text-[11px] text-gray-400">Join Design Lounge or team voice rooms with microphone muted by default</p>
                        </div>
                        <input type="checkbox" checked class="w-4 h-4 shrink-0 accent-[#1E6B52]">
                    </label>

                    <div class="pt-1 flex justify-end">
                        <button onclick="alert('Workspace preferences saved!')" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold transition cursor-pointer">
                            Save preferences
                        </button>
                    </div>
                </div>

                <!-- 2. Password & Security (With SVG Line Eye Icons) -->
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-6 space-y-4">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h2 class="text-sm font-semibold text-gray-900">Password & Security</h2>
                            <p class="text-[11px] text-gray-400">Verify your current password before creating a new one.</p>
                        </div>
                        <button type="button" onclick="toggleForgotPasswordBox()" class="text-xs font-semibold text-[#1E6B52] hover:underline cursor-pointer">
                            Forgot current password?
                        </button>
                    </div>

                    <!-- Standard Change Password Form -->
                    <form id="changePasswordForm" onsubmit="handlePasswordChange(event)" class="space-y-3 text-xs">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Current Password *</label>
                            <div style="position: relative;">
                                <input type="password" id="currentPassInput" required placeholder="Enter your existing password"
                                    style="width: 100%; padding: 8px 36px 8px 12px; border-radius: 12px; border: 1px solid #E5E7EB; outline: none; font-size: 12px;">
                                <button type="button" onclick="togglePasswordVisibility('currentPassInput', this)"
                                    style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9CA3AF;">
                                    <svg class="eye-open-icon w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                </button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block font-medium text-gray-700 mb-1">New Password *</label>
                                <div style="position: relative;">
                                    <input type="password" id="newPassInput" required minlength="6" placeholder="Min 6 characters"
                                        style="width: 100%; padding: 8px 36px 8px 12px; border-radius: 12px; border: 1px solid #E5E7EB; outline: none; font-size: 12px;">
                                    <button type="button" onclick="togglePasswordVisibility('newPassInput', this)"
                                        style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9CA3AF;">
                                        <svg class="eye-open-icon w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label class="block font-medium text-gray-700 mb-1">Confirm New Password *</label>
                                <div style="position: relative;">
                                    <input type="password" id="confirmPassInput" required minlength="6" placeholder="Re-enter new password"
                                        style="width: 100%; padding: 8px 36px 8px 12px; border-radius: 12px; border: 1px solid #E5E7EB; outline: none; font-size: 12px;">
                                    <button type="button" onclick="togglePasswordVisibility('confirmPassInput', this)"
                                        style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9CA3AF;">
                                        <svg class="eye-open-icon w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-end pt-1">
                            <button type="submit" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold transition cursor-pointer">
                                Verify & Update Password
                            </button>
                        </div>
                    </form>

                    <!-- Hidden Forgot Password Reset Box -->
                    <div id="forgotPasswordBox" class="hidden pt-4 border-t border-[#F0F4F2]">
                        <div class="p-4 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] space-y-3">
                            <div class="flex items-center justify-between">
                                <p class="text-xs font-semibold text-gray-900">Reset Forgotten Password</p>
                                <button type="button" onclick="toggleForgotPasswordBox()" class="text-[11px] text-gray-400 hover:text-gray-700">Cancel</button>
                            </div>
                            <form onsubmit="handleForgotPasswordReset(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label class="block font-medium text-gray-700 mb-1">Registered Work Email</label>
                                    <input type="email" id="resetEmailInput" value="${currentUser ? currentUser.email : ''}" required
                                        class="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-[#1E6B52]">
                                </div>
                                <div>
                                    <label class="block font-medium text-gray-700 mb-1">Set New Password</label>
                                    <div style="position: relative;">
                                        <input type="password" id="resetNewPassInput" required minlength="6" placeholder="New password"
                                            style="width: 100%; padding: 8px 36px 8px 12px; border-radius: 12px; border: 1px solid #E5E7EB; outline: none; font-size: 12px; background: #fff;">
                                        <button type="button" onclick="togglePasswordVisibility('resetNewPassInput', this)"
                                            style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9CA3AF;">
                                            <svg class="eye-open-icon w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="sm:col-span-2 flex justify-end">
                                    <button type="submit" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition cursor-pointer">
                                        Reset Password Now
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT: Keyboard Shortcuts & Support (Full width on mobile, 4 cols on PC) -->
            <div class="col-span-12 lg:col-span-4 space-y-4">
                
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5 space-y-3 text-xs">
                    <h3 class="text-sm font-semibold text-gray-900">Keyboard Shortcuts</h3>
                    <div class="flex justify-between items-center py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-500">Quick Search</span>
                        <kbd class="px-2 py-0.5 rounded bg-[#F6F8F7] border border-gray-200 text-[10px] font-mono">⌘ K / Ctrl+K</kbd>
                    </div>
                    <div class="flex justify-between items-center py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-500">New Task Modal</span>
                        <kbd class="px-2 py-0.5 rounded bg-[#F6F8F7] border border-gray-200 text-[10px] font-mono">+ Create new</kbd>
                    </div>
                    <div class="flex justify-between items-center py-1.5">
                        <span class="text-gray-500">Shift Check-in/out</span>
                        <span class="text-[11px] font-medium text-[#1E6B52]">Right Panel</span>
                    </div>
                </div>

                <div class="bg-[#EEF4F0] rounded-2xl border border-[#DCE8E0] p-4 sm:p-5 space-y-2.5 text-xs">
                    <h3 class="text-sm font-semibold text-gray-900">Need Workspace Support?</h3>
                    <p class="text-[11px] text-gray-600 leading-relaxed">
                        Facing an issue with attendance logs, role permissions, or task access? Raise an internal query for Admin/IT support.
                    </p>
                    <button onclick="switchSection('queries')" class="w-full py-2 px-4 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold transition cursor-pointer">
                        Open Helpdesk Query →
                    </button>
                </div>

            </div>

        </div>
    `;
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const eyeOpenSvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    const eyeClosedSvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>`;

    if (input.type === "password") {
        input.type = "text";
        btn.innerHTML = eyeClosedSvg;
    } else {
        input.type = "password";
        btn.innerHTML = eyeOpenSvg;
    }
}

function toggleForgotPasswordBox() {
    document.getElementById("forgotPasswordBox").classList.toggle("hidden");
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const current_password = document.getElementById("currentPassInput").value;
    const new_password = document.getElementById("newPassInput").value;
    const confirm_password = document.getElementById("confirmPassInput").value;

    if (new_password !== confirm_password) {
        alert("New password and confirm password do not match!");
        return;
    }

    try {
        const res = await apiRequest("/users/change-password", "POST", {
            current_password,
            new_password
        });
        alert(res.message || "Password updated successfully!");
        e.target.reset();
    } catch (err) {
        alert("Verification Failed: " + (err.message || "Failed to fetch"));
    }
}

async function handleForgotPasswordReset(e) {
    e.preventDefault();
    const email = document.getElementById("resetEmailInput").value;
    const new_password = document.getElementById("resetNewPassInput").value;

    try {
        const res = await apiRequest("/users/forgot-password", "POST", {
            email,
            new_password
        });
        alert(res.message || "Password reset successfully!");
        toggleForgotPasswordBox();
        e.target.reset();
    } catch (err) {
        alert("Reset Failed: " + (err.message || "Failed to fetch"));
    }
}

registerSection("settings", renderSettingsSection);