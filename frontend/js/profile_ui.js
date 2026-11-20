function resolveAvatarSrc(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
    const base = (typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "https://zenwork-app.onrender.com")
        .replace(/\/api\/v1\/?$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

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

    const avatarSrc = resolveAvatarSrc(currentUser.avatar_url);

    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">ACCOUNT & PREFERENCES</p>
                <h1 class="text-2xl font-semibold text-gray-900 mt-0.5">Your space in the workspace.</h1>
                <p class="text-xs text-gray-500 mt-0.5">Manage your profile picture, personal details, and workspace security.</p>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 sm:gap-5 items-start mt-4">
            
            <!-- LEFT: Profile Picture + Personal Details -->
            <div class="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-6 space-y-5">
                <div class="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-[#F0F4F2]">
                    <div class="flex items-center gap-3.5 sm:gap-4 min-w-0">
                        <div id="profileAvatarPreview" class="w-16 h-16 rounded-2xl bg-[#1E6B52] text-white flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden border border-[#E6ECE8]">
                            ${avatarSrc
                                ? `<img src="${avatarSrc}" alt="${currentUser.full_name}" class="w-full h-full object-cover">`
                                : initials}
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-base font-semibold text-gray-900 truncate">${currentUser.full_name}</h2>
                            <p class="text-xs text-gray-500 truncate">${currentUser.designation} • ${currentUser.email}</p>
                            <span class="inline-block mt-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6F4EA] text-[#1E6B52]">
                                ${currentUser.role_tier} TIER
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <input type="file" id="profileDpInput" accept="image/*" class="hidden" onchange="handleProfileDpUpload(event)">
                        <button type="button" id="uploadDpBtn" onclick="document.getElementById('profileDpInput').click()"
                            class="px-3.5 py-2 rounded-xl bg-[#EBF3EF] hover:bg-[#DCEBE3] text-[#1E6B52] text-xs font-semibold transition cursor-pointer">
                            Change Photo
                        </button>
                        ${avatarSrc ? `
                            <button type="button" onclick="removeProfileDp()"
                                class="px-3 py-2 rounded-xl border border-gray-200 hover:bg-red-50 hover:text-red-600 text-gray-500 text-xs font-semibold transition cursor-pointer">
                                Remove
                            </button>
                        ` : ""}
                    </div>
                </div>

                <form id="profileUpdateForm" class="space-y-4 text-xs">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Work Email (Read-only)</label>
                            <input type="email" value="${currentUser.email}" disabled
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#F6F8F7] text-gray-500 cursor-not-allowed">
                        </div>
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Organization (Locked)</label>
                            <input type="text" value="${currentUser.company_name || 'Zenwork Studio'}${currentUser.company_code ? ' (' + currentUser.company_code + ')' : ''}" disabled
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#F6F8F7] text-gray-500 cursor-not-allowed">
                        </div>
                    </div>

                    <div class="pt-4 border-t border-[#F0F4F2] space-y-3">
                        <h3 class="text-xs font-semibold text-gray-900">Workspace Settings</h3>
                        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-medium text-gray-800">Task & Blocker Alerts</p>
                                <p class="text-[11px] text-gray-400">Receive instant notifications when tasks are assigned or blocked</p>
                            </div>
                            <input type="checkbox" checked class="w-4 h-4 shrink-0 accent-[#1E6B52]">
                        </label>
                        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-medium text-gray-800">Require Approval for Direct Chats</p>
                                <p class="text-[11px] text-gray-400">Show Accept / Decline / Ignore popup before new teammates message you</p>
                            </div>
                            <input type="checkbox" checked class="w-4 h-4 shrink-0 accent-[#1E6B52]">
                        </label>
                    </div>

                    <div class="pt-2 flex justify-end">
                        <button type="submit" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white font-semibold transition cursor-pointer">
                            Save changes
                        </button>
                    </div>
                </form>
            </div>

            <!-- RIGHT: Account Metadata & Security Card -->
            <div class="col-span-12 lg:col-span-4 space-y-4">
                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5 space-y-3 text-xs">
                    <h3 class="text-sm font-semibold text-gray-900">Account Information</h3>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Employee ID</span>
                        <span class="font-mono font-semibold text-gray-800">#ZW-00${currentUser.id}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Organization</span>
                        <span class="font-medium text-gray-800">${currentUser.company_name || "Zenwork Studio"}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Access Level</span>
                        <span class="font-semibold text-[#1E6B52]">${currentUser.role_tier}</span>
                    </div>
                    <div class="flex justify-between py-1.5">
                        <span class="text-gray-400">Reporting Manager</span>
                        <span class="font-medium text-gray-800">${currentUser.manager_id ? "User #" + currentUser.manager_id : "Top Level"}</span>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5 space-y-3 text-xs">
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
        const updatedName = document.getElementById("profFullName").value.trim();
        const updatedDesignation = document.getElementById("profDesignation").value.trim();

        try {
            const updatedUser = await apiRequest("/users/me/profile", "PATCH", {
                full_name: updatedName,
                designation: updatedDesignation
            });
            currentUser = updatedUser;
            localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
            if (typeof updateProfileUI === "function") updateProfileUI(currentUser);
            if (typeof showToast === "function") showToast("Profile updated successfully!", "success");
            renderProfileSection();
        } catch (err) {
            if (typeof showToast === "function") showToast(err.message || "Could not update profile.", "error");
        }
    });
}

async function handleProfileDpUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        if (typeof showToast === "function") showToast("Please choose an image smaller than 5 MB.", "error");
        return;
    }

    const btn = document.getElementById("uploadDpBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading..."; }

    try {
        const formData = new FormData();
        formData.append("file", file, file.name);
        const headers = { Authorization: `Bearer ${getAuthToken()}` };

        let uploadRes = await fetch(`${API_BASE_URL}/media/upload`, { method: "POST", headers, body: formData });
        if (uploadRes.status === 404) {
            uploadRes = await fetch(`${API_BASE_URL}/media/upload-voice`, { method: "POST", headers, body: formData });
        }
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.detail || "Photo upload failed");

        const updatedUser = await apiRequest("/users/me/profile", "PATCH", {
            avatar_url: uploadData.media_url
        });
        currentUser = updatedUser;
        localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
        if (typeof updateProfileUI === "function") updateProfileUI(currentUser);
        if (typeof showToast === "function") showToast("Profile photo updated!", "success");
        renderProfileSection();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message || "Could not upload profile photo.", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Change Photo"; }
    }
}

async function removeProfileDp() {
    try {
        const updatedUser = await apiRequest("/users/me/profile", "PATCH", { avatar_url: null });
        currentUser = updatedUser;
        localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
        if (typeof updateProfileUI === "function") updateProfileUI(currentUser);
        if (typeof showToast === "function") showToast("Profile photo removed.", "info");
        renderProfileSection();
    } catch (err) {
        if (typeof showToast === "function") showToast(err.message || "Could not remove photo.", "error");
    }
}