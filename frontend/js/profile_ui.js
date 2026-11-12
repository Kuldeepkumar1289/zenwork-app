async function renderProfileSection() {
    const container = document.getElementById("section-dynamic");
    if (!currentUser) {
        const saved = localStorage.getItem("zenwork_user");
        currentUser = saved ? JSON.parse(saved) : await apiRequest("/users/me");
    }
    if (!currentUser) return;

    const initials = currentUser.full_name
        .split(" ")
        .map(part => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    container.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">ACCOUNT & PREFERENCES</p>
                <h1 class="text-2xl font-semibold text-gray-900 mt-0.5">Your space in the workspace.</h1>
                <p class="text-xs text-gray-500 mt-0.5">Manage your personal details, workspace settings, and security.</p>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-5 items-start">
            
            <!-- LEFT: Personal Details & Workspace Preferences (8 Columns) -->
            <div class="col-span-8 bg-white rounded-2xl border border-[#E6ECE8] p-6 space-y-5">
                <div class="flex items-center gap-4 pb-5 border-b border-[#F0F4F2]">
                    <div class="w-14 h-14 rounded-2xl bg-[#1E6B52] text-white flex items-center justify-center text-lg font-bold">
                        ${initials}
                    </div>
                    <div>
                        <h2 class="text-base font-semibold text-gray-900">${currentUser.full_name}</h2>
                        <p class="text-xs text-gray-500">${currentUser.designation} • ${currentUser.email}</p>
                        <span class="inline-block mt-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6F4EA] text-[#1E6B52]">
                            ${currentUser.role_tier} TIER
                        </span>
                    </div>
                </div>

                <form id="profileUpdateForm" class="space-y-4 text-xs">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Full Name</label>
                            <input type="text" id="profFullName" value="${currentUser.full_name}" required
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1E6B52]">
                        </div>
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Designation</label>
                            <input type="text" id="profDesignation" value="${currentUser.designation}" required
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1E6B52]">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Work Email (Read-only)</label>
                            <input type="email" value="${currentUser.email}" disabled
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#F6F8F7] text-gray-500 cursor-not-allowed">
                        </div>
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Timezone</label>
                            <input type="text" value="Asia/Kolkata (UTC +05:30)" disabled
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#F6F8F7] text-gray-500">
                        </div>
                    </div>

                    <!-- Notification & Privacy Toggles -->
                    <div class="pt-4 border-t border-[#F0F4F2] space-y-3">
                        <h3 class="text-xs font-semibold text-gray-900">Workspace Settings</h3>
                        <label class="flex items-center justify-between p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-medium text-gray-800">Task & Blocker Alerts</p>
                                <p class="text-[11px] text-gray-400">Receive instant notifications when tasks are assigned or blocked</p>
                            </div>
                            <input type="checkbox" checked class="w-4 h-4 accent-[#1E6B52]">
                        </label>
                        <label class="flex items-center justify-between p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-medium text-gray-800">Require Approval for Direct Chats</p>
                                <p class="text-[11px] text-gray-400">Show Accept / Decline / Ignore popup before new teammates message you</p>
                            </div>
                            <input type="checkbox" checked class="w-4 h-4 accent-[#1E6B52]">
                        </label>
                    </div>

                    <div class="pt-2 flex justify-end">
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold transition cursor-pointer">
                            Save changes
                        </button>
                    </div>
                </form>
            </div>

            <!-- RIGHT: Account Metadata & Security Card (4 Columns) -->
            <div class="col-span-4 space-y-4">
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-3 text-xs">
                    <h3 class="text-sm font-semibold text-gray-900">Account Information</h3>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Employee ID</span>
                        <span class="font-mono font-semibold text-gray-800">#ZW-00${currentUser.id}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Workspace</span>
                        <span class="font-medium text-gray-800">ACME Studio</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Access Level</span>
                        <span class="font-semibold text-[#1E6B52]">${currentUser.role_tier}</span>
                    </div>
                    <div class="flex justify-between py-1.5">
                        <span class="text-gray-400">Reporting Manager</span>
                        <span class="font-medium text-gray-800">${currentUser.manager_id ? 'User #' + currentUser.manager_id : 'Top Level'}</span>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-5 space-y-3 text-xs">
                    <h3 class="text-sm font-semibold text-gray-900">Security & Session</h3>
                    <p class="text-[11px] text-gray-500">Signed in with JWT Bearer authentication. Sign out from all devices if using a shared system.</p>
                    <button onclick="logout()" class="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition cursor-pointer">
                        Sign out of workspace
                    </button>
                </div>
            </div>

        </div>
    `;

    document.getElementById("profileUpdateForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const updatedName = document.getElementById("profFullName").value;
        const updatedDesignation = document.getElementById("profDesignation").value;

        try {
            // Update local profile state and sync if admin endpoint is available
            if (currentUser.role_tier === "ADMIN") {
                await apiRequest(`/admin/users/${currentUser.id}`, "PATCH", {
                    full_name: updatedName,
                    designation: updatedDesignation
                });
            }
            currentUser.full_name = updatedName;
            currentUser.designation = updatedDesignation;
            localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
            updateProfileUI(currentUser);
            alert("Profile settings saved!");
        } catch (err) {
            alert("Saved locally: " + err.message);
        }
    });
}