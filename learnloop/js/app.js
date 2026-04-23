// =============================================
// app.js – Shared utilities used across pages
// =============================================

// ── Toast ──
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Format seconds → MM:SS ──
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Format minutes → "2h 30m" ──
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Format date string or ISO ──
function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Logout ──
function logout() {
  auth.signOut().then(() => window.location.href = "login.html");
}

// ── Sidebar hamburger ──
function initSidebar() {
  const hamburger = document.querySelector(".hamburger");
  const sidebar = document.querySelector(".sidebar");
  if (hamburger && sidebar) {
    hamburger.addEventListener("click", () => sidebar.classList.toggle("open"));
    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    });
  }
}

// ── Highlight active nav link ──
function highlightNav() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".sidebar nav a").forEach(a => {
    const href = a.getAttribute("href");
    if (href === page) a.classList.add("active");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  highlightNav();
});

// ── Subject color map ──
const SUBJECT_COLORS = [
  "#6c63ff","#ff6584","#43e97b","#ffd166","#06d6a0",
  "#118ab2","#ef476f","#ffc43d","#1b998b","#e9c46a"
];

function getSubjectColor(index) {
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}
