// =============================================
// goals.js – Goal Management
// =============================================

let currentUser = null;
let allGoals = [];
let currentFilter = "all";

(async () => {
  currentUser = await requireAuth();
  await loadGoals();
})();

async function loadGoals() {
  const snap = await db.collection("goals")
    .where("userId","==",currentUser.uid)
    .orderBy("createdAt","desc")
    .get();

  allGoals = [];
  snap.forEach(d => allGoals.push({ id: d.id, ...d.data() }));

  // Sync progress from sessions
  await syncGoalProgress();
  renderGoals();
}

async function syncGoalProgress() {
  for (const goal of allGoals) {
    if (goal.status === "completed") continue;

    let query = db.collection("sessions").where("userId","==",currentUser.uid);

    if (goal.type === "daily") {
      const today = new Date(); today.setHours(0,0,0,0);
      query = query.where("startTime",">=", today.toISOString());
    } else if (goal.type === "weekly") {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0,0,0,0);
      query = query.where("startTime",">=", weekAgo.toISOString());
    }

    if (goal.subject) query = query.where("subject","==",goal.subject);

    const snap = await query.get();
    let totalMins = 0;
    snap.forEach(d => totalMins += (d.data().duration || 0));
    goal.currentHours = Math.round((totalMins / 60) * 10) / 10;

    // Auto-complete if reached
    if (goal.currentHours >= goal.targetHours && goal.status === "active") {
      await db.collection("goals").doc(goal.id).update({ status: "completed", currentHours: goal.currentHours });
      goal.status = "completed";
    } else {
      await db.collection("goals").doc(goal.id).update({ currentHours: goal.currentHours });
    }
  }
}

function renderGoals() {
  const grid = document.getElementById("goals-grid");
  const filtered = currentFilter === "all" ? allGoals : allGoals.filter(g => g.status === currentFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="text-muted" style="padding:20px 0;">No ${currentFilter === "all" ? "" : currentFilter} goals yet. Create one!</p>`;
    return;
  }

  grid.innerHTML = filtered.map(g => {
    const pct = Math.min(100, Math.round(((g.currentHours || 0) / (g.targetHours || 1)) * 100));
    const isOverdue = g.deadline && new Date(g.deadline) < new Date() && g.status === "active";
    const typeColors = { daily: "badge-primary", weekly: "badge-warning", longterm: "badge-success" };
    const typeLabels = { daily: "Daily", weekly: "Weekly", longterm: "Long-term" };

    return `
    <div class="card" style="border-color:${g.status === "completed" ? "var(--success)" : isOverdue ? "var(--danger)" : "var(--border)"}">
      <div class="flex-between mb-2">
        <span class="badge ${typeColors[g.type] || "badge-primary"}">${typeLabels[g.type] || g.type}</span>
        <div class="flex gap-2">
          ${g.status === "completed" ? '<span class="badge badge-success">✓ Done</span>' : ""}
          ${isOverdue ? '<span class="badge badge-danger">Overdue</span>' : ""}
        </div>
      </div>
      <div style="font-size:1.05rem;font-weight:700;margin-bottom:6px;">${g.title}</div>
      ${g.subject ? `<div class="text-muted" style="font-size:.82rem;margin-bottom:8px;">📚 ${g.subject}</div>` : ""}
      <div class="flex-between" style="font-size:.85rem;margin-bottom:4px;">
        <span>${g.currentHours || 0}h / ${g.targetHours}h</span>
        <span>${pct}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      ${g.deadline ? `<div class="text-muted mt-1" style="font-size:.78rem;">📅 Deadline: ${g.deadline}</div>` : ""}
      <div class="flex gap-2 mt-2">
        ${g.status === "active" ? `
          <button class="btn btn-sm btn-secondary" onclick="editGoal('${g.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-success" onclick="markComplete('${g.id}')">✓ Complete</button>
        ` : ""}
        <button class="btn btn-sm btn-danger" onclick="deleteGoal('${g.id}')">🗑</button>
      </div>
    </div>`;
  }).join("");
}

function filterGoals(filter) {
  currentFilter = filter;
  ["all","active","completed"].forEach(f => {
    document.getElementById(`filter-${f}`).className = `btn btn-sm ${f === filter ? "btn-primary" : "btn-secondary"}`;
  });
  renderGoals();
}

function openGoalModal(goalData = null) {
  document.getElementById("goal-modal").classList.add("open");
  document.getElementById("modal-title").textContent = goalData ? "Edit Goal" : "New Goal";
  document.getElementById("goal-id").value = goalData?.id || "";
  document.getElementById("goal-title").value = goalData?.title || "";
  document.getElementById("goal-type").value = goalData?.type || "daily";
  document.getElementById("goal-hours").value = goalData?.targetHours || "";
  document.getElementById("goal-deadline").value = goalData?.deadline || "";
  document.getElementById("goal-subject").value = goalData?.subject || "";
}

function closeGoalModal() {
  document.getElementById("goal-modal").classList.remove("open");
}

async function saveGoal(e) {
  e.preventDefault();
  const id = document.getElementById("goal-id").value;
  const data = {
    userId: currentUser.uid,
    title: document.getElementById("goal-title").value.trim(),
    type: document.getElementById("goal-type").value,
    targetHours: parseFloat(document.getElementById("goal-hours").value),
    deadline: document.getElementById("goal-deadline").value,
    subject: document.getElementById("goal-subject").value.trim(),
    status: "active",
    currentHours: 0
  };

  if (id) {
    await db.collection("goals").doc(id).update(data);
    showToast("Goal updated!", "success");
  } else {
    data.createdAt = new Date().toISOString();
    await db.collection("goals").add(data);
    showToast("Goal created! 🎯", "success");
  }

  closeGoalModal();
  await loadGoals();
}

function editGoal(id) {
  const goal = allGoals.find(g => g.id === id);
  if (goal) openGoalModal(goal);
}

async function markComplete(id) {
  await db.collection("goals").doc(id).update({ status: "completed" });
  showToast("Goal completed! 🎉", "success");
  await loadGoals();
}

async function deleteGoal(id) {
  if (!confirm("Delete this goal?")) return;
  await db.collection("goals").doc(id).delete();
  showToast("Goal deleted.", "info");
  await loadGoals();
}
