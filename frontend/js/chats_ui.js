/* chats_ui.js — Structured Notice Board, Unread Alerts,
   Live Toast Notifications, Files/Media & Voice DMs */

let chatThreads = [];
let chatActive = null;
let pendingChatInvites = [];
let globalChatPollTimer = null;
let inviteNoticeText = "";

let showNoticeComposer = false;
let pendingAttachment = null;
let dmRecorder = null;
let dmAudioChunks = [];
let dmRecordTimer = null;
let dmRecordSeconds = 0;

// Unread & latest-message state across all teammates
let unreadByUser = {};       // { [userId]: { count, senderName, text, timeStr } }
let latestMetaByUser = {};   // { [userId]: { text, at, timeStr, mine } }
let lastToastMsgId = 0;
let watcherBootstrapped = false;

function chatErrMsg(err) {
  if (!err) return "Request failed";
  if (typeof err.message === "string" && err.message !== "[object Object]") return err.message;
  if (Array.isArray(err.detail)) {
    return err.detail.map(d => `${(d.loc || []).slice(-1)[0] || "Field"}: ${d.msg}`).join(", ");
  }
  return JSON.stringify(err.detail || err.message || err);
}

function resolveMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://127.0.0.1:8001/api/v1")
    .replace(/\/api\/v1\/?$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function formatChatLocalTime(val) {
  if (!val) return "";
  let str = String(val).trim();
  if (str && !str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str = str.replace(" ", "T") + "Z";
  }
  const d = new Date(str);
  return isNaN(d) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/*  Per-User Read Cursor Storage  */
function getReadMap() {
  if (!currentUser?.id) return {};
  try {
    return JSON.parse(localStorage.getItem(`zenwork_chat_read_${currentUser.id}`) || "{}");
  } catch {
    return {};
  }
}

function markPartnerRead(partnerId, maxMsgId) {
  if (!currentUser?.id || !partnerId || !maxMsgId) return;
  const map = getReadMap();
  if ((map[partnerId] || 0) < maxMsgId) {
    map[partnerId] = maxMsgId;
    localStorage.setItem(`zenwork_chat_read_${currentUser.id}`, JSON.stringify(map));
  }
  delete unreadByUser[partnerId];
  updateGlobalUnreadBadges();
}

/*  Direct File / Image / Audio Download  */
async function downloadChatFile(rawUrl, suggestedName) {
  const fullUrl = resolveMediaUrl(rawUrl);
  const fileName = suggestedName || rawUrl.split("/").pop() || "zenwork-file";
  try {
    const res = await fetch(fullUrl);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    window.open(fullUrl, "_blank", "noopener");
  }
}

/*  Floating Toast & Subtle Sound Alert  */
function playSoftPing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

function showIncomingMessageToast(partnerId, senderName, text, timeStr) {
  document.getElementById("zenChatToast")?.remove();
  playSoftPing();

  const toast = document.createElement("div");
  toast.id = "zenChatToast";
  toast.style.cssText = `
    position: fixed;
    bottom: 22px;
    right: 22px;
    width: 320px;
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-left: 4px solid var(--accent, #4F46E5);
    border-radius: 16px;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
    padding: 13px 15px;
    z-index: 10000;
    color: #0F172A;
  `;
  toast.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:700;color:var(--accent, #4F46E5);text-transform:uppercase;letter-spacing:.04em;">
        New Message • ${esc(timeStr)}
      </span>
      <button type="button" onclick="document.getElementById('zenChatToast')?.remove()"
        style="font-size:13px;color:#64748B;cursor:pointer;line-height:1;">✕</button>
    </div>
    <div style="font-size:13px;font-weight:700;color:#0F172A;">${esc(senderName)} messaged you</div>
    <div style="font-size:12px;color:#475569;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      ${esc(text || "Sent an attachment")}
    </div>
    <div style="margin-top:10px;display:flex;justify-content:flex-end;">
      <button type="button" id="zenToastOpenBtn"
        style="padding:5px 12px;border-radius:9px;background:var(--accent, #4F46E5);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">
        Open Chat
      </button>
    </div>
  `;
  document.body.appendChild(toast);

  document.getElementById("zenToastOpenBtn")?.addEventListener("click", async () => {
    toast.remove();
    if (typeof switchSection === "function") switchSection("chats");
    setTimeout(() => openChat(`dm-${partnerId}`), 120);
  });

  setTimeout(() => {
    document.getElementById("zenChatToast")?.remove();
  }, 7000);
}

/*  Global Unread Badges (Sidebar + Topbar Bell)  */
function updateGlobalUnreadBadges() {
  const totalUnreadMsgs = Object.values(unreadByUser).reduce((sum, item) => sum + (item.count || 0), 0);
  const totalAlerts = totalUnreadMsgs + pendingChatInvites.length;

  const navChats = document.getElementById("nav-chats");
  if (navChats) {
    let badge = document.getElementById("navChatsUnreadBadge");
    if (totalAlerts > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.id = "navChatsUnreadBadge";
        badge.style.cssText = `
          margin-left:auto;
          min-width:19px;
          height:19px;
          padding:0 6px;
          border-radius:999px;
          background:#EF4444;
          color:#FFFFFF;
          font-size:11px;
          font-weight:700;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        `;
        navChats.style.display = "flex";
        navChats.style.alignItems = "center";
        navChats.appendChild(badge);
      }
      badge.textContent = String(totalAlerts);
    } else if (badge) {
      badge.remove();
    }
  }

  const notifDot = document.querySelector('.topbar-right button[title="Notifications"] .notif-dot');
  if (notifDot && totalAlerts > 0) {
    notifDot.style.display = "block";
    notifDot.style.background = "#EF4444";
  }
}

window.getUnreadChatSummaries = function () {
  const list = [];
  for (const inv of pendingChatInvites) {
    list.push({
      partnerId: inv.sender_id,
      title: `${inv.sender?.full_name || "Teammate"} sent a chat request`,
      sub: inv.initial_message || "Click to Accept or Decline",
      time: formatChatLocalTime(inv.created_at)
    });
  }
  for (const [uid, info] of Object.entries(unreadByUser)) {
    list.push({
      partnerId: Number(uid),
      title: `${info.senderName} messaged you (${info.count})`,
      sub: info.text || "Sent an attachment",
      time: info.timeStr
    });
  }
  return list;
};

/*  Background Watcher (Runs Across All Sections)  */
async function pollAllChatsAndNotifications() {
  if (!currentUser?.id || !getAuthToken()) return;
  if ((dmRecorder && dmRecorder.state === "recording") || showNoticeComposer || pendingAttachment) return;

  try {
    const [tree, invites] = await Promise.all([
      fetchOr(API.orgTree, []),
      fetchOr("/communications/chat/invites/pending", [])
    ]);

    pendingChatInvites = Array.isArray(invites) ? invites : [];
    const teammates = flattenOrgTree(Array.isArray(tree) ? tree : []).filter(u => u.id !== currentUser.id);
    const readMap = getReadMap();

    const chatsVisible = (() => {
      const dyn = document.getElementById("section-dynamic");
      return dyn && !dyn.classList.contains("hidden") && Boolean(document.getElementById("chatMsgs"));
    })();

    let newestIncoming = null;

    await Promise.all(teammates.map(async (u) => {
      const history = await fetchOr(`/communications/chat/messages/${u.id}`, null);
      if (!Array.isArray(history) || !history.length) return;

      const lastMsg = history[history.length - 1];
      const timeStr = formatChatLocalTime(lastMsg.created_at);
      latestMetaByUser[u.id] = {
        text: lastMsg.message_text || (lastMsg.attachment_url ? "Attachment" : ""),
        at: lastMsg.created_at,
        timeStr,
        mine: lastMsg.sender_id === currentUser.id
      };

      const thread = chatThreads.find(t => t.id === `dm-${u.id}`);
      if (thread) {
        thread.messages = history.map(m => ({
          id: m.id,
          from: m.sender?.full_name || (m.sender_id === currentUser.id ? "You" : u.full_name),
          text: m.message_text || "",
          attachmentUrl: m.attachment_url || null,
          at: m.created_at,
          mine: m.sender_id === currentUser.id
        }));
      }

      const isCurrentlyViewingThisDm = chatsVisible && chatActive === `dm-${u.id}`;
      if (isCurrentlyViewingThisDm) {
        markPartnerRead(u.id, lastMsg.id);
        return;
      }

      const lastReadId = readMap[u.id] || 0;
      const unreadMsgs = history.filter(m => m.sender_id !== currentUser.id && m.id > lastReadId);

      if (unreadMsgs.length > 0) {
        const latestFromOther = unreadMsgs[unreadMsgs.length - 1];
        const msgTime = formatChatLocalTime(latestFromOther.created_at);
        unreadByUser[u.id] = {
          count: unreadMsgs.length,
          senderName: u.full_name,
          text: latestFromOther.message_text || "Sent an attachment",
          timeStr: msgTime
        };

        if (latestFromOther.id > lastToastMsgId) {
          if (!newestIncoming || latestFromOther.id > newestIncoming.id) {
            newestIncoming = {
              id: latestFromOther.id,
              partnerId: u.id,
              senderName: u.full_name,
              text: latestFromOther.message_text || "Sent an attachment",
              timeStr: msgTime
            };
          }
        }
      } else {
        delete unreadByUser[u.id];
      }
    }));

    if (newestIncoming) {
      lastToastMsgId = newestIncoming.id;
      if (watcherBootstrapped) {
        showIncomingMessageToast(
          newestIncoming.partnerId,
          newestIncoming.senderName,
          newestIncoming.text,
          newestIncoming.timeStr
        );
      }
    }
    watcherBootstrapped = true;

    updateGlobalUnreadBadges();
    if (chatsVisible) {
      const box = document.getElementById("chatMsgs");
      const prevScrollTop = box ? box.scrollTop : 0;
      const wasAtBottom = box ? (box.scrollHeight - box.scrollTop - box.clientHeight < 60) : true;

      drawChats(wasAtBottom);

      const newBox = document.getElementById("chatMsgs");
      if (newBox && !wasAtBottom) {
        newBox.scrollTop = prevScrollTop;
      }
    }
  } catch (e) {
    // Silent background poll retry
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    pollAllChatsAndNotifications();
    clearInterval(globalChatPollTimer);
    globalChatPollTimer = setInterval(pollAllChatsAndNotifications, 4000);
  }, 1200);
});

/*  File Upload Helper  */
async function uploadFileToBackend(fileOrBlob, filename) {
  const formData = new FormData();
  formData.append("file", fileOrBlob, filename);
  const headers = { Authorization: `Bearer ${getAuthToken()}` };

  let res = await fetch(`${API_BASE_URL}/media/upload`, { method: "POST", headers, body: formData });
  if (res.status === 404) {
    res = await fetch(`${API_BASE_URL}/media/upload-voice`, { method: "POST", headers, body: formData });
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "File upload failed");
  return data.media_url;
}

/*  Section Entry Point  */
async function renderChatsSection() {
  inviteNoticeText = "";
  const [notices, tree, invites] = await Promise.all([
    fetchOr(API.notices, []),
    fetchOr(API.orgTree, []),
    fetchOr("/communications/chat/invites/pending", [])
  ]);

  pendingChatInvites = Array.isArray(invites) ? invites : [];

  const noticeList = Array.isArray(notices) ? notices : [];
  const channels = [
    {
      id: "channel-all",
      kind: "channel",
      name: "workspace-updates",
      sub: "Announcements & team notices",
      messages: noticeList.map(n => ({
        id: n.id,
        from: n.author?.full_name || "Workspace Admin",
        role: n.author?.designation || "Broadcast",
        title: n.title,
        text: n.content,
        scope: n.scope || "TEAM",
        at: n.created_at,
        mine: n.author_id === currentUser?.id
      }))
    }
  ];

  const myId = currentUser?.id;
  const people = flattenOrgTree(Array.isArray(tree) ? tree : [])
    .filter(u => u.id !== myId)
    .map(u => ({
      id: "dm-" + u.id,
      userId: u.id,
      kind: "dm",
      name: u.full_name,
      sub: u.designation || u.role_tier,
      messages: []
    }));

  const prevActive = chatActive;
  chatThreads = [...channels, ...people];
  chatActive = chatThreads.some(t => t.id === prevActive)
    ? prevActive
    : (chatThreads[0]?.id || null);

  if (chatActive && chatActive.startsWith("dm-")) {
    await loadDmHistory(chatActive);
  }

  drawChats(true);
  pollAllChatsAndNotifications();
}

async function loadDmHistory(threadId) {
  const thread = chatThreads.find(t => t.id === threadId);
  if (!thread || thread.kind !== "dm") return;

  const history = await fetchOr(`/communications/chat/messages/${thread.userId}`, []);
  if (Array.isArray(history)) {
    thread.messages = history.map(m => ({
      id: m.id,
      from: m.sender?.full_name || (m.sender_id === currentUser?.id ? "You" : thread.name),
      text: m.message_text || "",
      attachmentUrl: m.attachment_url || null,
      at: m.created_at,
      mine: m.sender_id === currentUser?.id
    }));

    if (history.length) {
      const last = history[history.length - 1];
      markPartnerRead(thread.userId, last.id);
    }
  }
}

async function openChat(id) {
  chatActive = id;
  inviteNoticeText = "";
  showNoticeComposer = false;
  clearPendingAttachment();
  if (id.startsWith("dm-")) {
    await loadDmHistory(id);
  }
  drawChats(true);
}

function toggleNoticeComposer() {
  showNoticeComposer = !showNoticeComposer;
  drawChats(false);
}

async function postNoticeSubmit(event) {
  event.preventDefault();
  const title = document.getElementById("noticeTitleInput")?.value.trim();
  const scope = document.getElementById("noticeScopeInput")?.value || "TEAM";
  const content = document.getElementById("noticeBodyInput")?.value.trim();
  if (!title || !content) return;

  try {
    await apiRequest(API.notices, "POST", { title, content, scope });
    showNoticeComposer = false;
    await renderChatsSection();
  } catch (err) {
    alert("Could not publish announcement: " + chatErrMsg(err));
  }
}

async function respondChatInvite(requestId, decision) {
  try {
    await apiRequest(`/communications/chat/invites/${requestId}/respond`, "PATCH", {
      status: decision
    });
    await renderChatsSection();
  } catch (err) {
    alert("Could not update chat request: " + chatErrMsg(err));
  }
}

function triggerChatFilePicker() {
  document.getElementById("chatFileInput")?.click();
}

function handleChatFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const isImage = file.type.startsWith("image/");
  pendingAttachment = {
    file,
    name: file.name,
    sizeLabel: formatBytes(file.size),
    isImage,
    previewUrl: isImage ? URL.createObjectURL(file) : null
  };
  drawChats(false);
}

function clearPendingAttachment() {
  if (pendingAttachment?.previewUrl) {
    URL.revokeObjectURL(pendingAttachment.previewUrl);
  }
  pendingAttachment = null;
}

async function sendChat(event) {
  event.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input?.value.trim() || "";
  if (!text && !pendingAttachment) return;

  const thread = chatThreads.find(t => t.id === chatActive);
  if (!thread || thread.kind !== "dm") return;

  const sendBtn = document.getElementById("chatSendBtn");
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "Sending..."; }

  let uploadedUrl = null;
  try {
    if (pendingAttachment) {
      uploadedUrl = await uploadFileToBackend(pendingAttachment.file, pendingAttachment.name);
    }

    const finalText = text || (pendingAttachment ? pendingAttachment.name : "");
    await apiRequest("/communications/chat/messages", "POST", {
      receiver_id: thread.userId,
      message_text: finalText,
      attachment_url: uploadedUrl
    });

    if (input) input.value = "";
    clearPendingAttachment();
    inviteNoticeText = "";
    await loadDmHistory(thread.id);
    drawChats(true);
  } catch (err) {
    const msg = chatErrMsg(err).toLowerCase();
    if (msg.includes("accepted") || msg.includes("403") || msg.includes("forbidden")) {
      try {
        await apiRequest("/communications/chat/invite", "POST", {
          receiver_id: thread.userId,
          initial_message: text || `Shared file: ${pendingAttachment?.name || "Attachment"}`,
          initial_attachment_url: uploadedUrl
        });
        if (input) input.value = "";
        clearPendingAttachment();
        inviteNoticeText = `Chat invitation sent to ${thread.name}. Messaging unlocks once they click Accept.`;
        drawChats(true);
      } catch (inviteErr) {
        inviteNoticeText = chatErrMsg(inviteErr);
        drawChats(true);
      }
    } else {
      alert("Message failed: " + chatErrMsg(err));
    }
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "Send"; }
  }
}

/*  Voice Note Recorder  */
async function startVoiceRecording() {
  const thread = chatThreads.find(t => t.id === chatActive);
  if (!thread || thread.kind !== "dm") return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    dmAudioChunks = [];
    dmRecordSeconds = 0;
    dmRecorder = new MediaRecorder(stream);

    dmRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) dmAudioChunks.push(e.data);
    };

    dmRecorder.start();
    drawChats(false);

    clearInterval(dmRecordTimer);
    dmRecordTimer = setInterval(() => {
      dmRecordSeconds += 1;
      const timerEl = document.getElementById("voiceTimerText");
      if (timerEl) {
        const mins = Math.floor(dmRecordSeconds / 60);
        const secs = String(dmRecordSeconds % 60).padStart(2, "0");
        timerEl.textContent = `${mins}:${secs}`;
      }
    }, 1000);
  } catch (err) {
    alert("Microphone access denied or unavailable.");
  }
}

function stopAndSendVoiceRecording() {
  if (!dmRecorder || dmRecorder.state !== "recording") return;
  clearInterval(dmRecordTimer);

  const thread = chatThreads.find(t => t.id === chatActive);
  dmRecorder.onstop = async () => {
    dmRecorder.stream?.getTracks().forEach(t => t.stop());
    const blob = new Blob(dmAudioChunks, { type: "audio/webm" });
    dmRecorder = null;
    drawChats(false);

    try {
      const mediaUrl = await uploadFileToBackend(blob, `voice_note_${Date.now()}.webm`);
      await apiRequest("/communications/chat/messages", "POST", {
        receiver_id: thread.userId,
        message_text: `Voice note (${dmRecordSeconds}s)`,
        attachment_url: mediaUrl
      });
      await loadDmHistory(thread.id);
      drawChats(true);
    } catch (err) {
      alert("Voice note upload failed: " + chatErrMsg(err));
    }
  };
  dmRecorder.stop();
}

function cancelVoiceRecording() {
  if (!dmRecorder) return;
  clearInterval(dmRecordTimer);
  dmRecorder.onstop = () => {
    dmRecorder.stream?.getTracks().forEach(t => t.stop());
    dmRecorder = null;
    drawChats(false);
  };
  if (dmRecorder.state === "recording") {
    dmRecorder.stop();
  } else {
    dmRecorder = null;
    drawChats(false);
  }
}

/*  Attachment Renderer With Direct Download Button  */
function renderAttachmentBlock(rawUrl, fallbackName, isMine) {
  if (!rawUrl) return "";
  const fullUrl = resolveMediaUrl(rawUrl);
  const cleanPath = rawUrl.split("?")[0].toLowerCase();
  const safeFileName = (fallbackName && !fallbackName.startsWith("Voice note"))
    ? fallbackName
    : (rawUrl.split("/").pop() || "download");

  const dlBtnStyle = isMine
    ? "background:rgba(255,255,255,0.22);color:#FFFFFF;border:1px solid rgba(255,255,255,0.35);"
    : "background:#F1F5F9;color:#0F172A;border:1px solid #CBD5E1;";

  const downloadBar = (label) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;">
      <span style="font-size:11px;opacity:0.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:155px;">
        ${esc(label)}
      </span>
      <button type="button"
        onclick="downloadChatFile('${esc(rawUrl)}', '${esc(safeFileName)}')"
        style="padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;${dlBtnStyle}">
        ↓ Download
      </button>
    </div>`;

  if (/\.(png|jpe?g|gif|webp|svg)$/.test(cleanPath)) {
    return `
      <div class="mt-2">
        <a href="${esc(fullUrl)}" target="_blank" rel="noopener" class="block">
          <img src="${esc(fullUrl)}" alt="${esc(safeFileName)}"
            style="max-width:240px;max-height:185px;border-radius:12px;object-fit:cover;border:1px solid rgba(0,0,0,0.1);">
        </a>
        ${downloadBar(safeFileName)}
      </div>`;
  }

  if (/\.(webm|mp3|wav|ogg|m4a)$/.test(cleanPath)) {
    return `
      <div class="mt-2">
        <audio controls src="${esc(fullUrl)}" style="height:36px;max-width:245px;"></audio>
        ${downloadBar("Audio clip")}
      </div>`;
  }

  if (/\.(mp4|mov|avi)$/.test(cleanPath)) {
    return `
      <div class="mt-2">
        <video controls src="${esc(fullUrl)}"
          style="max-width:245px;max-height:180px;border-radius:12px;"></video>
        ${downloadBar(safeFileName)}
      </div>`;
  }

  return `
    <div class="mt-2 p-2.5 rounded-xl" style="background:rgba(15,23,42,0.08);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;">
          <span class="chip" style="font-size:10px;padding:1px 6px;">FILE</span>
          <b style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;">
            ${esc(safeFileName)}
          </b>
        </div>
        <button type="button"
          onclick="downloadChatFile('${esc(rawUrl)}', '${esc(safeFileName)}')"
          style="padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;${dlBtnStyle}">
          ↓ Download
        </button>
      </div>
    </div>`;
}

/*  Main View Renderer  */
function drawChats(scrollToBottom = true) {
  // Prevent DOM re-render disruption if user is actively typing in the chat input
  const activeInput = document.getElementById("chatInput");
  if (activeInput && document.activeElement === activeInput && activeInput.value.trim().length > 0) {
    return;
  }

  const active = chatThreads.find(t => t.id === chatActive);
  if (!active) return;

  const canBroadcast = ["ADMIN", "MANAGER"].includes(currentUser?.role_tier);
  const isRecording = dmRecorder && dmRecorder.state === "recording";

  const invitesBanner = pendingChatInvites.length
    ? `<div class="mb-3 p-3.5 rounded-2xl border border-[var(--line)] bg-white/95 shadow-sm">
        <div class="text-xs font-bold uppercase tracking-wider mb-2" style="color:var(--accent);">
          Incoming Chat Requests (${pendingChatInvites.length})
        </div>
        ${pendingChatInvites.map(inv => `
          <div class="flex items-center justify-between flex-wrap gap-2 py-2 border-t border-gray-100 first:border-t-0">
            <div class="text-xs">
              <b>${esc(inv.sender?.full_name || `Member #${inv.sender_id}`)}</b> wants to chat with you
              <span class="text-gray-400"> • ${formatChatLocalTime(inv.created_at)}</span>
              ${inv.initial_message ? `<span class="block text-gray-500 mt-0.5">"${esc(inv.initial_message)}"</span>` : ""}
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" class="btn btn-primary" style="padding:5px 12px;font-size:12px;"
                onclick="respondChatInvite(${inv.id}, 'ACCEPTED')">Accept</button>
              <button type="button" class="btn btn-ghost" style="padding:5px 10px;font-size:12px;"
                onclick="respondChatInvite(${inv.id}, 'DECLINED')">Decline</button>
              <button type="button" class="btn btn-ghost" style="padding:5px 10px;font-size:12px;opacity:0.75;"
                onclick="respondChatInvite(${inv.id}, 'IGNORED')">Ignore</button>
            </div>
          </div>
        `).join("")}
      </div>`
    : "";

  const row = t => {
    const unreadInfo = t.kind === "dm" ? unreadByUser[t.userId] : null;
    const latestMeta = t.kind === "dm" ? latestMetaByUser[t.userId] : null;
    const isSelected = t.id === chatActive;

    const subLine = unreadInfo
      ? `<small style="color:${isSelected ? "#FFFFFF" : "#DC2626"};font-weight:700;">Messaged you • ${esc(unreadInfo.timeStr)}</small>`
      : (latestMeta
          ? `<small>${latestMeta.mine ? "You: " : ""}${esc(latestMeta.text)} • ${esc(latestMeta.timeStr)}</small>`
          : (t.sub ? `<small>${esc(t.sub)}</small>` : ""));

    const unreadPill = unreadInfo
      ? `<span style="margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#EF4444;color:#FFFFFF;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${unreadInfo.count}</span>`
      : "";

    return `
      <button class="chat-row ${isSelected ? "on" : ""}" onclick="openChat('${t.id}')" style="align-items:center;">
        ${t.kind === "channel" ? `<span class="hash">#</span>` : `<span class="avatar sm">${initials(t.name)}</span>`}
        <span style="min-width:0;flex:1;">
          <b>${esc(t.name)}</b>
          ${subLine}
        </span>
        ${unreadPill}
      </button>`;
  };

  let mainPaneHtml = "";
  if (active.kind === "channel") {
    const noticeComposerCard = (canBroadcast && showNoticeComposer)
      ? `<form onsubmit="postNoticeSubmit(event)" class="p-4 mb-3 rounded-2xl bg-white border border-[var(--line)] shadow-sm">
           <div class="flex items-center justify-between mb-2.5">
             <b class="text-xs uppercase tracking-wider" style="color:var(--accent);">Publish Workspace Update</b>
             <button type="button" onclick="toggleNoticeComposer()" class="text-xs text-gray-400 hover:text-gray-700">Close</button>
           </div>
           <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
             <input id="noticeTitleInput" placeholder="Headline (e.g. Sprint Release)" class="sm:col-span-2 px-3 py-2 text-xs rounded-xl border border-gray-200" required>
             <select id="noticeScopeInput" class="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white">
               <option value="TEAM">Team Scope</option>
               ${currentUser?.role_tier === "ADMIN" ? `<option value="ALL">Entire Organization</option>` : ""}
             </select>
           </div>
           <textarea id="noticeBodyInput" rows="2" placeholder="Write announcement details for your team..."
             class="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 mb-2.5" required></textarea>
           <div class="flex justify-end gap-2">
             <button type="button" onclick="toggleNoticeComposer()" class="btn btn-ghost" style="padding:6px 12px;font-size:12px;">Cancel</button>
             <button type="submit" class="btn btn-primary" style="padding:6px 16px;font-size:12px;">Publish Update</button>
           </div>
         </form>`
      : "";

    const noticeCards = active.messages.length
      ? active.messages.map(n => `
          <article class="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm mb-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2.5">
                <span class="avatar sm">${initials(n.from)}</span>
                <div>
                  <b class="text-xs text-gray-900 block">${esc(n.from)}</b>
                  <span class="text-[11px] text-gray-400">${esc(n.role || "Broadcast")} • ${formatChatLocalTime(n.at)}</span>
                </div>
              </div>
              <span class="chip">${esc(n.scope || "TEAM")}</span>
            </div>
            ${n.title ? `<h3 class="text-sm font-bold text-gray-900 mb-1">${esc(n.title)}</h3>` : ""}
            <p class="text-xs text-gray-600 leading-relaxed whitespace-pre-line">${esc(n.text)}</p>
          </article>`).join("")
      : emptyState("No workspace updates posted yet.");

    mainPaneHtml = `
      <div class="chat-title flex items-center justify-between">
        <div>
          <b># workspace-updates</b>
          <span class="block text-[11px] muted">Official notices &amp; announcements</span>
        </div>
        ${canBroadcast
          ? `<button type="button" onclick="toggleNoticeComposer()" class="btn btn-primary" style="padding:6px 14px;font-size:12px;">
               ${showNoticeComposer ? "Hide Form" : "+ Post Update"}
             </button>`
          : `<span class="chip">Read-only feed</span>`}
      </div>
      <div class="chat-msgs" id="chatMsgs" style="background:rgba(248,250,252,0.55);">
        ${noticeComposerCard}
        ${noticeCards}
      </div>`;
  } else {
    const bubbles = active.messages.length
      ? active.messages.map(m => `
          <div class="bubble ${m.mine ? "me" : ""}">
            ${m.mine ? "" : `<small>${esc(m.from)}</small>`}
            ${m.text ? `<div>${esc(m.text)}</div>` : ""}
            ${renderAttachmentBlock(m.attachmentUrl, m.text, m.mine)}
            <small>${formatChatLocalTime(m.at)}</small>
          </div>`).join("")
      : emptyState(`Send a message, file, or voice note to ${active.name}.`);

    const attachmentPreviewBar = pendingAttachment
      ? `<div class="flex items-center justify-between gap-2 px-3.5 py-2 bg-gray-50 border-t border-gray-200 text-xs">
           <div class="flex items-center gap-2.5 min-w-0">
             ${pendingAttachment.isImage
               ? `<img src="${pendingAttachment.previewUrl}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;">`
               : `<span class="chip" style="font-size:10px;">FILE</span>`}
             <div class="truncate">
               <b class="block truncate text-gray-900">${esc(pendingAttachment.name)}</b>
               <span class="text-[11px] text-gray-400">${pendingAttachment.sizeLabel}</span>
             </div>
           </div>
           <button type="button" onclick="clearPendingAttachment(); drawChats(false);" class="text-xs text-red-600 font-semibold px-2">Remove</button>
         </div>`
      : "";

    const statusPill = inviteNoticeText
      ? `<div class="px-3.5 py-2 text-xs font-medium bg-amber-50 text-amber-700 border-t border-amber-100">${esc(inviteNoticeText)}</div>`
      : "";

    const bottomBarHtml = isRecording
      ? `<div class="chat-compose flex items-center justify-between gap-2" style="background:#FFF1F2;">
           <div class="flex items-center gap-2 text-xs font-semibold text-red-600">
             <span>Recording Voice Note...</span>
             <span id="voiceTimerText">0:${String(dmRecordSeconds).padStart(2, "0")}</span>
           </div>
           <div class="flex items-center gap-2">
             <button type="button" onclick="cancelVoiceRecording()" class="btn btn-ghost" style="padding:6px 12px;font-size:12px;">Cancel</button>
             <button type="button" onclick="stopAndSendVoiceRecording()" class="btn btn-primary" style="padding:6px 14px;font-size:12px;">Send Voice</button>
           </div>
         </div>`
      : `<form class="chat-compose" onsubmit="sendChat(event)">
           <input type="file" id="chatFileInput" class="hidden"
             accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
             onchange="handleChatFileSelected(event)">
           <button type="button" onclick="triggerChatFilePicker()" class="btn btn-ghost"
             style="padding:7px 11px;font-size:12px;font-weight:600;" title="Attach Image, PDF, or File">+ Attach</button>
           <button type="button" onclick="startVoiceRecording()" class="btn btn-ghost"
             style="padding:7px 11px;font-size:12px;font-weight:600;" title="Record Voice Note">Voice</button>
           <input id="chatInput" placeholder="Message ${esc(active.name)} or attach media..." autocomplete="off">
           <button type="submit" id="chatSendBtn" class="btn btn-primary">Send</button>
         </form>`;

    mainPaneHtml = `
      <div class="chat-title flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="avatar sm">${initials(active.name)}</span>
          <div>
            <b>${esc(active.name)}</b>
            <span class="block text-[11px] muted">${esc(active.sub || "Workspace Member")}</span>
          </div>
        </div>
        <span class="text-[11px] muted">Files • Media • Voice</span>
      </div>
      <div class="chat-msgs" id="chatMsgs">${bubbles}</div>
      ${statusPill}
      ${attachmentPreviewBar}
      ${bottomBarHtml}`;
  }

  setSection(`
    ${pageHead("Chats", "Structured workspace announcements, media sharing, and voice messages.")}
    ${invitesBanner}
    <div class="card glass chat">
      <aside class="chat-list">
        <p class="nav-group">Notice Board</p>${chatThreads.filter(t => t.kind === "channel").map(row).join("")}
        <p class="nav-group">Direct Messages</p>${chatThreads.filter(t => t.kind === "dm").map(row).join("") || emptyState("No teammates yet.")}
      </aside>
      <div class="chat-main">
        ${mainPaneHtml}
      </div>
    </div>
  `);

  const box = document.getElementById("chatMsgs");
  if (box && active.kind === "dm" && scrollToBottom) {
    box.scrollTop = box.scrollHeight;
  }
}

registerSection("chats", renderChatsSection);