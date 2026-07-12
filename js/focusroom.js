// Focus room quiz

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  auth,
  db,
  getQuizQuestions,
  saveQuizResult,
  joinTeamSession,
  FOCUS_ROOM_MAX_TEAM,
  buildTeamJoinUrl
} from './firebase.js';

// Page state
let currentUser = null;
let sessionId = null;
let sessionUnsubscribe = null;
let currentMode = null;
let teamName = '';
let teamMembers = [];
let questions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let correctCount = 0;
let timerInterval = null;

// Theme
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('ll_theme');
const isDarkTheme = savedTheme === 'dark';
document.body.classList.toggle('dark', isDarkTheme);
if (themeToggle) {
  themeToggle.textContent = isDarkTheme ? 'Light' : 'Dark';
}

themeToggle?.addEventListener('click', function () {
  const isDark = document.body.classList.toggle('dark');
  themeToggle.textContent = isDark ? 'Light' : 'Dark';
  localStorage.setItem('ll_theme', isDark ? 'dark' : 'light');
});

function setNavAvatarInitial(name) {
  const el = document.getElementById('nav-avatar');
  if (el) {
    el.textContent = String(name || 'U').charAt(0).toUpperCase();
  }
}

function hostName() {
  if (currentUser.displayName) return currentUser.displayName;
  if (currentUser.email) return currentUser.email.split('@')[0];
  return 'Host';
}

function showScreen(screenId) {
  const screenIds = ['mode-selection-screen', 'team-setup-screen', 'team-lobby-screen', 'quiz-screen'];
  for (let i = 0; i < screenIds.length; i++) {
    document.getElementById(screenIds[i]).classList.add('hidden');
  }
  document.getElementById(screenId).classList.remove('hidden');
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

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  return Promise.resolve();
}

async function initAuth() {
  await auth.authStateReady();

  onAuthStateChanged(auth, async function (user) {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    currentUser = user;

    setNavAvatarInitial(user.displayName || user.email || 'User');

    if (user.displayName) {
      document.getElementById('nav-username').textContent = user.displayName.split(' ')[0];
    } else {
      document.getElementById('nav-username').textContent = 'Profile';
    }

    try {
      await loadQuestionsFromDatabase();
    } catch (err) {
      console.warn('Could not load quiz questions from Firestore.', err);
    }

    await handleJoinFromUrl();
  });
}

// Join from shared link
async function handleJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const joinSession = params.get('join');
  if (!joinSession) return;

  try {
    currentMode = 'team';
    sessionId = joinSession;

    const session = await joinTeamSession({
      sessionId: joinSession,
      user: currentUser
    });

    teamName = session.teamName || 'Team';
    teamMembers = session.members || [];

    window.history.replaceState({}, '', 'focusroom.html');
    subscribeToSession();
    showScreen('team-lobby-screen');
    alert('You joined "' + teamName + '"! Waiting for the host to start the quiz.');
  } catch (err) {
    alert(err.message || 'Could not join team.');
    window.history.replaceState({}, '', 'focusroom.html');
  }
}

// Mode buttons
document.getElementById('individual-mode-btn').addEventListener('click', async function () {
  await loadQuestionsFromDatabase();

  if (questions.length === 0) {
    alert('No quiz questions in the database yet.\n\nAsk your admin to add questions in Firebase Console (quizSets → default).');
    return;
  }

  currentMode = 'individual';
  startIndividualQuiz();
});

document.getElementById('team-mode-btn').addEventListener('click', async function () {
  await loadQuestionsFromDatabase();

  if (questions.length === 0) {
    alert('No quiz questions in the database yet.\n\nAsk your admin to add questions in Firebase Console (quizSets → default).');
    return;
  }

  currentMode = 'team';
  document.getElementById('team-name-input').value = '';
  showScreen('team-setup-screen');
});

document.getElementById('back-from-setup-btn').addEventListener('click', function () {
  showScreen('mode-selection-screen');
});

// Create team
document.getElementById('create-team-btn').addEventListener('click', async function () {
  const name = document.getElementById('team-name-input').value.trim();

  if (!name) {
    alert('Please enter a team name.');
    return;
  }
  if (name.length < 2) {
    alert('Team name must be at least 2 characters.');
    return;
  }

  teamName = name;
  sessionId = 'team_' + Date.now() + '_' + currentUser.uid.slice(0, 6);

  teamMembers = [{
    uid: currentUser.uid,
    email: currentUser.email,
    name: hostName(),
    photoURL: currentUser.photoURL,
    score: 0,
    isHost: true
  }];

  try {
    await setDoc(doc(db, 'sessions', sessionId), {
      teamName: teamName,
      hostEmail: currentUser.email,
      hostUid: currentUser.uid,
      members: teamMembers,
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

// Live session updates
function subscribeToSession() {
  if (sessionUnsubscribe) sessionUnsubscribe();

  sessionUnsubscribe = onSnapshot(doc(db, 'sessions', sessionId), function (docSnap) {
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    teamName = data.teamName || teamName;
    teamMembers = data.members || [];
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

// Render lobby
function renderTeamLobby() {
  document.getElementById('lobby-team-name').textContent = teamName;
  document.getElementById('lobby-team-title').textContent = teamName;

  const list = document.getElementById('member-list');
  list.innerHTML = '';

  for (let i = 0; i < teamMembers.length; i++) {
    const member = teamMembers[i];
    const div = document.createElement('div');
    div.className = 'member-item';

    const initial = (member.name || '?').charAt(0).toUpperCase();
    const emailHtml = member.email
      ? '<span style="display:block;font-size:.72rem;color:var(--muted);font-weight:500;">' + member.email + '</span>'
      : '';
    const badgeHtml = member.isHost
      ? '<span class="member-badge">Host</span>'
      : '<span class="member-badge" style="background:#e8e8e8;color:#111;">Joined</span>';

    div.innerHTML = `
      <div class="member-avatar">${initial}</div>
      <div class="member-name">${member.name}${emailHtml}</div>
      ${badgeHtml}
    `;
    list.appendChild(div);
  }

  document.getElementById('member-count').textContent = teamMembers.length;

  const joinUrlInput = document.getElementById('team-join-url');
  if (joinUrlInput && sessionId) {
    joinUrlInput.value = buildTeamJoinUrl(sessionId);
  }

  let isHost = false;
  for (let m = 0; m < teamMembers.length; m++) {
    if (teamMembers[m].uid === currentUser.uid && teamMembers[m].isHost) {
      isHost = true;
      break;
    }
  }

  document.getElementById('start-quiz-btn').style.display = isHost ? 'block' : 'none';

  const shareSection = document.getElementById('share-link-section');
  if (shareSection) {
    shareSection.style.display = isHost ? 'block' : 'none';
  }
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

document.getElementById('copy-join-link-btn').addEventListener('click', async function () {
  const btn = document.getElementById('copy-join-link-btn');
  const url = document.getElementById('team-join-url').value;
  if (!url) return;

  try {
    await copyText(url);
    btn.textContent = 'Copied!';
    setTimeout(function () { btn.textContent = 'Copy link'; }, 2000);
  } catch (err) {
    alert('Copy this link:\n\n' + url);
  }
});

document.getElementById('back-to-mode-btn').addEventListener('click', function () {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }
  sessionId = null;
  showScreen('mode-selection-screen');
});

document.getElementById('start-quiz-btn').addEventListener('click', async function () {
  let isHost = false;
  for (let i = 0; i < teamMembers.length; i++) {
    if (teamMembers[i].uid === currentUser.uid && teamMembers[i].isHost) {
      isHost = true;
      break;
    }
  }

  if (!isHost) {
    alert('Only the host can start the quiz.');
    return;
  }

  await updateDoc(doc(db, 'sessions', sessionId), { status: 'started' });
});

// Quiz
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

  for (let i = 0; i < teamMembers.length; i++) {
    const member = teamMembers[i];
    const chip = document.createElement('div');
    chip.className = 'participant-chip';
    chip.innerHTML = `
      <div class="dot"></div>
      <span>${member.name.split(' ')[0]}</span>
      <span class="score">${member.score}</span>
    `;
    bar.appendChild(chip);
  }
}

function showQuestion() {
  const q = questions[currentQuestionIndex];

  document.getElementById('current-question-num').textContent = currentQuestionIndex + 1;
  document.getElementById('total-questions').textContent = questions.length;
  document.getElementById('q-num').textContent = currentQuestionIndex + 1;
  document.getElementById('question-text').textContent = q.question;

  const grid = document.getElementById('answers-grid');
  grid.innerHTML = '';

  for (let i = 0; i < q.answers.length; i++) {
    const answer = q.answers[i];
    const div = document.createElement('div');
    div.className = 'answer-option';
    div.textContent = answer;

    div.addEventListener('click', function () {
      selectAnswer(i);
    });

    grid.appendChild(div);
  }

  document.getElementById('next-question-btn').classList.add('hidden');
  document.getElementById('finish-quiz-btn').classList.add('hidden');
  startTimer();
}

function selectAnswer(selectedIdx) {
  clearInterval(timerInterval);

  const q = questions[currentQuestionIndex];
  const options = document.querySelectorAll('.answer-option');

  for (let i = 0; i < options.length; i++) {
    options[i].style.pointerEvents = 'none';
    if (i === q.correct) options[i].classList.add('correct');
    else if (i === selectedIdx) options[i].classList.add('incorrect');
  }

  if (selectedIdx === q.correct) {
    userScore += 10;
    correctCount += 1;

    for (let j = 0; j < teamMembers.length; j++) {
      if (teamMembers[j].uid === currentUser.uid) {
        teamMembers[j].score = userScore;
        break;
      }
    }

    renderParticipants();
  }

  if (currentQuestionIndex < questions.length - 1) {
    document.getElementById('next-question-btn').classList.remove('hidden');
  } else {
    document.getElementById('finish-quiz-btn').classList.remove('hidden');
  }
}

function startTimer() {
  let time = 30;
  document.getElementById('quiz-timer').textContent = time;

  timerInterval = setInterval(function () {
    time--;
    document.getElementById('quiz-timer').textContent = time;

    if (time <= 0) {
      clearInterval(timerInterval);
      selectAnswer(-1);
    }
  }, 1000);
}

document.getElementById('next-question-btn').addEventListener('click', function () {
  currentQuestionIndex++;
  showQuestion();
});

document.getElementById('finish-quiz-btn').addEventListener('click', async function () {
  const userName = hostName();

  try {
    await saveQuizResult({
      uid: currentUser.uid,
      userName: userName,
      mode: currentMode,
      sessionId: sessionId,
      score: userScore,
      totalQuestions: questions.length,
      correctCount: correctCount
    });

    if (currentMode === 'team' && sessionId) {
      const updatedMembers = [];
      for (let i = 0; i < teamMembers.length; i++) {
        if (teamMembers[i].uid === currentUser.uid) {
          updatedMembers.push({
            uid: teamMembers[i].uid,
            email: teamMembers[i].email,
            name: teamMembers[i].name,
            photoURL: teamMembers[i].photoURL,
            score: userScore,
            isHost: teamMembers[i].isHost
          });
        } else {
          updatedMembers.push(teamMembers[i]);
        }
      }

      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'finished',
        members: updatedMembers,
        teamName: teamName,
        finishedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('Could not save quiz result.', err);
  }

  alert('Quiz completed! Your score: ' + userScore + '/' + (questions.length * 10));
  window.location.href = 'index.html#leaderboard';
});

initAuth();
