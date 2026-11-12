function renderSettingsSection() {
    const container = document.getElementById("section-dynamic");

    container.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">PREFERENCES & HELP</p>
                <h1 class="text-2xl font-semibold text-gray-900 mt-0.5">Settings & Support</h1>
                <p class="text-xs text-gray-500 mt-0.5">Customize your notifications, chat privacy, security, and workspace help.</p>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-5 items-start">
            
            <!-- LEFT: Preferences & Security (8 Columns) -->
            <div class="col-span-8 space-y-5">
                
                <!-- 1. Notification & Privacy Toggles -->
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-6 space-y-4">
                    <h2 class="text-sm font-semibold text-gray-900">Notifications & Chat Privacy</h2>
                    
                    <label class="flex items-center justify-between p-3.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                        <div>
                            <p class="text-xs font-semibold text-gray-800">Task & Blocker Instant Alerts</p>
                            <p class="text-[11px] text-gray-400">Notify immediately when a task is assigned to you or marked blocked</p>
                        </div>
                        <input type="checkbox" checked class="w-4 h-4 accent-[#1E6B52]">
                    </label>

                    <label class="flex items-center justify-between p-3.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                        <div>
                            <p class="text-xs font-semibold text-gray-800">Direct Message Approval Guard</p>
                            <p class="text-[11px] text-gray-400">Show Accept / Decline / Ignore prompt for incoming 1-on-1 chat requests</p>
                        </div>
                        <input type="checkbox" checked class="w-4 h-4 accent-[#1E6B52]">
                    </label>

                    <label class="flex items-center justify-between p-3.5 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                        <div>
                            <p class="text-xs font-semibold text-gray-800">Mute Mic on Voice Lounge Join</p>
                            <p class="text-[11px] text-gray-400">Join Design Lounge or team voice rooms with microphone muted by default</p>
                        </div>
                        <input type="checkbox" checked class="w-4 h-4 accent-[#1E6B52]">
                    </label>

                    <div class="pt-1 flex justify-end">
                        <button onclick="alert('Workspace preferences saved!')" class="px-4 py-2 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold transition cursor-pointer">
                            Save preferences
                        </button>
                    </div>
                </div>

            <!-- 2. Password & Security (Verify Current + Forgot Option) -->
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-6 space-y-4">
                    <div class="flex items-center justify-between">
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
                            <input type="password" id="currentPassInput" required placeholder="Enter your existing password"
                                class="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1E6B52]">
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block font-medium text-gray-700 mb-1">New Password *</label>
                                <input type="password" id="newPassInput" required minlength="6" placeholder="Min 6 characters"
                                    class="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1E6B52]">
                            </div>
                            <div>
                                <label class="block font-medium text-gray-700 mb-1">Confirm New Password *</label>
                                <input type="password" id="confirmPassInput" required minlength="6" placeholder="Re-enter new password"
                                    class="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1E6B52]">
                            </div>
                        </div>
                        <div class="flex justify-end pt-1">
                            <button type="submit" class="px-4 py-2 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold transition cursor-pointer">
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
                            <form onsubmit="handleForgotPasswordReset(event)" class="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label class="block font-medium text-gray-700 mb-1">Registered Work Email</label>
                                    <input type="email" id="resetEmailInput" value="${currentUser ? currentUser.email : ''}" required
                                        class="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-[#1E6B52]">
                                </div>
                                <div>
                                    <label class="block font-medium text-gray-700 mb-1">Set New Password</label>
                                    <input type="password" id="resetNewPassInput" required minlength="6" placeholder="New password (min 6 chars)"
                                        class="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-[#1E6B52]">
                                </div>
                                <div class="col-span-2 flex justify-end">
                                    <button type="submit" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition cursor-pointer">
                                        Reset Password Now
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

            <!-- RIGHT: Keyboard Shortcuts & Support (4 Columns) -->
            <div class="col-span-4 space-y-4">
                
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-3 text-xs">
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

                <div class="bg-[#EEF4F0] rounded-2xl border border-[#DCE8E0] p-5 space-y-2.5 text-xs">
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

function handlePasswordChange(e) {
    e.preventDefault();
    const p1 = document.getElementById("newPassInput").value;
    const p2 = document.getElementById("confirmPassInput").value;
    if (p1 !== p2) {
        alert("Passwords do not match!");
        return;
    }
    alert("Password update request recorded! (Connect /users/me/password endpoint to persist in DB)");
    e.target.reset();
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
        alert(res.message);
        e.target.reset();
    } catch (err) {
        alert("Verification Failed: " + err.message);
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
        alert(res.message);
        toggleForgotPasswordBox();
        e.target.reset();
    } catch (err) {
        alert("Reset Failed: " + err.message);
    }
}