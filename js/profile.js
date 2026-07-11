import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

  const firebaseConfig = {
    apiKey: "AIzaSyC0SlrLGv9luVqaogkW4lpYL3mwIxxvSdA",
    authDomain: "learnloop-f89c2.firebaseapp.com",
    projectId: "learnloop-f89c2",
    storageBucket: "learnloop-f89c2.firebasestorage.app",
    messagingSenderId: "777914976314",
    appId: "1:777914976314:web:2cd051169684c24caf8d03",
    measurementId: "G-3SBVP21TE7"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // --- Auth state: populate profile with real user data ---
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Not logged in — redirect to login
      window.location.href = 'login.html';
      return;
    }

    // Navbar
    const navAvatar   = document.getElementById('nav-avatar');
    const navUsername = document.getElementById('nav-username');
    const photoURL = user.photoURL
      || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email)}&backgroundColor=111111&textColor=ffffff`;
    navAvatar.src = photoURL;
    const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Profile';
    navUsername.textContent = firstName;

    // Profile card — avatar
    const previewImg = document.getElementById('profile-img-preview');
    previewImg.src = photoURL;

    // Profile card — name fields
    if (user.displayName && !user.displayName.startsWith('+')) {
      const parts = user.displayName.split(' ');
      document.getElementById('first-name').value = parts[0] || '';
      document.getElementById('last-name').value = parts.slice(1).join(' ') || '';
    } else {
      document.getElementById('first-name').value = '';
      document.getElementById('last-name').value = '';
    }

    // Profile card — email
    document.getElementById('email').value = user.email || '';
  });

  // --- Logout ---
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });

  // --- Dark Mode Toggle (user choice only, defaults to light) ---
  const themeToggle = document.getElementById('theme-toggle');
  const isDark = localStorage.getItem('ll_theme') === 'dark';
  document.body.classList.toggle('dark', isDark);
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('ll_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });

  // --- Avatar Upload Preview ---
  const fileInput  = document.getElementById('avatar-upload');
  const previewImg = document.getElementById('profile-img-preview');
  const removeBtn  = document.getElementById('remove-avatar-btn');

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) previewImg.src = URL.createObjectURL(file);
  });

  removeBtn.addEventListener('click', () => {
    previewImg.src = `https://api.dicebear.com/7.x/initials/svg?seed=U&backgroundColor=111111&textColor=ffffff`;
    fileInput.value = '';
  });

  // --- Toast helper ---
  const toastBox     = document.getElementById('toastBox');
  const toastMessage = document.getElementById('toastMessage');
  let toastTimeout;

  function showToast(message, isError = false) {
    toastMessage.textContent = message;
    const icon = document.querySelector('.toast-icon');
    icon.innerHTML    = isError ? '&#33;' : '&#10003;';
    icon.style.background = isError ? '#e53e3e' : '#10b981';
    toastBox.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastBox.classList.remove('show'), 3000);
  }

  // --- Profile form ---
  document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast("Profile details updated successfully.");
  });

  // --- Password form ---
  document.getElementById('password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newPass  = document.getElementById('new-password').value;
    const confPass = document.getElementById('confirm-password').value;
    if (newPass !== confPass) {
      showToast("New passwords do not match.", true);
      return;
    }
    showToast("Password changed successfully.");
    document.getElementById('password-form').reset();
  });
