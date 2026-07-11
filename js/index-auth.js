import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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

  const loginBtn   = document.getElementById('nav-login-btn');
  const joinBtn    = document.getElementById('nav-join-btn');
  const profileBtn = document.getElementById('nav-profile-btn');
  const navAvatar  = document.getElementById('nav-avatar');
  const navUsername = document.getElementById('nav-username');

  let notificationsReady = false;

  function updateNavForUser(user) {
    if (user) {
      loginBtn.style.display  = 'none';
      joinBtn.style.display   = 'none';
      profileBtn.style.display = 'flex';

      const photoURL = user.photoURL
        || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email)}&backgroundColor=111111&textColor=ffffff`;
      navAvatar.src = photoURL;

      const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Profile';
      navUsername.textContent = firstName;

      const heroCta = document.getElementById('hero-cta-btn');
      if (heroCta) {
        heroCta.textContent = 'Go to Focus Room';
        heroCta.href = 'focusroom.html';
      }

      const ctaPrimary   = document.getElementById('cta-primary-btn');
      const ctaSecondary = document.getElementById('cta-secondary-btn');
      if (ctaPrimary) {
        ctaPrimary.textContent = 'Go to Dashboard';
        ctaPrimary.href = '#';
      }
      if (ctaSecondary) {
        ctaSecondary.style.display = 'none';
      }

      document.getElementById('notif-wrapper').style.display = 'block';
      if (!notificationsReady) {
        notificationsReady = true;
        initNotifications(user);
      }
    } else {
      notificationsReady = false;
      loginBtn.style.display  = '';
      joinBtn.style.display   = '';
      profileBtn.style.display = 'none';
      document.getElementById('notif-wrapper').style.display = 'none';
    }
  }

  async function initIndexAuth() {
    await auth.authStateReady();
    onAuthStateChanged(auth, updateNavForUser);
  }

  initIndexAuth();

  // ── Notifications ──
  function initNotifications(user) {
    const firstName = user.displayName ? user.displayName.split(' ')[0] : 'there';

    const notifications = [
      { id: 1, icon: '🔥', color: 'yellow', title: `You're on a 3-day streak, ${firstName}! Keep it up.`, time: '2 min ago', unread: true },
      { id: 2, icon: '🏆', color: 'purple', title: 'You scored 90% on your last quiz. Great work!', time: '1 hour ago', unread: true },
      { id: 3, icon: '👥', color: 'blue',   title: 'A teammate invited you to a Focus Room session.', time: '3 hours ago', unread: true },
      { id: 4, icon: '🎯', color: 'green',  title: 'Daily goal completed! You studied for 2 hours today.', time: 'Yesterday', unread: false },
      { id: 5, icon: '📚', color: 'blue',   title: 'New study material added to your dashboard.', time: '2 days ago', unread: false },
    ];

    let unreadIds = new Set(notifications.filter(n => n.unread).map(n => n.id));

    function renderNotifications() {
      const list = document.getElementById('notif-list');
      list.innerHTML = '';

      if (notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">You\'re all caught up! 🎉</div>';
        return;
      }

      notifications.forEach(n => {
        const isUnread = unreadIds.has(n.id);
        const item = document.createElement('div');
        item.className = `notif-item${isUnread ? ' unread' : ''}`;
        item.innerHTML = `
          <div class="notif-icon ${n.color}">${n.icon}</div>
          <div class="notif-body">
            <div class="notif-title">${n.title}</div>
            <div class="notif-time">${n.time}</div>
          </div>
          <div class="notif-dot"></div>
        `;
        item.addEventListener('click', () => {
          unreadIds.delete(n.id);
          updateBadge();
          renderNotifications();
        });
        list.appendChild(item);
      });

      updateBadge();
    }

    function updateBadge() {
      const badge = document.getElementById('notif-badge');
      if (unreadIds.size > 0) {
        badge.classList.add('has-unread');
      } else {
        badge.classList.remove('has-unread');
      }
    }

    // Toggle dropdown
    const btn      = document.getElementById('notif-btn');
    const dropdown = document.getElementById('notif-dropdown');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.classList.remove('open');
      }
    });

    // Mark all as read
    document.getElementById('notif-mark-all').addEventListener('click', () => {
      unreadIds.clear();
      updateBadge();
      renderNotifications();
    });

    renderNotifications();
  }
