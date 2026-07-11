import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  auth,
  db,
  getQuizQuestions,
  saveQuizResult,
  sendTeamInviteRequest,
  acceptTeamInvite,
  FOCUS_ROOM_MAX_TEAM
} from './firebase.js';

let currentUser = null;
let sessionId = null;
let sessionUnsubscribe = null;
let currentMode = null;
let teamName = '';
let teamMembers = [];
let pendingInvites = [];
let questions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let correctCount = 0;
let timerInterval = null;

const saved = localStorage.getItem('ll_theme');
const isDark = saved === 'dark';
document.body.classList.toggle('dark', isDark);
document.getElementById('theme-icon-sun').style.display = isDark ? 'block' : 'none';
document.getElementById('theme-icon-moon').style.display = isDark ? 'none' : 'block';
document.getElementById('theme-toggle').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  document.getElementById('theme-icon-sun').style.display = dark ? 'block' : 'none';
  document.getElementById('theme-icon-moon').style.display = dark ? 'none' : 'block';
  localStorage.setItem('ll_theme', dark ? 'dark' : 'light');
});

function hostName() {
  return currentUser.displayName || currentUser.email?.split('@')[0] || 'Host';
}

async function initAuth() {
  await auth.authStateReady();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    const photoURL = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email)}&backgroundColor=111111&textColor=ffffff`;
    document.getElementById('nav-avatar').src = photoURL;
    document.getElementById('nav-username').textContent = user.displayName ? user.displayName.split(' ')[0] : 'Profile';

    try {
      await loadQuestionsFromDatabase();
    } catch (err) {
      console.warn('Could not load quiz questions from Firestore.', err);
    }

    await handleJoinFromUrl();
  });
}

async function handleJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const joinSession = params.get('join');
  const inviteId = params.get('invite');
  if (!joinSession || !inviteId) return;

  try {
    currentMode = 'team';
    sessionId = joinSession;
    const session = await acceptTeamInvite({
      inviteId,
      sessionId: joinSession,
      user: currentUser
    });

    teamName = session.teamName || 'Team';
    teamMembers = session.members || [];
    pendingInvites = session.pendingInvites || [];

    window.history.replaceState({}, '', 'focusroom.html');
    subscribeToSession();
    showScreen('team-lobby-screen');
    alert(`You joined "${teamName}"! Waiting for the host to start the quiz.`);
  } catch (err) {
    alert(err.message || 'Could not join team from invite link.');
    window.history.replaceState({}, '', 'focusroom.html');
  }
}

async function loadQuestionsFromDatabase() {
  try {
    questions = await getQuizQuestions();
  } catch (err) {
    console.warn('Could not load quiz questions from Firestore.', err);
    questions = [];
  }
  return questions;
}

document.getElementById('individual-mode-btn').addEventListener('click', async () => {
  await loadQuestionsFromDatabase();
  if (!questions.length) {
    alert('No quiz questions in the database yet.\n\nLog in and open seed.html once to upload questions from data/quiz-questions.json to Firestore.');
    return;
  }
  currentMode = 'individual';
  startIndividualQuiz();
});

document.getElementById('team-mode-btn').addEventListener('click', async () => {
  await loadQuestionsFromDatabase();
  if (!questions.length) {
    alert('No quiz questions in the database yet.\n\nLog in and open seed.html once to upload questions from data/quiz-questions.json to Firestore.');
    return;
  }
  currentMode = 'team';
  document.getElementById('team-name-input').value = '';
  showScreen('team-setup-screen');
});

document.getElementById('back-from-setup-btn').addEventListener('click', () => {
  showScreen('mode-selection-screen');
});

document.getElementById('create-team-btn').addEventListener('click', async () => {
  const name = document.getElementById('team-name-input').value.trim();
  if (!name) return alert('Please enter a team name.');
  if (name.length < 2) return alert('Team name must be at least 2 characters.');

  teamName = name;
  sessionId = `team_${Date.now()}_${currentUser.uid.slice(0, 6)}`;
  teamMembers = [{
    uid: currentUser.uid,
    email: currentUser.email,
    name: hostName(),
    photoURL: currentUser.photoURL,
    score: 0,
    isHost: true
  }];
  pendingInvites = [];

  try {
    await setDoc(doc(db, 'sessions', sessionId), {
      teamName,
      hostEmail: currentUser.email,
      hostUid: currentUser.uid,
      members: teamMembers,
      pendingInvites: [],
      createdAt: serverTimestamp(),
      status: 'lobby'
    });

    subscribeToSession();
    showTeamLobby();
  } catch (err) {
    console.warn(err);
    alert('Could not create team. Please try again.');
  }
});

function subscribeToSession() {
  if (sessionUnsubscribe) sessionUnsubscribe();
  sessionUnsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    teamName = data.teamName || teamName;
    teamMembers = data.members || [];
    pendingInvites = data.pendingInvites || [];
    renderTeamLobby();

    if (data.status === 'started') {
      showScreen('quiz-screen');
      startQuiz();
    }
  });
}

function showTeamLobby() {
  renderTeamLobby();
  showScreen('team-lobby-screen');
}

function renderTeamLobby() {
  document.getElementById('lobby-team-name').textContent = teamName;
  document.getElementById('lobby-team-title').textContent = teamName;

  const list = document.getElementById('member-list');
  list.innerHTML = '';
  teamMembers.forEach(member => {
    const div = document.createElement('div');
    div.className = 'member-item';
    const initial = (member.name || '?').charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="member-avatar">${initial}</div>
      <div class="member-name">${member.name}${member.email ? `<span style="display:block;font-size:.72rem;color:var(--muted);font-weight:500;">${member.email}</span>` : ''}</div>
      ${member.isHost ? '<span class="member-badge">Host</span>' : '<span class="member-badge" style="background:#e8e8e8;color:#111;">Joined</span>'}
    `;
    list.appendChild(div);
  });
  document.getElementById('member-count').textContent = teamMembers.length;

  const pendingList = document.getElementById('pending-list');
  const pendingEmpty = document.getElementById('pending-empty');
  pendingList.querySelectorAll('.pending-item').forEach(el => el.remove());

  if (!pendingInvites.length) {
    pendingEmpty.style.display = 'block';
  } else {
    pendingEmpty.style.display = 'none';
    pendingInvites.forEach(inv => {
      const div = document.createElement('div');
      div.className = 'pending-item';
      div.innerHTML = `
        <span>${inv.email}</span>
        <span class="status">${inv.status === 'accepted' ? 'Joined' : 'Email sent'}</span>
      `;
      pendingList.appendChild(div);
    });
  }
  document.getElementById('pending-count').textContent = pendingInvites.length;

  const slotsUsed = teamMembers.length + pendingInvites.filter(i => i.status !== 'accepted').length;
  const canInvite = slotsUsed < FOCUS_ROOM_MAX_TEAM;
  const inviteSection = document.getElementById('invite-section');
  const emailInput = document.getElementById('invite-email-input');
  const sendBtn = document.getElementById('send-invite-btn');

  inviteSection.style.display = canInvite ? 'block' : 'none';
  if (sendBtn) sendBtn.disabled = !canInvite;
  if (emailInput) emailInput.disabled = !canInvite;

  const isHost = teamMembers.some(m => m.uid === currentUser?.uid && m.isHost);
  document.getElementById('start-quiz-btn').style.display = isHost ? 'block' : 'none';
}

function startIndividualQuiz() {
  sessionId = 'individual_' + Date.now();
  teamMembers = [{
    uid: currentUser.uid,
    email: currentUser.email,
    name: hostName(),
    photoURL: currentUser.photoURL,
    score: 0,
    isHost: true
  }];
  showScreen('quiz-screen');
  startQuiz();
}

document.getElementById('send-invite-btn').addEventListener('click', async () => {
  const emailInput = document.getElementById('invite-email-input');
  const email = emailInput.value.trim();
  const btn = document.getElementById('send-invite-btn');

  if (!email) return alert('Please enter an email address.');
  if ((teamMembers.length + pendingInvites.length) >= FOCUS_ROOM_MAX_TEAM) {
    return alert('Team is full. Maximum 5 members including you.');
  }
  if (email.toLowerCase() === (currentUser.email || '').toLowerCase()) {
    return alert('You are already on the team as host.');
  }
  if (teamMembers.some(m => (m.email || '').toLowerCase() === email.toLowerCase())) {
    return alert('This person is already on the team.');
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const result = await sendTeamInviteRequest({
      sessionId,
      teamName,
      inviteeEmail: email,
      hostUid: currentUser.uid,
      hostName: hostName(),
      pendingInvites
    });

    pendingInvites = [
      ...pendingInvites,
      { email: result.email, inviteId: result.inviteId, status: 'pending', sentAt: Date.now() }
    ];

    await updateDoc(doc(db, 'sessions', sessionId), { pendingInvites });

    emailInput.value = '';
    alert(`Request sent! An email was sent to ${result.email} with a join link.`);
  } catch (err) {
    const msg = err.code === 'permission-denied'
      ? 'Permission denied. Deploy latest Firestore rules: firebase deploy --only firestore:rules'
      : (err.message || 'Could not send invite.');
    alert(msg);
    console.error('Send invite failed:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Request';
    renderTeamLobby();
  }
});

document.getElementById('back-to-mode-btn').addEventListener('click', () => {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }
  sessionId = null;
  showScreen('mode-selection-screen');
});

document.getElementById('start-quiz-btn').addEventListener('click', async () => {
  if (!teamMembers.some(m => m.uid === currentUser.uid && m.isHost)) {
    return alert('Only the host can start the quiz.');
  }
  await updateDoc(doc(db, 'sessions', sessionId), { status: 'started' });
});

function startQuiz() {
  currentQuestionIndex = 0;
  userScore = 0;
  correctCount = 0;
  renderParticipants();
  showQuestion();
}

function renderParticipants() {
  const bar = document.getElementById('participants-bar');
  bar.innerHTML = '';
  teamMembers.forEach(member => {
    const chip = document.createElement('div');
    chip.className = 'participant-chip';
    chip.innerHTML = `
      <div class="dot"></div>
      <span>${member.name.split(' ')[0]}</span>
      <span class="score">${member.score}</span>
    `;
    bar.appendChild(chip);
  });
}

function showQuestion() {
  const q = questions[currentQuestionIndex];
  document.getElementById('current-question-num').textContent = currentQuestionIndex + 1;
  document.getElementById('total-questions').textContent = questions.length;
  document.getElementById('q-num').textContent = currentQuestionIndex + 1;
  document.getElementById('question-text').textContent = q.question;

  const grid = document.getElementById('answers-grid');
  grid.innerHTML = '';
  q.answers.forEach((answer, idx) => {
    const div = document.createElement('div');
    div.className = 'answer-option';
    div.textContent = answer;
    div.addEventListener('click', () => selectAnswer(idx));
    grid.appendChild(div);
  });

  document.getElementById('next-question-btn').style.display = 'none';
  document.getElementById('finish-quiz-btn').style.display = 'none';
  startTimer();
}

function selectAnswer(selectedIdx) {
  clearInterval(timerInterval);
  const q = questions[currentQuestionIndex];
  const options = document.querySelectorAll('.answer-option');

  options.forEach((opt, idx) => {
    opt.style.pointerEvents = 'none';
    if (idx === q.correct) opt.classList.add('correct');
    else if (idx === selectedIdx) opt.classList.add('incorrect');
  });

  if (selectedIdx === q.correct) {
    userScore += 10;
    correctCount += 1;
    const member = teamMembers.find(m => m.uid === currentUser.uid);
    if (member) member.score = userScore;
    renderParticipants();
  }

  if (currentQuestionIndex < questions.length - 1) {
    document.getElementById('next-question-btn').style.display = 'block';
  } else {
    document.getElementById('finish-quiz-btn').style.display = 'block';
  }
}

function startTimer() {
  let time = 30;
  document.getElementById('quiz-timer').textContent = time;
  timerInterval = setInterval(() => {
    time--;
    document.getElementById('quiz-timer').textContent = time;
    if (time <= 0) {
      clearInterval(timerInterval);
      selectAnswer(-1);
    }
  }, 1000);
}

document.getElementById('next-question-btn').addEventListener('click', () => {
  currentQuestionIndex++;
  showQuestion();
});

document.getElementById('finish-quiz-btn').addEventListener('click', async () => {
  const userName = hostName();

  try {
    await saveQuizResult({
      uid: currentUser.uid,
      userName,
      mode: currentMode,
      sessionId,
      score: userScore,
      totalQuestions: questions.length,
      correctCount
    });

    if (currentMode === 'team' && sessionId) {
      const updatedMembers = teamMembers.map(m =>
        m.uid === currentUser.uid ? { ...m, score: userScore } : m
      );
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'finished',
        members: updatedMembers,
        teamName,
        finishedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('Could not save quiz result.', err);
  }

  alert(`Quiz completed! Your score: ${userScore}/${questions.length * 10}`);
  window.location.href = 'index.html#leaderboard';
});

function showScreen(screenId) {
  ['mode-selection-screen', 'team-setup-screen', 'team-lobby-screen', 'quiz-screen'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

initAuth();
