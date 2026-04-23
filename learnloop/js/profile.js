// =============================================
// profile.js – User Profile Management
// =============================================

let currentUser = null;

(async () => {
  currentUser = await requireAuth();
  await loadProfile();
  await loadStats();
})();

async function loadProfile() {
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  const data = userDoc.data() || {};

  const name = currentUser.displayName || data.name || "Learner";
  const initial = name[0].toUpperCase();

  document.getElementById("profile-avatar").textContent = initial;
  document.getElementById("profile-name").textContent = name;
  document.getElementById("profile-email").textContent = currentUser.email;

  const goalLabels = { school: "School Student", university: "University Student", self: "Self-Learner", exam: "Exam Candidate" };
  document.getElementById("profile-goal-badge").textContent = goalLabels[data.goal] || "Learner";

  document.getElementById("edit-name").value = name;
  document.getElementById("edit-goal").value = data.goal || "school";
  document.getElementById("edit-target").value = data.dailyTarget || 3;
}

async function loadStats() {
  // Total sessions
  const sessionsSnap = await db.collection("sessions")
    .where("userId","==",currentUser.uid)
    .get();

  let totalMins = 0;
  sessionsSnap.forEach(d => totalMins += (d.data().duration || 0));
  document.getElementById("p-total").textContent = formatDuration(totalMins);
  document.getElementById("p-sessions").textContent = sessionsSnap.size;

  // Streak
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  document.getElementById("p-streak").textContent = userDoc.data()?.streak || 0;

  // Completed goals
  const goalsSnap = await db.collection("goals")
    .where("userId","==",currentUser.uid)
    .where("status","==","completed")
    .get();
  document.getElementById("p-goals").textContent = goalsSnap.size;
}

async function updateProfile(e) {
  e.preventDefault();
  const name = document.getElementById("edit-name").value.trim();
  const goal = document.getElementById("edit-goal").value;
  const dailyTarget = parseFloat(document.getElementById("edit-target").value) || 3;

  try {
    await currentUser.updateProfile({ displayName: name });
    await db.collection("users").doc(currentUser.uid).update({ name, goal, dailyTarget });

    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-avatar").textContent = name[0].toUpperCase();

    const goalLabels = { school: "School Student", university: "University Student", self: "Self-Learner", exam: "Exam Candidate" };
    document.getElementById("profile-goal-badge").textContent = goalLabels[goal] || "Learner";

    showToast("Profile updated! ✅", "success");
  } catch (err) {
    showToast("Failed to update profile.", "error");
    console.error(err);
  }
}

async function changePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;

  if (newPass !== confirm) { showToast("Passwords don't match.", "warning"); return; }

  try {
    await currentUser.updatePassword(newPass);
    showToast("Password updated! 🔒", "success");
    e.target.reset();
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      showToast("Please log out and log back in before changing your password.", "warning");
    } else {
      showToast("Failed to update password.", "error");
    }
  }
}

async function clearAllData() {
  if (!confirm("This will permanently delete ALL your study sessions and goals. Are you sure?")) return;

  const batch = db.batch();

  const sessions = await db.collection("sessions").where("userId","==",currentUser.uid).get();
  sessions.forEach(d => batch.delete(d.ref));

  const goals = await db.collection("goals").where("userId","==",currentUser.uid).get();
  goals.forEach(d => batch.delete(d.ref));

  const subjects = await db.collection("subjects").where("userId","==",currentUser.uid).get();
  subjects.forEach(d => batch.delete(d.ref));

  await batch.commit();
  await db.collection("users").doc(currentUser.uid).update({ streak: 0, lastStudyDate: null });

  showToast("All data cleared.", "info");
  await loadStats();
}

async function deleteAccount() {
  if (!confirm("This will permanently delete your account and all data. This cannot be undone!")) return;
  if (!confirm("Are you absolutely sure?")) return;

  try {
    await clearAllData();
    await db.collection("users").doc(currentUser.uid).delete();
    await currentUser.delete();
    window.location.href = "login.html";
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      showToast("Please log out and log back in before deleting your account.", "warning");
    } else {
      showToast("Failed to delete account.", "error");
      console.error(err);
    }
  }
}
