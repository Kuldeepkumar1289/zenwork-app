/* voice_ui.js — Real Microphone Voice Lounges & Live Speaking Meter */

const VOICE_ROOMS = [
  { id: "lounge",  name: "Design & Dev Lounge", topic: "Open drop-in hangout for quick collaboration" },
  { id: "standup", name: "Daily Stand-up",      topic: "10-minute team sync room" },
  { id: "focus",   name: "Quiet Focus Room",    topic: "Co-working room (joins muted automatically)" }
];

let voice = {
  roomId: null,
  muted: true,
  seconds: 0,
  timer: null,
  stream: null,
  audioCtx: null,
  speaking: false,
  workspacePeople: []
};

async function renderVoiceSection() {
  const tree = await fetchOr(API.orgTree, []);
  voice.workspacePeople = flattenOrgTree(Array.isArray(tree) ? tree : []);
  drawVoice();
}

async function joinRoom(id) {
  leaveRoom(false);

  let micStream = null;
  let audioCtx = null;
  try {
    // Request real microphone access from the browser
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Start muted by default for polite drop-in
    micStream.getAudioTracks().forEach(track => { track.enabled = false; });

    // Live speaking volume detector via Web Audio API
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(micStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArr = new Uint8Array(analyser.frequencyBinCount);

    const monitorVolume = () => {
      if (!voice.roomId) return;
      analyser.getByteFrequencyData(dataArr);
      const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
      const isNowSpeaking = !voice.muted && avg > 18;
      if (isNowSpeaking !== voice.speaking) {
        voice.speaking = isNowSpeaking;
        const indicator = document.getElementById("voiceSpeakStatus");
        if (indicator) {
          indicator.textContent = isNowSpeaking ? "🟢 Speaking..." : (voice.muted ? "🔇 Muted" : "🎙️ Mic Live");
        }
      }
      requestAnimationFrame(monitorVolume);
    };
    requestAnimationFrame(monitorVolume);
  } catch (err) {
    alert("Microphone permission denied or unavailable — joining in listen-only mode.");
  }

  voice.roomId = id;
  voice.muted = true;
  voice.seconds = 0;
  voice.stream = micStream;
  voice.audioCtx = audioCtx;
  voice.timer = setInterval(tickVoice, 1000);
  drawVoice();
}

function leaveRoom(redraw = true) {
  clearInterval(voice.timer);
  if (voice.stream) {
    voice.stream.getTracks().forEach(t => t.stop());
  }
  if (voice.audioCtx) {
    voice.audioCtx.close().catch(() => {});
  }
  voice.roomId = null;
  voice.muted = true;
  voice.seconds = 0;
  voice.timer = null;
  voice.stream = null;
  voice.audioCtx = null;
  voice.speaking = false;
  if (redraw) drawVoice();
}

function toggleMute() {
  voice.muted = !voice.muted;
  if (voice.stream) {
    voice.stream.getAudioTracks().forEach(track => {
      track.enabled = !voice.muted;
    });
  }
  drawVoice();
}

function tickVoice() {
  voice.seconds++;
  const el = document.getElementById("voiceClock");
  if (el) el.textContent = formatClock(voice.seconds);
  else leaveRoom(false);
}

function formatClock(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function drawVoice() {
  const me = currentUser?.full_name || "You";
  const onlineCount = voice.workspacePeople.length;

  const rooms = VOICE_ROOMS.map(r => {
    const joined = voice.roomId === r.id;
    const people = joined ? [me] : [];

    return `
      <article class="card glass room ${joined ? "is-live" : ""}">
        <div class="card-head">
          <h2>${esc(r.name)}</h2>
          ${joined ? '<span class="chip push">Connected</span>' : '<span class="chip push">Open</span>'}
        </div>
        <p class="muted">${esc(r.topic)}</p>
        <div class="faces">
          ${people.length
            ? people.map(p => `<span class="avatar sm" title="${esc(p)}">${initials(p)}</span><small class="font-medium">${esc(p)} (You)</small>`).join("")
            : '<small class="muted">Room is empty — click Join to connect mic</small>'}
        </div>
        <button class="btn ${joined ? "btn-ghost" : "btn-primary"}" onclick="${joined ? "leaveRoom()" : `joinRoom('${r.id}')`}">
          ${joined ? "Leave room" : "Join room"}
        </button>
      </article>`;
  }).join("");

  const activeRoom = VOICE_ROOMS.find(r => r.id === voice.roomId);
  const bar = activeRoom ? `
    <div class="card glass voice-bar">
      <b>🎙️ ${esc(activeRoom.name)}</b>
      <span id="voiceSpeakStatus" class="chip">${voice.muted ? "🔇 Muted" : "🎙️ Mic Live"}</span>
      <span id="voiceClock" class="muted">${formatClock(voice.seconds)}</span>
      <button class="btn ${voice.muted ? "btn-ghost" : "btn-primary"} push" onclick="toggleMute()">
        ${voice.muted ? "Unmute Mic" : "Mute Mic"}
      </button>
      <button class="btn btn-ghost" onclick="leaveRoom()">Leave</button>
    </div>` : "";

  setSection(`
    ${pageHead("Voice chats", "Drop into a live audio lounge with real microphone controls.",
      `<span class="chip">${onlineCount} workspace member${onlineCount === 1 ? "" : "s"}</span>`)}
    ${bar}
    <div class="grid-cards">${rooms}</div>
  `);
}

registerSection("voice", renderVoiceSection);