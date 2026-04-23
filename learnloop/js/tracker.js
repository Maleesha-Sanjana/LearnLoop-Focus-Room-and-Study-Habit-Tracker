// =============================================
// tracker.js – Study Timer & Session Management
// =============================================

let currentUser = null;
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerPaused = false;
let sessionStartTime = null;

// Set today's date as default for manual entry
document.getElementById("manual-date").value = new Date().toISOString().split("T")[0];

(async () => {
  currentUser = await requireAuth();
  await loadSubjects();
  await loadSessions();
})();

// ── Timer Controls ──
function startTimer() {
  if (timerRunning) return;
  const subject = document.getElementById("timer-subject").value;
  if (!subject) { showToast("Please select a subject first.", "warning"); return; }

  timerRunning = true;
  timerPaused = false;
  sessionStartTime = new Date();

  document.getElementById("btn-start").classList.add("hidden");
  document.getElementById("btn-stop").classList.remove("hidden");
  document.getElementById("btn-pause").classList.remove("hidden");

  timerInterval = setInterval(() => {
    timerSeconds++;
    document.getElementById("timer-display").textContent = formatTime(timerSeconds);
  }, 1000);

  showToast("Study session started! 📚", "success");
}

function pauseTimer() {
  if (!timerRunning) return;
  if (!timerPaused) {
    clearInterval(timerInterval);
    timerPaused = true;
    document.getElementById("btn-pause").textContent = "▶ Resume";
    showToast("Timer paused.", "info");
  } else {
    timerInterval = setInterval(() => {
      timerSeconds++;
      document.getElementById("timer-display").textContent = formatTime(timerSeconds);
    }, 1000);
    timerPaused = false;
    document.getElementById("btn-pause").textContent = "⏸ Pause";
    showToast("Timer resumed.", "info");
  }
}

async function stopTimer() {
  if (!timerRunning) return;
  clearInterval(timerInterval);
  timerRunning = false;

  const durationMins = Math.round(timerSeconds / 60);
  if (durationMins < 1) {
    showToast("Session too short (< 1 min). Not saved.", "warning");
    resetTimer();
    return;
  }

  const subject = document.getElementById("timer-subject").value;
  const notes = document.getElementById("timer-notes").value.trim();

  await saveSession({
    subject,
    startTime: sessionStartTime.toISOString(),
    endTime: new Date().toISOString(),
    duration: durationMins,
    notes,
    type: "timer"
  });

  resetTimer();
  await loadSessions();
  await updateStreak();
}

function resetTimer() {
  timerSeconds = 0;
  timerRunning = false;
  timerPaused = false;
  document.getElementById("timer-display").textContent = "00:00";
  document.getElementById("btn-start").classList.remove("hidden");
  document.getElementById("btn-stop").classList.add("hidden");
  document.getElementById("btn-pause").classList.add("hidden");
  document.getElementById("btn-pause").textContent = "⏸ Pause";
  document.getElementById("timer-notes").value = "";
}

// ── Save Session ──
async function saveSession(data) {
  try {
    await db.collection("sessions").add({
      userId: currentUser.uid,
      ...data
    });
    showToast(`Session saved! ${formatDuration(data.duration)} of ${data.subject} 🎉`, "success");
  } catch (e) {
    showToast("Failed to save session.", "error");
    console.error(e);
  }
}

// ── Manual Entry ──
async function saveManualSession(e) {
  e.preventDefault();
  const subject = document.getElementById("manual-subject").value;
  const dateVal = document.getElementById("manual-date").value;
  const duration = parseInt(document.getElementById("manual-duration").value);
  const notes = document.getElementById("manual-notes").value.trim();

  if (!subject) { showToast("Select a subject.", "warning"); return; }

  const startTime = new Date(dateVal).toISOString();
  await saveSession({ subject, startTime, duration, notes, type: "manual" });
  e.target.reset();
  document.getElementById("manual-date").value = new Date().toISOString().split("T")[0];
  await loadSessions();
}

// ── Subjects ──
async function loadSubjects() {
  const snap = await db.collection("subjects")
    .where("userId","==",currentUser.uid)
    .orderBy("name")
    .get();

  const subjects = [];
  snap.forEach(d => subjects.push({ id: d.id, ...d.data() }));

  // If no subjects, add defaults
  if (subjects.length === 0) {
    const defaults = ["Mathematics","Science","English","History","Programming"];
    for (const name of defaults) {
      const ref = await db.collection("subjects").add({ userId: currentUser.uid, name });
      subjects.push({ id: ref.id, name });
    }
  }

  populateSubjectSelects(subjects);
  renderSubjectChips(subjects);
}

function populateSubjectSelects(subjects) {
  const selects = ["timer-subject","manual-subject","filter-subject"];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = id === "filter-subject";
    el.innerHTML = isFilter ? '<option value="">All Subjects</option>' : '<option value="">Select subject…</option>';
    subjects.forEach(s => {
      el.innerHTML += `<option value="${s.name}">${s.name}</option>`;
    });
  });
}

function renderSubjectChips(subjects) {
  const el = document.getElementById("subjects-list");
  if (!el) return;
  el.innerHTML = subjects.map((s, i) => `
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);
      border-radius:99px;padding:6px 14px;font-size:.85rem;">
      <span style="width:10px;height:10px;border-radius:50%;background:${getSubjectColor(i)};display:inline-block;"></span>
      ${s.name}
      <button onclick="deleteSubject('${s.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;line-height:1;margin-left:4px;">×</button>
    </div>`).join("");
}

function openAddSubject() {
  document.getElementById("subject-modal").classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

async function addSubject() {
  const name = document.getElementById("new-subject-name").value.trim();
  if (!name) { showToast("Enter a subject name.", "warning"); return; }

  await db.collection("subjects").add({ userId: currentUser.uid, name });
  showToast(`"${name}" added!`, "success");
  closeModal("subject-modal");
  document.getElementById("new-subject-name").value = "";
  await loadSubjects();
}

async function deleteSubject(id) {
  if (!confirm("Delete this subject?")) return;
  await db.collection("subjects").doc(id).delete();
  showToast("Subject removed.", "info");
  await loadSubjects();
}

// ── Session History ──
async function loadSessions() {
  const filterSubject = document.getElementById("filter-subject")?.value || "";
  let query = db.collection("sessions")
    .where("userId","==",currentUser.uid)
    .orderBy("startTime","desc")
    .limit(30);

  const snap = await query.get();
  const el = document.getElementById("sessions-list");

  const sessions = [];
  snap.forEach(d => {
    const s = d.data();
    if (!filterSubject || s.subject === filterSubject) {
      sessions.push({ id: d.id, ...s });
    }
  });

  if (sessions.length === 0) {
    el.innerHTML = `<p class="text-muted text-center" style="padding:20px 0;">No sessions found.</p>`;
    return;
  }

  el.innerHTML = sessions.map(s => `
    <div class="list-item">
      <div class="list-item-icon">📚</div>
      <div class="list-item-body">
        <div class="list-item-title">${s.subject || "General"}</div>
        <div class="list-item-sub">${formatDate(s.startTime)} ${s.notes ? "· " + s.notes.substring(0,60) : ""}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="badge badge-primary">${formatDuration(s.duration || 0)}</span>
        <button onclick="deleteSession('${s.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;">🗑</button>
      </div>
    </div>`).join("");
}

async function deleteSession(id) {
  if (!confirm("Delete this session?")) return;
  await db.collection("sessions").doc(id).delete();
  showToast("Session deleted.", "info");
  await loadSessions();
}

// ── Update Streak ──
async function updateStreak() {
  const userRef = db.collection("users").doc(currentUser.uid);
  const userDoc = await userRef.get();
  const data = userDoc.data() || {};

  const today = new Date().toDateString();
  const lastDate = data.lastStudyDate;

  if (lastDate === today) return; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const newStreak = lastDate === yesterday.toDateString() ? (data.streak || 0) + 1 : 1;

  await userRef.update({
    streak: newStreak,
    lastStudyDate: today
  });
}
