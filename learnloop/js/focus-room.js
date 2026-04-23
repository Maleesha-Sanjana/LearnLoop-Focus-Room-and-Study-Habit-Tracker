// =============================================
// focus-room.js – Real-time Focus Rooms (Firebase RTDB)
// =============================================

let currentUser = null;
let currentRoomId = null;
let roomRef = null;
let timerRef = null;
let localTimerInterval = null;
let roomsListener = null;

(async () => {
  currentUser = await requireAuth();
  listenRooms();
})();

// ── Room Browser ──
function listenRooms() {
  const roomsRef = rtdb.ref("rooms");
  roomsListener = roomsRef.on("value", (snap) => {
    const grid = document.getElementById("rooms-grid");
    const rooms = [];
    snap.forEach(child => rooms.push({ id: child.key, ...child.val() }));

    const active = rooms.filter(r => r.status !== "closed");

    if (active.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--text-muted);">
          <div style="font-size:3rem;margin-bottom:12px;">🏠</div>
          <p>No active rooms. Create one and invite friends!</p>
        </div>`;
      return;
    }

    grid.innerHTML = active.map(r => {
      const participants = r.participants ? Object.values(r.participants) : [];
      const avatars = participants.slice(0,4).map(p =>
        `<div class="avatar" title="${p.name}">${(p.name||"?")[0].toUpperCase()}</div>`
      ).join("");

      return `
        <div class="room-card" onclick="joinRoom('${r.id}')">
          <div class="room-card-header">
            <div>
              <div class="room-name">${r.name}</div>
              <div class="room-participants">📚 ${r.subject || "General"}</div>
            </div>
            <span class="badge ${r.timerStatus === 'running' ? 'badge-success' : 'badge-primary'}">
              ${r.timerStatus === 'running' ? '🔴 Live' : '⏸ Idle'}
            </span>
          </div>
          <div class="participant-avatars">${avatars}</div>
          <div class="text-muted mt-1" style="font-size:.8rem;">
            ${participants.length} / ${r.maxParticipants || 10} participants
          </div>
          <button class="btn btn-primary btn-sm w-full mt-2">Join Room →</button>
        </div>`;
    }).join("");
  });
}

// ── Create Room ──
function openCreateRoom() {
  document.getElementById("create-room-modal").classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

async function createRoom() {
  const name = document.getElementById("new-room-name").value.trim();
  const subject = document.getElementById("new-room-subject").value.trim();
  const maxParticipants = parseInt(document.getElementById("new-room-max").value);

  if (!name) { showToast("Enter a room name.", "warning"); return; }

  const roomId = "room_" + Date.now();
  await rtdb.ref(`rooms/${roomId}`).set({
    name,
    subject: subject || "General",
    createdBy: currentUser.uid,
    createdByName: currentUser.displayName || "Anonymous",
    maxParticipants,
    status: "active",
    timerSeconds: 25 * 60,
    timerStatus: "stopped",
    timerMode: "focus",
    participants: {}
  });

  closeModal("create-room-modal");
  showToast(`Room "${name}" created!`, "success");
  joinRoom(roomId);
}

// ── Join Room ──
async function joinRoom(roomId) {
  currentRoomId = roomId;
  roomRef = rtdb.ref(`rooms/${roomId}`);

  const snap = await roomRef.once("value");
  const room = snap.val();
  if (!room) { showToast("Room not found.", "error"); return; }

  const participants = room.participants ? Object.keys(room.participants).length : 0;
  if (participants >= (room.maxParticipants || 10)) {
    showToast("Room is full.", "warning"); return;
  }

  // Add self to participants
  await roomRef.child(`participants/${currentUser.uid}`).set({
    name: currentUser.displayName || currentUser.email.split("@")[0],
    status: "studying",
    joinedAt: Date.now()
  });

  // Remove on disconnect
  roomRef.child(`participants/${currentUser.uid}`).onDisconnect().remove();

  // Show room view
  document.getElementById("room-browser").classList.add("hidden");
  document.getElementById("active-room-view").classList.remove("hidden");
  document.getElementById("room-title").textContent = room.name;
  document.getElementById("room-subtitle").textContent = `📚 ${room.subject || "General"}`;

  // Listen to room changes
  listenRoom();
  listenChat();
}

function listenRoom() {
  roomRef.on("value", (snap) => {
    const room = snap.val();
    if (!room) return;

    // Participants
    const participants = room.participants ? Object.values(room.participants) : [];
    document.getElementById("participant-count").textContent = participants.length;
    document.getElementById("participants-list").innerHTML = participants.map(p => `
      <div class="participant-chip">
        <div class="dot ${p.status === 'break' ? 'break' : ''}"></div>
        ${p.name}
        <span style="font-size:.75rem;color:var(--text-muted);">${p.status === 'break' ? '☕' : '📚'}</span>
      </div>`).join("");

    // Timer sync
    const label = { focus: "🍅 Pomodoro – Focus", short: "☕ Short Break", long: "🛋 Long Break" };
    document.getElementById("room-mode-label").textContent = label[room.timerMode] || "🍅 Focus";
    document.getElementById("room-timer").textContent = formatTime(room.timerSeconds || 0);

    if (room.timerStatus === "running") {
      startLocalSync(room);
    } else {
      clearInterval(localTimerInterval);
    }
  });
}

let lastSyncTime = null;
let lastSyncSeconds = null;

function startLocalSync(room) {
  clearInterval(localTimerInterval);
  lastSyncTime = Date.now();
  lastSyncSeconds = room.timerSeconds;

  localTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lastSyncTime) / 1000);
    const remaining = Math.max(0, lastSyncSeconds - elapsed);
    document.getElementById("room-timer").textContent = formatTime(remaining);

    if (remaining === 0) {
      clearInterval(localTimerInterval);
      showToast("⏰ Time's up! Take a break.", "success");
      // Only room creator resets
      roomRef.once("value").then(snap => {
        if (snap.val()?.createdBy === currentUser.uid) {
          roomRef.update({ timerStatus: "stopped", timerSeconds: 0 });
        }
      });
    }
  }, 1000);
}

// ── Timer Controls (synced via RTDB) ──
async function roomTimerControl(action) {
  const snap = await roomRef.once("value");
  const room = snap.val();

  if (action === "start") {
    const secs = room.timerSeconds > 0 ? room.timerSeconds : 25 * 60;
    await roomRef.update({ timerStatus: "running", timerSeconds: secs, timerStartedAt: Date.now() });
    showToast("Timer started for everyone! 🍅", "success");
  } else if (action === "pause") {
    await roomRef.update({ timerStatus: "paused" });
    clearInterval(localTimerInterval);
  } else if (action === "reset") {
    const modeSecs = { focus: 25*60, short: 5*60, long: 15*60 };
    const secs = modeSecs[room.timerMode] || 25*60;
    await roomRef.update({ timerStatus: "stopped", timerSeconds: secs });
    clearInterval(localTimerInterval);
  }
}

async function setMode(mode, minutes) {
  await roomRef.update({ timerMode: mode, timerSeconds: minutes * 60, timerStatus: "stopped" });
  clearInterval(localTimerInterval);
  showToast(`Switched to ${mode} mode.`, "info");
}

async function setStatus(status) {
  await roomRef.child(`participants/${currentUser.uid}/status`).set(status);
  showToast(status === "studying" ? "Status: Studying 📚" : "Status: On Break ☕", "info");
}

// ── Chat ──
function listenChat() {
  const chatRef = rtdb.ref(`rooms/${currentRoomId}/chat`);
  chatRef.limitToLast(50).on("child_added", (snap) => {
    const msg = snap.val();
    const el = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "chat-msg";
    const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    div.innerHTML = `<span class="sender">${msg.sender}</span>${msg.text}<span class="time">${time}</span>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  });
}

async function sendChat() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  await rtdb.ref(`rooms/${currentRoomId}/chat`).push({
    sender: currentUser.displayName || currentUser.email.split("@")[0],
    text,
    timestamp: Date.now()
  });

  input.value = "";
}

// ── Leave Room ──
async function leaveRoom() {
  clearInterval(localTimerInterval);
  if (roomRef) {
    await roomRef.child(`participants/${currentUser.uid}`).remove();
    roomRef.off();
  }
  currentRoomId = null;
  roomRef = null;

  document.getElementById("active-room-view").classList.add("hidden");
  document.getElementById("room-browser").classList.remove("hidden");
  document.getElementById("chat-messages").innerHTML = "";
  showToast("Left the room.", "info");
}
