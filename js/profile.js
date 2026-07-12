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
  subscribeLearnerSettings
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

// Auth

function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const isDark = localStorage.getItem('ll_theme') === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
  if (themeToggle) {
    themeToggle.textContent = isDark ? 'Light' : 'Dark';
  }
  themeToggle?.addEventListener('click', function () {
    const dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    document.body.classList.toggle('dark', dark);
    if (themeToggle) {
      themeToggle.textContent = dark ? 'Light' : 'Dark';
    }
    localStorage.setItem('ll_theme', dark ? 'dark' : 'light');
  });
}

function avatarInitial(seed) {
  return String(seed || 'User').charAt(0).toUpperCase();
}

function setAvatarElement(el, seed) {
  if (!el) return;
  el.textContent = avatarInitial(seed);
}

async function loadProfileForUser(user) {
  currentUid = user.uid;
  window.userProfile = defaultProfile(user);

  const appConfig = await loadAppConfig();
  subjectsPool = appConfig.subjects;
  presetAvatars = appConfig.avatars;
  badgeDefinitions = appConfig.badges;

  try {
    const saved = await getLearnerSettings(user.uid);
    if (saved) {
      window.userProfile = { ...window.userProfile, ...saved };
    } else {
      await saveLearnerSettings(user.uid, window.userProfile);
    }
  } catch (err) {
    console.warn('Firestore access error, using local profile state.', err);
  }

  if (user.displayName && !user.displayName.startsWith('+')) {
    window.userProfile.name = user.displayName;
  }

  selectedSubjects = window.userProfile.subjects?.length ? [...window.userProfile.subjects] : [];

  setupFirestoreListeners(user.uid);
}

function setupFirestoreListeners(uid) {
  firestoreUnsubs.forEach(function (unsub) { unsub(); });
  firestoreUnsubs.length = 0;

  firestoreUnsubs.push(subscribeLearnerSettings(uid, function (data) {
    window.userProfile = { ...window.userProfile, ...data };
    selectedSubjects = window.userProfile.subjects?.length ? [...window.userProfile.subjects] : selectedSubjects;
    renderProfileUI();
    renderSubjectsList();
  }));

  firestoreUnsubs.push(subscribeGoals(uid, function (goals) {
    goalsState = goals;
    renderGoalTrackers();
  }));

  firestoreUnsubs.push(subscribeActivities(uid, function (activities) {
    recentActivities = activities;
    renderActivityTimeline();
  }));

  firestoreUnsubs.push(subscribeResources(uid, function (resources) {
    sharedResources = resources;
    evaluateAchievementsUnlocks();
  }));

  firestoreUnsubs.push(subscribeAchievements(uid, function (badges) {
    unlockedBadges = badges;
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
    await loadProfileForUser(user);
    renderProfileUI();
    renderSubjectsList();
    renderAvatarSelections();
    renderAchievementsBadges();
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

  setAvatarElement(document.getElementById('profile-avatar'), p.avatar || p.name);

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

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.value = (val !== null && val !== undefined) ? val : '';
  }
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
    btn.innerText = (isSelected ? 'Selected: ' : 'Add ') + subject;
    btn.onclick = function () { toggleSubjectSelected(subject); };
    container.appendChild(btn);
  });
}

function renderAvatarSelections() {
  const grid = document.getElementById('avatars-selection-grid');
  if (!grid) return;
  grid.innerHTML = presetAvatars.map(function (avatar) {
    const letter = avatarInitial(avatar);
    return `
    <button type="button" onclick="updateAvatarSelection('${avatar}')" class="avatar-option">
      <div class="avatar-circle small">${letter}</div>
      <span>${avatar}</span>
    </button>
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
      <span class="activity-time">${act.time}</span>
    </div>
  `;
  }).join('');
}

// Goals

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
        <span class="goal-progress-text" id="goal-val-${goal.id}">${goal.progress}%</span>
      </div>
      <div class="goal-bar-track">
        <div id="goal-bar-${goal.id}" class="goal-bar-fill" style="width: ${goal.progress}%"></div>
      </div>
      <div class="goal-controls">
        <input type="range" min="0" max="100" value="${goal.progress}" oninput="adjustGoal('${goal.id}', this.value)" ${goal.status === 'completed' ? 'disabled' : ''}/>
        <button type="button" onclick="accomplishGoal('${goal.id}')" class="link-btn" ${goal.status === 'completed' ? 'disabled' : ''}>Mark Done</button>
      </div>
    </div>
  `;
  }).join('');
}

window.adjustGoal = async function (id, value) {
  const progress = parseInt(value, 10);
  const valEl = document.getElementById(`goal-val-${id}`);
  const barEl = document.getElementById(`goal-bar-${id}`);
  if (valEl) valEl.innerText = progress + '%';
  if (barEl) barEl.style.width = progress + '%';

  const target = goalsState.find(g => g.id === id);
  if (target) {
    target.progress = progress;
    if (currentUid) {
      try {
        await updateGoal(currentUid, id, { progress });
      } catch (err) {
        console.warn('Could not update goal.', err);
      }
    }
    if (progress === 100 && target.status !== 'completed') await accomplishGoal(id);
  }
};

window.accomplishGoal = async function (id) {
  const target = goalsState.find(g => g.id === id);
  if (!target || target.status === 'completed') return;

  target.progress = 100;
  target.status = 'completed';

  const valEl = document.getElementById(`goal-val-${id}`);
  const barEl = document.getElementById(`goal-bar-${id}`);
  if (valEl) valEl.innerText = '100%';
  if (barEl) barEl.style.width = '100%';

  triggerConfettiBurst();
  showToast('Goal marked complete!');

  if (currentUid) {
    try {
      window.userProfile.goalsCompleted = await completeGoal(currentUid, id, target.name);
    } catch (err) {
      window.userProfile.goalsCompleted = parseInt(window.userProfile.goalsCompleted || 0, 10) + 1;
      console.warn('Could not complete goal in Firestore.', err);
    }
  }

  await evaluateAchievementsUnlocks();
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
  if (!currentUid) return;

  try {
    const id = await createGoal(currentUid, name, starting);
    goalsState.push({ id, name, progress: starting, status: 'active' });
    renderGoalTrackers();
    closeAddGoalModal();
    showToast('Custom learning goal added!');
    document.getElementById('new-goal-title').value = '';
  } catch (err) {
    showToast('Could not create goal. Try again.', true);
    console.warn(err);
  }
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

// Achievements

function renderAchievementsBadges() {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  grid.innerHTML = '';

  badgeDefinitions.forEach(function (badge) {
    const isUnlocked = unlockedBadges.has(badge.id);
    grid.insertAdjacentHTML('beforeend', `
      <div class="badge-item${isUnlocked ? '' : ' locked'}">
        <span class="badge-icon">${badge.icon}</span>
        <div>
          <p class="badge-title">${badge.title}</p>
          <span class="badge-status${isUnlocked ? ' unlocked' : ''}">${isUnlocked ? 'Unlocked' : 'In Progress'}</span>
        </div>
      </div>
    `);
  });
}

async function evaluateAchievementsUnlocks() {
  if (!currentUid) return;

  for (const badge of badgeDefinitions) {
    if (unlockedBadges.has(badge.id)) continue;

    let valueToTest = 0;
    if (badge.metric === 'streak') valueToTest = window.userProfile.streak;
    if (badge.metric === 'goalsCompleted') valueToTest = window.userProfile.goalsCompleted;
    if (badge.metric === 'hours') valueToTest = window.userProfile.hours;
    if (badge.metric === 'reputation') valueToTest = window.userProfile.reputation;
    if (badge.metric === 'resourcesCount') valueToTest = sharedResources.length;
    if (badge.metric === 'focusScore') valueToTest = window.userProfile.focusScore;

    if (valueToTest >= badge.threshold) {
      try {
        await unlockAchievement(currentUid, badge.id, badge.title);
        unlockedBadges.add(badge.id);
        showToast('Unlocked: ' + badge.title + '!');
        triggerConfettiBurst();
      } catch (err) {
        console.warn('Could not unlock achievement.', err);
      }
    }
  }
  renderAchievementsBadges();
}

function triggerConfettiBurst() {
  // Simple local feedback only; no external animation library.
}

// Settings

window.saveLearnerInfo = async function (e) {
  if (e) e.preventDefault();

  window.userProfile.name = document.getElementById('info-name').value.trim() || window.userProfile.name;
  window.userProfile.institution = document.getElementById('info-uni').value.trim();
  window.userProfile.faculty = document.getElementById('info-faculty').value.trim();
  window.userProfile.headline = window.userProfile.faculty ? `${window.userProfile.faculty} Student` : 'Student';
  window.userProfile.year = document.getElementById('info-year').value.trim();
  window.userProfile.country = document.getElementById('info-country').value.trim();
  window.userProfile.bio = document.getElementById('info-bio').value.trim();
  window.userProfile.linkedin = document.getElementById('info-linkedin').value.trim();
  window.userProfile.github = document.getElementById('info-github').value.trim();
  window.userProfile.subjects = [...selectedSubjects];

  renderProfileUI();
  showToast('Academic profile changes saved!');

  if (currentUid) {
    try {
      await saveLearnerSettings(currentUid, window.userProfile);
      showToast('Profile synced to LearnLoop Cloud!');
    } catch (err) {
      console.warn('Could not sync profile to Firestore.', err);
    }
  }

  toggleTab('profile');
};

window.updateAvatarSelection = async function (seed) {
  window.userProfile.avatar = seed;
  setAvatarElement(document.getElementById('profile-avatar'), seed);
  showToast(`Avatar updated to ${seed}!`);

  if (currentUid) {
    try {
      await saveLearnerSettings(currentUid, { avatar: seed });
    } catch (err) {
      console.warn('Could not save avatar to cloud.', err);
    }
  }
};

window.logCustomStudyTime = async function () {
  if (!currentUid) return;
  try {
    const result = await logStudySession(currentUid, 2);
    window.userProfile.hours = result.hours;
    window.userProfile.sessions = result.sessions;
    window.userProfile.reputation = result.reputation;
    window.userProfile.streak = result.streak;
    await evaluateAchievementsUnlocks();
    renderProfileUI();
    showToast('Session logged (+2 hours)!');
  } catch (err) {
    showToast('Could not log session.', true);
  }
};

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

window.showToast = function (message, isError = false) {
  const box = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const text = document.getElementById('toast-text');
  if (!box || !icon || !text) return;

  icon.innerText = isError ? '!' : 'OK';
  text.innerText = message;
  box.classList.add('show');

  setTimeout(function () {
    box.classList.remove('show');
  }, 2800);
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
  if (!user?.email) {
    return showToast('Password change is only available for email accounts.', true);
  }

  const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');
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

    document.getElementById('settings-current-pass').value = '';
    document.getElementById('settings-new-pass').value = '';
    document.getElementById('settings-confirm-pass').value = '';
    showToast('Password changed successfully!');
  } catch (err) {
    const messages = {
      'auth/wrong-password': 'Current password is incorrect.',
      'auth/invalid-credential': 'Current password is incorrect.',
      'auth/weak-password': 'New password is too weak. Try a stronger one.',
      'auth/requires-recent-login': 'Please log out, sign in again, and retry.'
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

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

initTheme();
initAuth();
