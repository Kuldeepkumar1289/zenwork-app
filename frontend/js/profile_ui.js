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

    if (window.LivePresence) {
        await window.LivePresence.refresh();
    }

    const userInitials = currentUser.full_name
        .split(" ")
        .map(part => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const avatarSrc = resolveAvatarSrc(currentUser.avatar_url);
    const displayEmpId = currentUser.employee_code || `#ZW-00${currentUser.id}`;
    const managerLabel = currentUser.manager_id
        ? (window.LivePresence ? window.LivePresence.formatNameWithId(currentUser.manager_id) : `User #${currentUser.manager_id}`)
        : "Top Level";
    const liveStatusPill = window.LivePresence ? window.LivePresence.badgeHtml(currentUser.id) : "";

    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-[#1E6B52]">ACCOUNT &amp; PREFERENCES</p>
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
                                ? `<img src="${avatarSrc}" alt="" onerror="this.parentElement.textContent='${userInitials}'" class="w-full h-full object-cover">`
                                : userInitials}
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-base font-semibold text-gray-900 truncate">${esc(currentUser.full_name)}</h2>
                            <p class="text-xs text-gray-500 truncate">${esc(currentUser.designation)} • ${esc(currentUser.email)}</p>
                            <div class="flex items-center gap-2 flex-wrap mt-1.5">
                                <span class="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6F4EA] text-[#1E6B52]">
                                    ${esc(currentUser.role_tier)} TIER
                                </span>
                                ${liveStatusPill}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <input type="file" id="profileDpInput" accept="image/*" class="hidden" onchange="openDpCropperModal(event)">
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
                            <input type="text" id="profFullName" value="${esc(currentUser.full_name)}" required
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1E6B52]">
                        </div>
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Designation</label>
                            <input type="text" id="profDesignation" value="${esc(currentUser.designation)}" required
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1E6B52]">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Work Email (Read-only)</label>
                            <input type="email" value="${esc(currentUser.email)}" disabled
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#F6F8F7] text-gray-500 cursor-not-allowed">
                        </div>
                        <div>
                            <label class="block font-medium text-gray-700 mb-1">Organization (Locked)</label>
                            <input type="text" value="${esc((currentUser.company_name || 'Zenwork Studio') + (currentUser.company_code ? ' (' + currentUser.company_code + ')' : ''))}" disabled
                                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#F6F8F7] text-gray-500 cursor-not-allowed">
                        </div>
                    </div>

                    <div class="pt-4 border-t border-[#F0F4F2] space-y-3">
                        <h3 class="text-xs font-semibold text-gray-900">Workspace Settings</h3>
                        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F6F8F7] border border-[#E6ECE8] cursor-pointer">
                            <div>
                                <p class="font-medium text-gray-800">Task &amp; Blocker Alerts</p>
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
                        <span class="font-mono font-semibold text-gray-800">${esc(displayEmpId)}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Organization</span>
                        <span class="font-medium text-gray-800">${esc(currentUser.company_name || "Zenwork Studio")}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-[#F6F8F7]">
                        <span class="text-gray-400">Access Level</span>
                        <span class="font-semibold text-[#1E6B52]">${esc(currentUser.role_tier)}</span>
                    </div>
                    <div class="flex justify-between py-1.5">
                        <span class="text-gray-400">Reporting Manager</span>
                        <span class="font-medium text-gray-800">${esc(managerLabel)}</span>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-[#E6ECE8] p-4 sm:p-5 space-y-3 text-xs">
                    <h3 class="text-sm font-semibold text-gray-900">Security &amp; Session</h3>
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

function openDpCropperModal(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
        if (typeof showToast === "function") showToast("Please choose an image smaller than 8 MB.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => launchCropperOverlay(img);
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function launchCropperOverlay(img) {
    const existing = document.getElementById("dpCropperModal");
    if (existing) existing.remove();

    const boxSize = 260;
    const baseScale = Math.max(boxSize / img.width, boxSize / img.height);
    let zoom = 1;
    let offsetX = (boxSize - img.width * baseScale) / 2;
    let offsetY = (boxSize - img.height * baseScale) / 2;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const modal = document.createElement("div");
    modal.id = "dpCropperModal";
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(6px); display: flex; align-items: center;
        justify-content: center; padding: 16px; z-index: 25000;
    `;
    modal.innerHTML = `
        <div style="background:#fff;border-radius:24px;max-width:380px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.25);">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-base font-bold text-gray-900">Crop Profile Photo</h3>
                <button type="button" id="closeCropperBtn" class="text-gray-400 hover:text-gray-700 text-lg font-bold cursor-pointer">&times;</button>
            </div>
            <p class="text-[11px] text-gray-500 mb-4">Drag the image to reposition and use the slider to zoom.</p>

            <div class="flex justify-center">
                <canvas id="dpCropCanvas" width="${boxSize}" height="${boxSize}"
                    style="border-radius:20px;border:2px solid #1E6B52;cursor:grab;touch-action:none;background:#0f172a;">
                </canvas>
            </div>

            <div class="mt-4 flex items-center gap-3 text-xs">
                <span class="text-gray-500 font-medium">Zoom</span>
                <input type="range" id="dpZoomSlider" min="1" max="3" step="0.02" value="1" class="w-full accent-[#1E6B52] cursor-pointer">
                <span id="dpZoomValue" class="text-gray-700 font-semibold w-10 text-right">1.0x</span>
            </div>

            <div class="mt-5 flex gap-2">
                <button type="button" id="cancelCropBtn" class="w-1/3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 cursor-pointer">
                    Cancel
                </button>
                <button type="button" id="confirmCropBtn" class="w-2/3 py-2.5 rounded-xl bg-[#1E6B52] hover:bg-[#15523E] text-white text-xs font-semibold cursor-pointer">
                    Crop &amp; Save Photo
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const canvas = document.getElementById("dpCropCanvas");
    const ctx = canvas.getContext("2d");
    const slider = document.getElementById("dpZoomSlider");
    const zoomLabel = document.getElementById("dpZoomValue");

    function clampOffsets() {
        const currentScale = baseScale * zoom;
        const drawW = img.width * currentScale;
        const drawH = img.height * currentScale;
        const minX = boxSize - drawW;
        const minY = boxSize - drawH;
        offsetX = Math.min(0, Math.max(minX, offsetX));
        offsetY = Math.min(0, Math.max(minY, offsetY));
    }

    function drawPreview() {
        clampOffsets();
        const currentScale = baseScale * zoom;
        ctx.clearRect(0, 0, boxSize, boxSize);
        ctx.drawImage(img, offsetX, offsetY, img.width * currentScale, img.height * currentScale);

        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(boxSize / 2, boxSize / 2, boxSize / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawPreview();

    slider.addEventListener("input", () => {
        const prevScale = baseScale * zoom;
        zoom = parseFloat(slider.value);
        const nextScale = baseScale * zoom;
        zoomLabel.textContent = `${zoom.toFixed(1)}x`;

        const centerX = boxSize / 2;
        const centerY = boxSize / 2;
        offsetX = centerX - ((centerX - offsetX) / prevScale) * nextScale;
        offsetY = centerY - ((centerY - offsetY) / prevScale) * nextScale;
        drawPreview();
    });

    const startDrag = (clientX, clientY) => {
        dragging = true;
        startX = clientX - offsetX;
        startY = clientY - offsetY;
        canvas.style.cursor = "grabbing";
    };
    const moveDrag = (clientX, clientY) => {
        if (!dragging) return;
        offsetX = clientX - startX;
        offsetY = clientY - startY;
        drawPreview();
    };
    const endDrag = () => {
        dragging = false;
        canvas.style.cursor = "grab";
    };

    canvas.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
    window.addEventListener("mouseup", endDrag);

    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
        if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    canvas.addEventListener("touchend", endDrag);

    const closeModal = () => modal.remove();
    document.getElementById("closeCropperBtn").onclick = closeModal;
    document.getElementById("cancelCropBtn").onclick = closeModal;

    document.getElementById("confirmCropBtn").onclick = async () => {
        const saveBtn = document.getElementById("confirmCropBtn");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        const outSize = 320;
        const ratio = outSize / boxSize;
        const currentScale = baseScale * zoom * ratio;
        const outCanvas = document.createElement("canvas");
        outCanvas.width = outSize;
        outCanvas.height = outSize;
        const outCtx = outCanvas.getContext("2d");
        outCtx.drawImage(
            img,
            offsetX * ratio,
            offsetY * ratio,
            img.width * currentScale,
            img.height * currentScale
        );

        const croppedDataUrl = outCanvas.toDataURL("image/jpeg", 0.82);

        try {
            const updatedUser = await apiRequest("/users/me/profile", "PATCH", {
                avatar_url: croppedDataUrl
            });
            currentUser = updatedUser;
            localStorage.setItem("zenwork_user", JSON.stringify(currentUser));
            if (typeof updateProfileUI === "function") updateProfileUI(currentUser);
            if (typeof showToast === "function") showToast("Profile photo saved!", "success");
            closeModal();
            renderProfileSection();
        } catch (err) {
            if (typeof showToast === "function") showToast(err.message || "Could not save profile photo.", "error");
            saveBtn.disabled = false;
            saveBtn.textContent = "Crop & Save Photo";
        }
    };
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