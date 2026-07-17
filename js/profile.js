// Profile page

import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  auth,
  BADGE_DEFINITIONS,
  defaultProfile,
  getLearnerSettings,
  saveLearnerSettings,
  loadAppConfig,
  createGoal,
  updateGoal,
  completeGoal,
  unlockAchievement,
  logStudySession,
  subscribeGoals,
  subscribeActivities,
  subscribeResources,
  subscribeAchievements,
  subscribeLearnerSettings,
  uploadResourceFile,
  addResource,
  removeResource,
  logActivity
} from './firebase.js';

// State

let selectedSubjects = [];
let currentUid = null;
const firestoreUnsubs = [];

let subjectsPool = [];
let presetAvatars = [];
let badgeDefinitions = BADGE_DEFINITIONS;

let goalsState = [];
let recentActivities = [];
let sharedResources = [];
let unlockedBadges = new Set();

window.userProfile = defaultProfile(null);

// Theme & mobile nav

function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const isDark = localStorage.getItem('ll_theme') === 'dark';
  document.body.classList.toggle('dark', isDark);
  if (themeToggle) themeToggle.textContent = isDark ? 'Light' : 'Dark';

  themeToggle?.addEventListener('click', function () {
    const next = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', next);
    localStorage.setItem('ll_theme', next ? 'dark' : 'light');
    themeToggle.textContent = next ? 'Light' : 'Dark';
  });
}

function initMobileNav() {
  const menuBtn = document.getElementById('nav-menu-btn');
  const navLinks = document.getElementById('nav-links');
  if (!menuBtn || !navLinks) return;

  menuBtn.addEventListener('click', function () {
    const open = navLinks.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function getInitial(name) {
  if (!name) return 'U';
  return String(name).charAt(0).toUpperCase();
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val != null ? val : '';
}

function setAvatarLetter(el, name) {
  if (!el) return;
  el.textContent = getInitial(name);
}

// Auth

async function loadProfileForUser(user) {
  currentUid = user.uid;

  try {
    const existing = await getLearnerSettings(user.uid);
    if (existing) {
      window.userProfile = { ...defaultProfile(user), ...existing };
    } else {
      window.userProfile = defaultProfile(user);
      await saveLearnerSettings(user.uid, window.userProfile);
    }
  } catch (err) {
    console.warn('Firestore access error, using local profile state.', err);
    window.userProfile = defaultProfile(user);
  }

  if (user.displayName && !user.displayName.startsWith('+')) {
    window.userProfile.name = user.displayName;
  }

  selectedSubjects = window.userProfile.subjects?.length
    ? [...window.userProfile.subjects]
    : [];

  setupFirestoreListeners(user.uid);
}

function setupFirestoreListeners(uid) {
  firestoreUnsubs.forEach(function (unsub) { unsub(); });
  firestoreUnsubs.length = 0;

  firestoreUnsubs.push(subscribeLearnerSettings(uid, function (data) {
    window.userProfile = { ...window.userProfile, ...data };
    selectedSubjects = window.userProfile.subjects?.length
      ? [...window.userProfile.subjects]
      : selectedSubjects;
    renderProfileUI();
    renderSubjectsList();
  }));

  firestoreUnsubs.push(subscribeGoals(uid, function (goals) {
    goalsState = goals;
    renderGoalTrackers();
  }));

  firestoreUnsubs.push(subscribeActivities(uid, function (activities) {
    recentActivities = activities.map(function (a) {
      return {
        text: a.text || '',
        time: a.time || 'Just now'
      };
    });
    renderActivityTimeline();
  }));

  firestoreUnsubs.push(subscribeResources(uid, function (resources) {
    sharedResources = resources;
    renderSharedResources();
    evaluateAchievementsUnlocks();
  }));

  firestoreUnsubs.push(subscribeAchievements(uid, function (badges) {
    unlockedBadges = badges instanceof Set ? badges : new Set(badges || []);
    renderAchievementsBadges();
  }));
}

async function initAuth() {
  await auth.authStateReady();
  onAuthStateChanged(auth, async function (user) {
    if (!user) {
      window.location.replace('login.html');
      return;
    }

    const appConfig = await loadAppConfig();
    subjectsPool = appConfig.subjects || [];
    presetAvatars = appConfig.avatars || [];
    badgeDefinitions = appConfig.badges || BADGE_DEFINITIONS;

    await loadProfileForUser(user);
    renderProfileUI();
    renderSubjectsList();
    renderAvatarSelections();
    renderAchievementsBadges();
    renderGoalTrackers();
    renderActivityTimeline();
    renderSharedResources();
  });
}

document.getElementById('nav-logout-btn')?.addEventListener('click', async function () {
  try {
    await signOut(auth);
  } catch (_) {}
  showToast('Logged out from LearnLoop. Redirecting...');
  setTimeout(function () {
    window.location.href = 'index.html';
  }, 1200);
});

// UI

function renderProfileUI() {
  if (!window.userProfile) return;
  const p = window.userProfile;

  document.getElementById('profile-name').textContent = p.name || 'Learner';
  document.getElementById('profile-headline').textContent = p.headline || 'Student';
  document.getElementById('display-uni').textContent = p.institution || 'Add your university in settings';
  setAvatarLetter(document.getElementById('profile-avatar'), p.avatar || p.name || 'U');

  document.getElementById('badge-level').textContent = p.level || 'Beginner';
  document.getElementById('badge-streak').textContent = p.streak || 0;
  document.getElementById('badge-focus').textContent = (p.focusScore || 0) + '%';

  document.getElementById('stat-hours').textContent = (p.hours || 0) + ' hrs';
  document.getElementById('stat-today').textContent = p.todayProgress || '0h 0m';
  document.getElementById('stat-streak').textContent = (p.streak || 0) + ' days';
  document.getElementById('stat-goals').textContent = (p.goalsCompleted || 0) + ' Goals';

  document.getElementById('stat-questions').textContent = p.questions || 0;
  document.getElementById('stat-sessions').textContent = p.sessions || 0;
  document.getElementById('stat-quizzes').textContent = p.quizzes || 0;
  document.getElementById('stat-reputation').textContent = p.reputation || 0;

  setVal('info-name', p.name);
  setVal('info-uni', p.institution);
  setVal('info-faculty', p.faculty);
  setVal('info-year', p.year);
  setVal('info-country', p.country);
  setVal('info-bio', p.bio);
  setVal('info-linkedin', p.linkedin);
  setVal('info-github', p.github);
}

function renderGoalTrackers() {
  const list = document.getElementById('goals-list');
  if (!list) return;

  if (!goalsState.length) {
    list.innerHTML = '<p class="text-muted" style="text-align:center;padding:16px 0;">No goals yet. Add your first learning goal!</p>';
    return;
  }

  list.innerHTML = goalsState.map(function (goal) {
    return `
      <div class="goal-item">
        <div class="goal-top">
          <span class="goal-name">${escapeHtml(goal.name)}</span>
          <span class="goal-progress-text" id="goal-val-${goal.id}">${goal.progress || 0}%</span>
        </div>
        <div class="goal-bar-track">
          <div id="goal-bar-${goal.id}" class="goal-bar-fill" style="width:${goal.progress || 0}%"></div>
        </div>
        <div class="goal-controls">
          <input type="range" min="0" max="100" value="${goal.progress || 0}" oninput="adjustGoal('${goal.id}', this.value)" ${goal.status === 'completed' ? 'disabled' : ''}/>
          <button type="button" onclick="accomplishGoal('${goal.id}')" class="link-btn" ${goal.status === 'completed' ? 'disabled' : ''}>Mark Done</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderActivityTimeline() {
  const container = document.getElementById('activity-stream');
  if (!container) return;

  if (!recentActivities.length) {
    container.innerHTML = '<p class="text-muted">No activity yet. Start studying to build your timeline!</p>';
    return;
  }

  container.innerHTML = recentActivities.map(function (act) {
    return `
      <div class="activity-item">
        <p class="activity-text">${escapeHtml(act.text)}</p>
        <span class="activity-time">${escapeHtml(act.time)}</span>
      </div>
    `;
  }).join('');
}

function renderSubjectsList() {
  const container = document.getElementById('subjects-container');
  if (!container) return;
  container.innerHTML = '';

  subjectsPool.forEach(function (subject) {
    const isSelected = selectedSubjects.includes(subject);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'subject-tag' + (isSelected ? ' is-selected' : '');
    btn.textContent = (isSelected ? '✓ ' : '+ ') + subject;
    btn.onclick = function () { toggleSubjectSelected(subject); };
    container.appendChild(btn);
  });
}

function renderAchievementsBadges() {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  grid.innerHTML = '';

  badgeDefinitions.forEach(function (badge) {
    const isUnlocked = unlockedBadges.has(badge.id);
    grid.insertAdjacentHTML('beforeend', `
      <div class="badge-item ${isUnlocked ? '' : 'locked'}">
        <span class="badge-icon">${badge.icon || '🏅'}</span>
        <div>
          <p class="badge-title">${escapeHtml(badge.title)}</p>
          <span class="badge-status ${isUnlocked ? 'unlocked' : ''}">${isUnlocked ? 'Unlocked' : 'In Progress'}</span>
        </div>
      </div>
    `);
  });
}

function renderSharedResources() {
  const list = document.getElementById('notes-list');
  if (!list) return;

  if (!sharedResources.length) {
    list.innerHTML = '<p class="text-muted text-small" style="text-align:center;padding:16px 0;">No shared resources yet. Upload your first notes!</p>';
    return;
  }

  list.innerHTML = sharedResources.map(function (res) {
    return `
      <div class="goal-item">
        <div class="goal-top">
          <div>
            <p class="goal-name">${escapeHtml(res.name)}</p>
            <span class="text-muted text-small">${escapeHtml(res.size || '')} · ${escapeHtml(res.scope || 'Private')}</span>
          </div>
          <div style="display:flex;gap:8px;">
            ${res.url ? `<a class="link-btn" href="${escapeHtml(res.url)}" target="_blank" rel="noopener">Download</a>` : ''}
            <button type="button" class="link-btn" onclick="deleteResource('${res.id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAvatarSelections() {
  const grid = document.getElementById('avatars-selection-grid');
  if (!grid) return;
  grid.innerHTML = '';

  presetAvatars.forEach(function (avatar) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-option';
    btn.innerHTML = `<div class="avatar-circle small">${getInitial(avatar)}</div><span>${escapeHtml(avatar)}</span>`;
    btn.onclick = function () { updateAvatarSelection(avatar); };
    grid.appendChild(btn);
  });
}

async function evaluateAchievementsUnlocks() {
  if (!currentUid) return;

  for (let i = 0; i < badgeDefinitions.length; i++) {
    const badge = badgeDefinitions[i];
    if (unlockedBadges.has(badge.id)) continue;

    let valueToTest = 0;
    if (badge.metric === 'streak') valueToTest = window.userProfile.streak || 0;
    if (badge.metric === 'goalsCompleted') valueToTest = window.userProfile.goalsCompleted || 0;
    if (badge.metric === 'hours') valueToTest = window.userProfile.hours || 0;
    if (badge.metric === 'reputation') valueToTest = window.userProfile.reputation || 0;
    if (badge.metric === 'resourcesCount') valueToTest = sharedResources.length;
    if (badge.metric === 'focusScore') valueToTest = window.userProfile.focusScore || 0;

    if (valueToTest >= (badge.threshold || 0)) {
      try {
        await unlockAchievement(currentUid, badge.id, badge.title);
        unlockedBadges.add(badge.id);
        showToast('Unlocked: ' + badge.title + '!');
      } catch (err) {
        console.warn('Could not unlock achievement.', err);
      }
    }
  }

  renderAchievementsBadges();
}

// Window actions

window.toggleTab = function (tabName) {
  const profileTab = document.getElementById('tab-content-profile');
  const settingsTab = document.getElementById('tab-content-settings');
  const btnProfile = document.getElementById('btn-tab-profile');
  const btnSettings = document.getElementById('btn-tab-settings');

  if (tabName === 'profile') {
    profileTab?.classList.remove('hidden');
    settingsTab?.classList.add('hidden');
    btnProfile?.classList.add('is-active');
    btnSettings?.classList.remove('is-active');
  } else {
    profileTab?.classList.add('hidden');
    settingsTab?.classList.remove('hidden');
    btnProfile?.classList.remove('is-active');
    btnSettings?.classList.add('is-active');
  }
};

window.showToast = function (message, isError) {
  const box = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const text = document.getElementById('toast-text');
  if (!box || !icon || !text) return;

  icon.textContent = isError ? '!' : 'OK';
  text.textContent = message;
  box.classList.add('show');
  setTimeout(function () { box.classList.remove('show'); }, 2800);
};

window.saveLearnerInfo = async function (event) {
  event.preventDefault();

  window.userProfile.name = document.getElementById('info-name').value.trim() || window.userProfile.name;
  window.userProfile.institution = document.getElementById('info-uni').value.trim();
  window.userProfile.faculty = document.getElementById('info-faculty').value.trim();
  window.userProfile.headline = window.userProfile.faculty
    ? window.userProfile.faculty + ' Student'
    : 'Student';
  window.userProfile.year = document.getElementById('info-year').value.trim();
  window.userProfile.country = document.getElementById('info-country').value.trim();
  window.userProfile.bio = document.getElementById('info-bio').value.trim();
  window.userProfile.linkedin = document.getElementById('info-linkedin').value.trim();
  window.userProfile.github = document.getElementById('info-github').value.trim();

  renderProfileUI();
  showToast('Academic profile changes saved!');

  if (currentUid) {
    try {
      await saveLearnerSettings(currentUid, window.userProfile);
      await logActivity(currentUid, 'Saved academic portfolio changes', 'profile');
    } catch (err) {
      console.warn('Could not sync profile to Firestore.', err);
    }
  }
};

window.updateAvatarSelection = async function (seed) {
  window.userProfile.avatar = seed;
  setAvatarLetter(document.getElementById('profile-avatar'), seed);
  showToast('Avatar updated to ' + seed + '!');

  if (currentUid) {
    try {
      await saveLearnerSettings(currentUid, { avatar: seed });
      await logActivity(currentUid, "Updated avatar preset: '" + seed + "'", 'profile');
    } catch (err) {
      console.warn('Could not save avatar to cloud.', err);
    }
  }
};

window.adjustGoal = async function (id, value) {
  const progress = parseInt(value, 10) || 0;
  const valEl = document.getElementById('goal-val-' + id);
  const barEl = document.getElementById('goal-bar-' + id);
  if (valEl) valEl.textContent = progress + '%';
  if (barEl) barEl.style.width = progress + '%';

  const target = goalsState.find(function (g) { return g.id === id; });
  if (target) target.progress = progress;

  if (currentUid) {
    try {
      await updateGoal(currentUid, id, { progress: progress });
    } catch (err) {
      console.warn('Could not update goal.', err);
    }
  }

  if (progress >= 100) accomplishGoal(id);
};

window.accomplishGoal = async function (id) {
  const target = goalsState.find(function (g) { return g.id === id; });
  if (!target || target.status === 'completed') return;

  if (currentUid) {
    try {
      await completeGoal(currentUid, id, target.name);
    } catch (err) {
      console.warn('Could not complete goal in Firestore.', err);
    }
  }

  window.userProfile.goalsCompleted = (window.userProfile.goalsCompleted || 0) + 1;
  showToast('Goal marked complete!');
  evaluateAchievementsUnlocks();
  renderProfileUI();
};

window.openAddGoalModal = function () {
  document.getElementById('goal-modal')?.classList.remove('hidden');
};

window.closeAddGoalModal = function () {
  document.getElementById('goal-modal')?.classList.add('hidden');
};

window.addGoalSubmit = async function () {
  const name = document.getElementById('new-goal-title')?.value.trim();
  const starting = parseInt(document.getElementById('new-goal-progress')?.value, 10) || 0;
  if (!name) return showToast('Goal description cannot be empty', true);

  if (currentUid) {
    try {
      await createGoal(currentUid, name, starting);
      showToast('Custom learning goal added!');
    } catch (err) {
      console.warn(err);
      showToast('Could not save goal. Try again.', true);
      return;
    }
  }

  closeAddGoalModal();
  const titleIn = document.getElementById('new-goal-title');
  if (titleIn) titleIn.value = '';
};

window.toggleSubjectSelected = async function (subject) {
  const index = selectedSubjects.indexOf(subject);
  if (index > -1) selectedSubjects.splice(index, 1);
  else selectedSubjects.push(subject);

  window.userProfile.subjects = [...selectedSubjects];
  renderSubjectsList();

  if (currentUid) {
    try {
      await saveLearnerSettings(currentUid, { subjects: selectedSubjects });
    } catch (err) {
      console.warn('Could not save subjects.', err);
    }
  }
};

window.triggerFileUpload = function () {
  document.getElementById('notes-file-input')?.click();
};

window.simulateNotesUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file || !currentUid) return;

  try {
    const url = await uploadResourceFile(currentUid, file);
    await addResource(currentUid, {
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      scope: 'Private',
      url: url
    });
    showToast('Uploaded new resource!');
    evaluateAchievementsUnlocks();
  } catch (err) {
    console.warn(err);
    showToast('Could not upload file.', true);
  }

  event.target.value = '';
};

window.deleteResource = async function (resourceId) {
  if (!currentUid || !resourceId) return;
  try {
    await removeResource(currentUid, resourceId);
    showToast('Resource deleted.');
  } catch (err) {
    console.warn(err);
    showToast('Could not delete resource.', true);
  }
};

window.logCustomStudyTime = async function () {
  if (!currentUid) return;
  try {
    const result = await logStudySession(currentUid, 2);
    window.userProfile = { ...window.userProfile, ...result };
    renderProfileUI();
    evaluateAchievementsUnlocks();
    showToast('Session logged +2 hours!');
  } catch (err) {
    console.warn(err);
    showToast('Could not log session.', true);
  }
};

window.updateAccountPassword = async function () {
  const currentPassword = document.getElementById('settings-current-pass')?.value || '';
  const newPassword = document.getElementById('settings-new-pass')?.value || '';
  const confirmPassword = document.getElementById('settings-confirm-pass')?.value || '';
  const button = document.getElementById('settings-update-pass-btn');

  if (!currentPassword) return showToast('Enter your current password.', true);
  if (newPassword.length < 6) return showToast('New password must be at least 6 characters.', true);
  if (newPassword !== confirmPassword) return showToast('New passwords do not match.', true);

  const user = auth.currentUser;
  if (!user || !user.email) {
    return showToast('Password change is only available for email accounts.', true);
  }

  const hasPasswordProvider = user.providerData.some(function (p) {
    return p.providerId === 'password';
  });
  if (!hasPasswordProvider) {
    return showToast('This account uses Google sign-in. Update your password in Google Account settings.', true);
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Updating...';
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    showToast('Password changed successfully!');
    document.getElementById('settings-current-pass').value = '';
    document.getElementById('settings-new-pass').value = '';
    document.getElementById('settings-confirm-pass').value = '';
  } catch (err) {
    const messages = {
      'auth/wrong-password': 'Current password is incorrect.',
      'auth/invalid-credential': 'Current password is incorrect.',
      'auth/weak-password': 'New password is too weak. Try a stronger one.'
    };
    showToast(messages[err.code] || 'Could not update password. Please try again.', true);
    console.warn('Password update failed:', err);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Update Password';
    }
  }
};

// Boot

initTheme();
initMobileNav();
initAuth();
