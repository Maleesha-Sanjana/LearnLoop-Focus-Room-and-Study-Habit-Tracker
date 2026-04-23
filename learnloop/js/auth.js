// =============================================
// Auth – Login / Register / Logout
// =============================================

// Redirect if already logged in
auth.onAuthStateChanged((user) => {
  if (user && window.location.pathname.includes("login.html")) {
    window.location.href = "index.html";
  }
});

function switchTab(tab) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabLogin = document.getElementById("tab-login");
  const tabReg = document.getElementById("tab-register");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLogin.classList.add("active");
    tabReg.classList.remove("active");
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabLogin.classList.remove("active");
    tabReg.classList.add("active");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = e.target.querySelector("button[type=submit]");

  btn.disabled = true;
  btn.textContent = "Logging in…";

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast("Welcome back! 🎉", "success");
    setTimeout(() => window.location.href = "index.html", 800);
  } catch (err) {
    showToast(friendlyError(err.code), "error");
    btn.disabled = false;
    btn.textContent = "Login";
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const goal = document.getElementById("reg-goal").value;
  const btn = e.target.querySelector("button[type=submit]");

  btn.disabled = true;
  btn.textContent = "Creating account…";

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    await db.collection("users").doc(cred.user.uid).set({
      name,
      email,
      goal,
      createdAt: new Date().toISOString(),
      totalStudyHours: 0,
      streak: 0,
      lastStudyDate: null
    });

    showToast("Account created! Welcome to LearnLoop 🎓", "success");
    setTimeout(() => window.location.href = "index.html", 900);
  } catch (err) {
    showToast(friendlyError(err.code), "error");
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

function friendlyError(code) {
  const map = {
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "Email already registered.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Invalid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ── Toast Utility ──
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
