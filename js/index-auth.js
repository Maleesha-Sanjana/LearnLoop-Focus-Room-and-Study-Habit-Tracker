import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  auth,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeNotifications
} from './firebase.js';

const loginBtn = document.getElementById('nav-login-btn');
const joinBtn = document.getElementById('nav-join-btn');
const profileBtn = document.getElementById('nav-profile-btn');
const navAvatar = document.getElementById('nav-avatar');
const navUsername = document.getElementById('nav-username');

async function initAuthUI() {
  await auth.authStateReady();
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginBtn.style.display = 'none';
      joinBtn.style.display = 'none';
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

      const ctaPrimary = document.getElementById('cta-primary-btn');
      const ctaSecondary = document.getElementById('cta-secondary-btn');
      if (ctaPrimary) {
        ctaPrimary.textContent = 'Go to Dashboard';
        ctaPrimary.href = 'profile.html';
      }
      if (ctaSecondary) {
        ctaSecondary.style.display = 'none';
      }

      document.getElementById('notif-wrapper').style.display = 'block';
      initNotifications(user);
    } else {
      loginBtn.style.display = '';
      joinBtn.style.display = '';
      profileBtn.style.display = 'none';
      document.getElementById('notif-wrapper').style.display = 'none';
    }
  });
}

function initNotifications(user) {
  let notifications = [];
  let notifUnsub = null;

  function refreshNotifications() {
    if (notifUnsub) notifUnsub();
    notifUnsub = subscribeNotifications(user.uid, items => {
      notifications = items;
      renderNotifications();
    });
  }

  function renderNotifications() {
    const list = document.getElementById('notif-list');
    list.innerHTML = '';

    if (!notifications.length) {
      list.innerHTML = '<div class="notif-empty">You\'re all caught up! 🎉</div>';
      updateBadge();
      return;
    }

    notifications.forEach(n => {
      const isUnread = !n.read;
      const item = document.createElement('div');
      item.className = `notif-item${isUnread ? ' unread' : ''}`;
      item.innerHTML = `
        <div class="notif-icon ${n.color || 'blue'}">${n.icon || '🔔'}</div>
        <div class="notif-body">
          <div class="notif-title">${n.title}</div>
          <div class="notif-time">${n.time || ''}</div>
        </div>
        <div class="notif-dot"></div>
      `;
      item.addEventListener('click', async () => {
        if (!n.read) {
          try {
            await markNotificationRead(user.uid, n.id);
            n.read = true;
          } catch (err) {
            console.warn('Could not mark notification read.', err);
          }
        }
        updateBadge();
        renderNotifications();
      });
      list.appendChild(item);
    });

    updateBadge();
  }

  function updateBadge() {
    const badge = document.getElementById('notif-badge');
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) badge.classList.add('has-unread');
    else badge.classList.remove('has-unread');
  }

  const btn = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) refreshNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('open');
    }
  });

  document.getElementById('notif-mark-all').addEventListener('click', async () => {
    try {
      await markAllNotificationsRead(user.uid);
      notifications = notifications.map(n => ({ ...n, read: true }));
    } catch (err) {
      console.warn('Could not mark all read.', err);
    }
    updateBadge();
    renderNotifications();
  });

  refreshNotifications();
}

initAuthUI();
