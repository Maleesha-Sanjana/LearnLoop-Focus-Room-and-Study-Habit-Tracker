import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC0SlrLGv9luVqaogkW4lpYL3mwIxxvSdA',
  authDomain: 'learnloop-f89c2.firebaseapp.com',
  projectId: 'learnloop-f89c2',
  storageBucket: 'learnloop-f89c2.firebasestorage.app',
  messagingSenderId: '777914976314',
  appId: '1:777914976314:web:2cd051169684c24caf8d03',
  measurementId: 'G-3SBVP21TE7'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const subjectsPool = ['Java', 'React', 'Database', 'Networking', 'Algorithms', 'Machine Learning', 'System Design'];
const presetAvatars = ['Aisha', 'David', 'Emma', 'Sarah', 'Caleb', 'Maya'];

const buddiesDatabase = [
  { name: 'Sanjaya', subjects: ['Database', 'Networking'], avail: 'weekdays', avatar: 'S', status: 'Online', desc: 'Always looking for SQL query reviews!' },
  { name: 'Kavindi', subjects: ['React', 'Algorithms'], avail: 'weekends', avatar: 'K', status: 'Studying React', desc: 'Working through hooks this morning.' },
  { name: 'Imran', subjects: ['Java', 'React'], avail: 'weekdays', avatar: 'I', status: 'Available', desc: 'Java developer learning responsive web design' },
  { name: 'Ruwan', subjects: ['Database', 'Java'], avail: 'weekends', avatar: 'R', status: 'Online', desc: 'Prepping for database schema design midterm.' },
  { name: 'Meena', subjects: ['Networking', 'React'], avail: 'weekdays', avatar: 'M', status: 'Offline', desc: 'Mainly active on Tuesday focus lobbies.' }
];

// State

let selectedSubjects = [];
let currentChattingBuddy = null;

let badgesList = [
  { id: 'streak-badge', title: '7 Day Streak', icon: '🔥', desc: 'Maintained 7 active study days', state: 'locked', threshold: 7, metric: 'streak' },
  { id: 'goal-badge', title: 'Goal Master', icon: '🎯', desc: 'Completed 20 goals overall', state: 'locked', threshold: 20, metric: 'goalsCompleted' },
  { id: 'hours-badge', title: '100 Study Hours', icon: '📚', desc: 'Crossed 100 study session marks', state: 'locked', threshold: 100, metric: 'hours' },
  { id: 'team-badge', title: 'Reputation Pro', icon: '✨', desc: 'Earned 500 reputation points', state: 'locked', threshold: 500, metric: 'reputation' },
  { id: 'notes-badge', title: 'Contributor Portfolio', icon: '📝', desc: 'Contributed shared note resources', state: 'locked', threshold: 3, metric: 'resourcesCount' },
  { id: 'focus-badge', title: 'Focus Champion', icon: '⚡', desc: 'Achieved a 95%+ focus score', state: 'locked', threshold: 95, metric: 'focusScore' }
];

let goalsState = [
  { id: 1, name: 'Finish React Course', progress: 75 },
  { id: 2, name: 'Database Assignment', progress: 40 },
  { id: 3, name: 'Study 3 hours/day', progress: 80 }
];

let recentActivities = [
  { text: "Joined Focus Room 'Algorithms Session 1'", time: '2 hours ago' },
  { text: 'Completed Java Advanced Quiz with 90%', time: 'Yesterday' },
  { text: "Uploaded 'Networking Cheat Sheet.pdf'", time: '2 days ago' },
  { text: 'Studied 2.5 hours with companion Sarah', time: '3 days ago' }
];

let sharedResources = [
  { name: 'Database Management Study notes.pdf', size: '2.4 MB', scope: 'Shared with Buddies' },
  { name: 'React Cheatsheet (Hooks & State).pdf', size: '1.1 MB', scope: 'Public' }
];

window.userProfile = createDefaultProfile(null);

function createDefaultProfile(user) {
  const name = user?.displayName && !user.displayName.startsWith('+') ? user.displayName : '';
  const seed = name ? name.replace(/\s/g, '') : 'User';
  return {
    name: name || 'Learner',
    headline: '',
    institution: '',
    faculty: '',
    year: '',
    country: '',
    bio: '',
    linkedin: '',
    github: '',
    level: 'Beginner',
    streak: 0,
    focusScore: 0,
    hours: 0,
    todayProgress: '0h 0m',
    goalsCompleted: 0,
    avatar: seed,
    subjects: [],
    reputation: 0,
    quizzes: 0,
    sessions: 0,
    questions: 0
  };
}

function profileDocRef(uid) {
  return doc(db, 'users', uid, 'profileData', 'learnerSettings');
}

  function populateProfile(user) {
    const navAvatar   = document.getElementById('nav-avatar');
    const navUsername = document.getElementById('nav-username');
    const photoURL = user.photoURL
      || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email)}&backgroundColor=111111&textColor=ffffff`;
    navAvatar.src = photoURL;
    const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Profile';
    navUsername.textContent = firstName;

    const previewImg = document.getElementById('profile-img-preview');
    previewImg.src = photoURL;

    if (user.displayName && !user.displayName.startsWith('+')) {
      const parts = user.displayName.split(' ');
      document.getElementById('first-name').value = parts[0] || '';
      document.getElementById('last-name').value = parts.slice(1).join(' ') || '';
    } else {
      await setDoc(profileDocRef(user.uid), window.userProfile);
    }
  } catch (err) {
    console.warn('Firestore access error, using local profile state.', err);
  }

  if (user.displayName && !user.displayName.startsWith('+')) {
    window.userProfile.name = user.displayName;
  }
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

  document.getElementById('profile-avatar').src =
    `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(p.avatar || 'User')}&backgroundColor=ede9fe`;

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

  filterBuddies();
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

  const inputName = document.getElementById('info-name').value.trim();
  const inputUni = document.getElementById('info-uni').value.trim();
  const inputFaculty = document.getElementById('info-faculty').value.trim();
  const inputYear = document.getElementById('info-year').value.trim();
  const inputCountry = document.getElementById('info-country').value.trim();
  const inputBio = document.getElementById('info-bio').value.trim();
  const inputLinkedin = document.getElementById('info-linkedin').value.trim();
  const inputGithub = document.getElementById('info-github').value.trim();

  window.userProfile.name = inputName || window.userProfile.name;
  window.userProfile.institution = inputUni;
  window.userProfile.faculty = inputFaculty;
  window.userProfile.headline = inputFaculty ? `${inputFaculty} Student` : 'Student';
  window.userProfile.year = inputYear;
  window.userProfile.country = inputCountry;
  window.userProfile.bio = inputBio;
  window.userProfile.linkedin = inputLinkedin;
  window.userProfile.github = inputGithub;

  renderProfileUI();
  showToast('Academic profile changes saved!');
  addActivityToStream(`Saved academic portfolio changes: '${inputUni || 'profile'}'`);

  const user = auth.currentUser;
  if (user) {
    try {
      await setDoc(profileDocRef(user.uid), window.userProfile, { merge: true });
      showToast('Profile synced to LearnLoop Cloud!');
    } catch (err) {
      console.warn('Could not sync profile to Firestore.', err);
    }
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

window.updateAvatarSelection = async function (seed) {
  window.userProfile.avatar = seed;
  document.getElementById('profile-avatar').src =
    `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ede9fe`;
  showToast(`Avatar updated to ${seed}!`);
  addActivityToStream(`Updated avatar preset: '${seed}'`);

  if (auth.currentUser) {
    try {
      await updateDoc(profileDocRef(auth.currentUser.uid), { avatar: seed });
    } catch (err) {
      console.warn('Could not save avatar to cloud.', err);
    }
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

window.adjustGoal = function (id, value) {
  const valEl = document.getElementById(`goal-val-${id}`);
  const barEl = document.getElementById(`goal-bar-${id}`);
  if (valEl) valEl.innerText = value + '%';
  if (barEl) barEl.style.width = value + '%';

  const target = goalsState.find(g => g.id === id);
  if (target) {
    target.progress = parseInt(value, 10);
    if (target.progress === 100) accomplishGoal(id);
  }
};

window.accomplishGoal = function (id) {
  const target = goalsState.find(g => g.id === id);
  if (target && target.progress < 100) {
    target.progress = 100;
    adjustGoal(id, 100);
  }

  triggerConfettiBurst();
  showToast('🎉 Goal marked complete!');
  addActivityToStream(`Completed learning target: '${target ? target.name : 'Unknown'}'`);

  window.userProfile.goalsCompleted = parseInt(window.userProfile.goalsCompleted || 0, 10) + 1;
  evaluateAchievementsUnlocks();
  renderProfileUI();
};

window.openAddGoalModal = function () {
  document.getElementById('goal-modal')?.classList.remove('hidden');
};

window.closeAddGoalModal = function () {
  document.getElementById('goal-modal')?.classList.add('hidden');
};

window.addGoalSubmit = function () {
  const name = document.getElementById('new-goal-title')?.value.trim();
  const starting = parseInt(document.getElementById('new-goal-progress')?.value, 10) || 0;
  if (!name) return showToast('Goal description cannot be empty', true);

  const newId = goalsState.length ? Math.max(...goalsState.map(g => g.id)) + 1 : 1;
  goalsState.push({ id: newId, name, progress: starting });
  renderGoalTrackers();
  closeAddGoalModal();
  showToast('Custom learning goal added!');
  addActivityToStream(`Configured goal target: '${name}'`);

  const titleIn = document.getElementById('new-goal-title');
  if (titleIn) titleIn.value = '';
};

window.toggleSubjectSelected = function (subject) {
  const index = selectedSubjects.indexOf(subject);
  if (index > -1) {
    selectedSubjects.splice(index, 1);
    addActivityToStream(`Removed study focus tag: '${subject}'`);
  } else {
    selectedSubjects.push(subject);
    addActivityToStream(`Added study focus tag: '${subject}'`);
  }
  window.userProfile.subjects = [...selectedSubjects];
  renderSubjectsList();
  filterBuddies();
};

window.openChatModal = function (buddyName) {
  const buddy = buddiesDatabase.find(b => b.name === buddyName);
  if (!buddy) return;

  currentChattingBuddy = buddy;
  document.getElementById('chat-modal-title').innerText = `Chatting with ${buddy.name}`;
  document.getElementById('chat-modal-status').innerText = buddy.status;
  document.getElementById('chat-modal-avatar').innerText = buddy.avatar;

  const container = document.getElementById('chat-messages-container');
  container.innerHTML = `
    <div class="flex flex-col">
      <span class="text-[#111] dark:text-[#f0f0f0] font-bold text-[10px] mb-0.5">${buddy.name}</span>
      <div class="bg-white dark:bg-[#141414] border border-[#e8e8e8] dark:border-[#2a2a2a] p-2.5 rounded-2xl rounded-tl-none inline-block max-w-[80%]">
        Hey ${window.userProfile.name}! ${buddy.desc} Interested in a joint session?
      </div>
    </div>
  `;
  document.getElementById('chat-modal').classList.remove('hidden');
};

window.closeChatModal = function () {
  document.getElementById('chat-modal').classList.add('hidden');
  currentChattingBuddy = null;
};

window.handleChatSubmit = function (e) {
  if (e.key === 'Enter') sendChatMessage();
};

window.sendChatMessage = function () {
  const input = document.getElementById('chat-text-input');
  const msgText = input.value.trim();
  if (!msgText) return;

  const container = document.getElementById('chat-messages-container');
  container.insertAdjacentHTML('beforeend', `
    <div class="flex flex-col items-end">
      <span class="text-[#888] text-[10px] mb-0.5">You</span>
      <div class="ll-btn-primary p-2.5 rounded-2xl rounded-tr-none inline-block max-w-[80%] text-right">${msgText}</div>
    </div>
  `);
  input.value = '';
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    if (!currentChattingBuddy) return;
    let reply = "Count me in! Let's meet in a Focus Room.";
    if (currentChattingBuddy.name === 'Sanjaya') reply = "Brilliant! I'm prepped for databases. Let me create a room.";
    if (currentChattingBuddy.name === 'Kavindi') reply = 'Amazing! I am studying React render lifecycles today.';

    container.insertAdjacentHTML('beforeend', `
      <div class="flex flex-col">
        <span class="text-[#111] dark:text-[#f0f0f0] font-bold text-[10px] mb-0.5">${currentChattingBuddy.name}</span>
        <div class="bg-white dark:bg-[#141414] border border-[#e8e8e8] dark:border-[#2a2a2a] p-2.5 rounded-2xl rounded-tl-none inline-block max-w-[80%]">${reply}</div>
      </div>
    `);
    container.scrollTop = container.scrollHeight;
  }, 1200);
};

window.downloadResourceSimulated = function (name) {
  showToast(`Downloading '${name}'...`);
};

window.deleteResourceSimulated = function (index) {
  const deleted = sharedResources[index];
  sharedResources.splice(index, 1);
  renderSharedResources();
  evaluateAchievementsUnlocks();
  showToast(`Deleted: '${deleted.name}'`);
  addActivityToStream(`Removed notes attachment: '${deleted.name}'`);
};

window.triggerFileUpload = function () {
  document.getElementById('notes-file-input')?.click();
};

window.simulateNotesUpload = function (event) {
  const file = event.target.files[0];
  if (file) {
    sharedResources.unshift({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      scope: 'Shared with Buddies'
    });
    renderSharedResources();
    evaluateAchievementsUnlocks();
    showToast('Uploaded new resource!');
    addActivityToStream(`Contributed shared note: '${file.name}'`);
  }
};

window.logCustomStudyTime = function () {
  window.userProfile.hours = parseInt(window.userProfile.hours || 0, 10) + 2;
  window.userProfile.reputation = parseInt(window.userProfile.reputation || 0, 10) + 25;
  window.userProfile.sessions = parseInt(window.userProfile.sessions || 0, 10) + 1;
  evaluateAchievementsUnlocks();
  renderProfileUI();
  showToast('⚡ Session logged +2 hours!');
  addActivityToStream('Finished custom Pomodoro milestone.');
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

window.generateAIInsights = async function () {
  const container = document.getElementById('ai-insights-container');
  const button = document.getElementById('btn-generate-ai');
  if (!container || !button) return;

  button.disabled = true;
  button.innerText = 'Analyzing metrics...';

  const streak = document.getElementById('badge-streak')?.innerText ?? '0';
  const focus = document.getElementById('badge-focus')?.innerText ?? '0%';
  const hrs = document.getElementById('stat-hours')?.innerText ?? '0 hrs';

  container.innerHTML = `
    <div class="space-y-3 bg-[#1a1a1a] dark:bg-[#0a0a0a] p-4 rounded-2xl border border-[#333] dark:border-[#2a2a2a] text-[11px] animate-fade-in text-[#ccc]">
      <p><strong class="text-[#f0f0f0]">🔥 Strongest Focus:</strong> ${selectedSubjects.join(' & ') || 'General study'}. Consistent streak: ${streak} days.</p>
      <p><strong class="text-[#aaa]">⚠️ Needs Improvement:</strong> Database schemas and SQL joins need more practice assignments.</p>
      <p class="text-[10px] text-[#888] font-medium">💡 Recommended: Join a Databases focus room this afternoon.</p>
    </div>
    <button onclick="generateAIInsights()" class="w-full bg-[#f0f0f0] text-[#111] font-extrabold text-[10px] py-2 rounded-xl mt-3 hover:bg-white transition">
      Re-Analyze Profile
    </button>
  `;

  button.disabled = false;
  button.innerText = 'Analyze Learner Profile';
};

window.sendFocusCall = function (name) {
  showToast(`Sent Focus Room invite to ${name}!`);
  addActivityToStream(`Sent focus call invitation to '${name}'`);
};

window.updatePasswordSimulated = function () {
  const value = document.getElementById('settings-new-pass').value;
  if (value.length < 6) return showToast('Password must be at least 6 characters!', true);
  showToast('Password changed successfully!');
  addActivityToStream('Updated account password.');
  document.getElementById('settings-new-pass').value = '';
};

function renderGoalTrackers() {
  const list = document.getElementById('goals-list');
  if (!list) return;
  list.innerHTML = '';

  goalsState.forEach(goal => {
    list.insertAdjacentHTML('beforeend', `
      <div class="bg-[#f5f5f5] dark:bg-[#1a1a1a] p-4 rounded-2xl border border-[#e8e8e8] dark:border-[#2a2a2a]">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold text-sm text-[#111] dark:text-[#f0f0f0]">${goal.name}</span>
          <span class="text-xs text-[#111] dark:text-[#f0f0f0] font-extrabold" id="goal-val-${goal.id}">${goal.progress}%</span>
        </div>
        <div class="w-full bg-[#e8e8e8] dark:bg-[#2a2a2a] h-2.5 rounded-full overflow-hidden">
          <div id="goal-bar-${goal.id}" class="bg-[#111] dark:bg-[#f0f0f0] h-full rounded-full transition-all duration-300" style="width: ${goal.progress}%"></div>
        </div>
        <div class="flex items-center justify-between mt-3">
          <input type="range" min="0" max="100" value="${goal.progress}" oninput="adjustGoal(${goal.id}, this.value)" class="w-3/4 accent-[#111] dark:accent-[#f0f0f0] cursor-pointer"/>
          <button onclick="accomplishGoal(${goal.id})" class="text-xs font-bold text-[#888] hover:text-[#111] dark:hover:text-[#f0f0f0] transition">Mark Done</button>
        </div>
      </div>
    `);
  });
}

function renderSubjectsList() {
  const container = document.getElementById('subjects-container');
  if (!container) return;
  container.innerHTML = '';

  subjectsPool.forEach(subject => {
    const isSelected = selectedSubjects.includes(subject);
    const tagClass = isSelected
      ? 'px-3 py-1.5 rounded-full text-xs font-bold bg-[#f5f5f5] dark:bg-[#1e1e1e] text-[#111] dark:text-[#f0f0f0] border border-[#e8e8e8] dark:border-[#2a2a2a] cursor-pointer transition hover:scale-105'
      : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-[#f5f5f5] dark:bg-[#1a1a1a] text-[#888] dark:text-[#666] border border-[#e8e8e8] dark:border-[#2a2a2a] cursor-pointer transition hover:scale-105';

    const btn = document.createElement('button');
    btn.className = tagClass;
    btn.innerText = (isSelected ? '✓ ' : '+ ') + subject;
    btn.onclick = () => toggleSubjectSelected(subject);
    container.appendChild(btn);
  });
}

window.filterBuddies = function () {
  const list = document.getElementById('matching-buddies-list');
  if (!list) return;
  list.innerHTML = '';

  const dbChecked = document.getElementById('partner-db')?.checked ?? true;
  const reactChecked = document.getElementById('partner-react')?.checked ?? true;
  const javaChecked = document.getElementById('partner-java')?.checked ?? false;
  const weekdayChecked = document.getElementById('avail-weekdays')?.checked ?? true;
  const weekendChecked = document.getElementById('avail-weekends')?.checked ?? true;

  const searchSubjects = [];
  if (dbChecked) searchSubjects.push('Database');
  if (reactChecked) searchSubjects.push('React');
  if (javaChecked) searchSubjects.push('Java');

  const filtered = buddiesDatabase.filter(buddy => {
    const matchSubj = buddy.subjects.some(s => searchSubjects.includes(s));
    const matchAvail =
      (buddy.avail === 'weekdays' && weekdayChecked) ||
      (buddy.avail === 'weekends' && weekendChecked);
    return matchSubj && matchAvail;
  });
}

function renderSharedResources() {
  const list = document.getElementById('notes-list');
  if (!list) return;

  if (!sharedResources.length) {
    list.innerHTML = '<p class="text-xs text-[#888] text-center py-4">No shared resources yet. Upload your first notes!</p>';
    return;
  }

  list.innerHTML = sharedResources.map(res => `
    <div class="flex items-center justify-between p-3 bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-2xl border border-[#e8e8e8] dark:border-[#2a2a2a]">
      <div class="flex items-center gap-3">
        <span class="text-xl">📄</span>
        <div>
          <p class="text-xs font-bold leading-tight text-[#111] dark:text-[#f0f0f0]">${escapeHtml(res.name)}</p>
          <span class="text-[10px] text-[#888]">${res.size} • ${res.scope}</span>
        </div>
      </div>
      <div class="flex gap-2 text-[10px] font-bold">
        <button onclick="downloadResource('${res.id}')" class="text-[#111] dark:text-[#f0f0f0] hover:underline">Download</button>
        <button onclick="deleteResource('${res.id}')" class="text-red-500 hover:underline">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderBuddiesSidebar() {
  const container = document.getElementById('friends-list');
  const countEl = document.getElementById('buddies-count');
  if (countEl) countEl.textContent = `${buddiesList.length} Active`;

  if (filtered.length === 0) {
    list.innerHTML =
      '<div class="col-span-2 text-center py-4 text-xs text-slate-400 dark:text-zinc-500 italic">No matches found. Expand search tags!</div>';
    return;
  }

  filtered.forEach(buddy => {
    list.insertAdjacentHTML('beforeend', `
      <div class="flex items-center justify-between p-3.5 bg-[#f5f5f5] dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#2a2a2a] rounded-2xl">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-[#111] dark:bg-[#f0f0f0] text-white dark:text-[#111] flex items-center justify-center font-bold text-xs">${buddy.avatar}</div>
          <div>
            <p class="text-xs font-bold text-[#111] dark:text-[#f0f0f0]">${buddy.name}</p>
            <p class="text-[9px] text-[#888] dark:text-[#666] font-semibold">${buddy.subjects.join(', ')}</p>
          </div>
        </div>
        <div class="flex gap-1">
          <button onclick="openChatModal('${buddy.name}')" class="text-[10px] bg-[#f5f5f5] dark:bg-[#1e1e1e] text-[#111] dark:text-[#f0f0f0] px-2.5 py-1.5 rounded-lg hover:bg-[#e8e8e8] font-bold transition">Message</button>
          <button onclick="sendFocusCall('${buddy.name}')" class="text-[10px] bg-white dark:bg-[#141414] border border-[#e8e8e8] dark:border-[#2a2a2a] px-2.5 py-1.5 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] font-bold shadow-sm transition">Invite Focus</button>
        </div>
      </div>
    `);
  });
};

function renderAchievementsBadges() {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  grid.innerHTML = '';

  badgesList.forEach(badge => {
    const isUnlocked = badge.state === 'unlocked';
    grid.insertAdjacentHTML('beforeend', `
      <div class="flex items-center gap-3 p-2.5 bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-2xl border border-[#e8e8e8] dark:border-[#2a2a2a] ${isUnlocked ? '' : 'opacity-40'}">
        <span class="text-2xl">${badge.icon}</span>
        <div>
          <p class="text-[11px] font-bold leading-tight">${badge.title}</p>
          <span class="text-[9px] ${isUnlocked ? 'text-[#111] dark:text-[#f0f0f0] font-semibold' : 'text-[#888]'}">${isUnlocked ? 'Unlocked' : 'In Progress'}</span>
        </div>
      </div>
    `);
  });
}

function renderSharedResources() {
  const list = document.getElementById('notes-list');
  if (!list) return;
  list.innerHTML = '';

  sharedResources.forEach((res, index) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="flex items-center justify-between p-3 bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-2xl border border-[#e8e8e8] dark:border-[#2a2a2a]">
        <div class="flex items-center gap-3">
          <span class="text-xl">📄</span>
          <div>
            <p class="text-xs font-bold leading-tight text-[#111] dark:text-[#f0f0f0]">${res.name}</p>
            <span class="text-[10px] text-[#888]">${res.size} • ${res.scope}</span>
          </div>
        </div>
        <div class="flex gap-2 text-[10px] font-bold">
          <button onclick="downloadResourceSimulated('${res.name.replace(/'/g, "\\'")}')" class="text-[#111] dark:text-[#f0f0f0] hover:underline">Download</button>
          <button onclick="deleteResourceSimulated(${index})" class="text-red-500 hover:underline">Delete</button>
        </div>
      </div>
    `);
  });
}

function renderBuddiesSidebar() {
  const container = document.getElementById('friends-list');
  if (!container) return;
  container.innerHTML = '';

  buddiesDatabase.slice(0, 4).forEach(b => {
    const isOnline = b.status !== 'Offline';
    const badgeColor =
      b.status === 'Studying React' ? 'bg-[#111] dark:bg-[#f0f0f0] animate-pulse' : isOnline ? 'bg-[#111] dark:bg-[#f0f0f0]' : 'bg-[#ccc]';
    container.insertAdjacentHTML('beforeend', `
      <div class="flex items-center justify-between cursor-pointer hover:bg-[#f5f5f5] dark:hover:bg-[#1a1a1a] p-1.5 rounded-xl transition" onclick="openChatModal('${b.name}')">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-[#f5f5f5] dark:bg-[#1e1e1e] flex items-center justify-center font-black text-[#111] dark:text-[#f0f0f0] text-sm">${b.avatar}</div>
          <div>
            <p class="text-xs font-bold text-[#111] dark:text-[#f0f0f0]">${b.name}</p>
            <p class="text-[10px] text-[#888]">${b.status}</p>
          </div>
        </div>
        <span class="w-2.5 h-2.5 rounded-full ${badgeColor}"></span>
      </div>
    `);
  });
}

function renderActivityTimeline() {
  const container = document.getElementById('activity-stream');
  if (!container) return;
  container.innerHTML = '';

  recentActivities.forEach(act => {
    container.insertAdjacentHTML('beforeend', `
      <div class="relative">
        <div class="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-[#111] dark:bg-[#f0f0f0] border-2 border-white dark:border-[#0a0a0a]"></div>
        <p class="text-xs font-bold text-[#111] dark:text-[#f0f0f0]">${act.text}</p>
        <span class="text-[10px] text-[#888]">${act.time}</span>
      </div>
    `);
  });
}

function addActivityToStream(text) {
  recentActivities.unshift({ text, time: 'Just now' });
  renderActivityTimeline();
}

function renderAvatarSelections() {
  const grid = document.getElementById('avatars-selection-grid');
  if (!grid) return;
  grid.innerHTML = '';

  presetAvatars.forEach(avatar => {
    grid.insertAdjacentHTML('beforeend', `
      <button onclick="updateAvatarSelection('${avatar}')" class="flex flex-col items-center p-3 bg-[#f5f5f5] dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#2a2a2a] hover:border-[#111] dark:hover:border-[#f0f0f0] rounded-2xl transition">
        <img class="w-14 h-14 rounded-xl mb-1.5" src="https://api.dicebear.com/7.x/notionists/svg?seed=${avatar}&backgroundColor=ede9fe" alt="${avatar}"/>
        <span class="text-xs font-semibold text-slate-900 dark:text-zinc-100">${avatar}</span>
      </button>
    `);
  });
}

function evaluateAchievementsUnlocks() {
  badgesList.forEach(badge => {
    if (badge.state === 'locked') {
      let valueToTest = 0;
      if (badge.metric === 'streak') valueToTest = window.userProfile.streak;
      if (badge.metric === 'goalsCompleted') valueToTest = window.userProfile.goalsCompleted;
      if (badge.metric === 'hours') valueToTest = window.userProfile.hours;
      if (badge.metric === 'reputation') valueToTest = window.userProfile.reputation;
      if (badge.metric === 'resourcesCount') valueToTest = sharedResources.length;
      if (badge.metric === 'focusScore') valueToTest = window.userProfile.focusScore;

      if (valueToTest >= badge.threshold) {
        badge.state = 'unlocked';
        showToast(`🔓 Unlocked: ${badge.title}!`);
        triggerConfettiBurst();
        addActivityToStream(`Earned achievement: '${badge.title}'`);
      }
    }
  });
  renderAchievementsBadges();
}

function triggerConfettiBurst() {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  }
}

function initPage() {
  renderGoalTrackers();
  renderSubjectsList();
  renderBuddiesSidebar();
  renderSharedResources();
  renderActivityTimeline();
  renderAchievementsBadges();
  renderAvatarSelections();

  ['partner-db', 'partner-react', 'partner-java', 'avail-weekdays', 'avail-weekends'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', filterBuddies);
  });

  filterBuddies();
}

initTheme();
initAuth();
