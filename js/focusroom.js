import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  auth,
  db,
  getQuizQuestions,
  saveQuizResult,
  lookupUserByEmail,
  addNotification
} from './firebase.js';

let currentUser = null;
let sessionId = null;
let currentMode = null;
let teamMembers = [];
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
      questions = await getQuizQuestions();
    } catch (err) {
      console.warn('Could not load quiz questions from Firestore.', err);
      questions = [];
    }
  });
}

document.getElementById('individual-mode-btn').addEventListener('click', () => {
  if (!questions.length) {
    alert('Quiz questions are not set up yet. Ask the admin to run: npm run firebase:seed');
    return;
  }
  currentMode = 'individual';
  startIndividualQuiz();
});

document.getElementById('team-mode-btn').addEventListener('click', () => {
  if (!questions.length) {
    alert('Quiz questions are not set up yet. Ask the admin to run: npm run firebase:seed');
    return;
  }
  currentMode = 'team';
  showTeamLobby();
});

function startIndividualQuiz() {
  sessionId = 'individual_' + Date.now();
  teamMembers = [{
    uid: currentUser.uid,
    email: currentUser.email,
    name: currentUser.displayName || currentUser.email,
    photoURL: currentUser.photoURL,
    score: 0,
    isHost: true
  }];
  showScreen('quiz-screen');
  startQuiz();
}

function showTeamLobby() {
  sessionId = 'team_' + Date.now();
  teamMembers = [{
    uid: currentUser.uid,
    email: currentUser.email,
    name: currentUser.displayName || currentUser.email,
    photoURL: currentUser.photoURL,
    score: 0,
    isHost: true
  }];
  renderMemberList();
  showScreen('team-lobby-screen');

  setDoc(doc(db, 'sessions', sessionId), {
    hostEmail: currentUser.email,
    hostUid: currentUser.uid,
    members: teamMembers,
    createdAt: serverTimestamp(),
    status: 'lobby'
  });

  onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      teamMembers = data.members || [];
      renderMemberList();
      if (data.status === 'started') {
        showScreen('quiz-screen');
        startQuiz();
      }
    }
  });
}

function renderMemberList() {
  const list = document.getElementById('member-list');
  list.innerHTML = '';
  teamMembers.forEach(member => {
    const div = document.createElement('div');
    div.className = 'member-item';
    const initial = member.name.charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="member-avatar">${initial}</div>
      <div class="member-name">${member.name}</div>
      ${member.isHost ? '<span class="member-badge">Host</span>' : ''}
    `;
    list.appendChild(div);
  });
  document.getElementById('member-count').textContent = teamMembers.length;
}

document.getElementById('send-invite-btn').addEventListener('click', async () => {
  const email = document.getElementById('invite-email-input').value.trim();
  if (!email) return alert('Please enter an email');
  if (teamMembers.length >= 5) return alert('Maximum 5 members allowed');
  if (teamMembers.find(m => m.email === email)) return alert('User already in team');

  const found = await lookupUserByEmail(email);
  if (!found) return alert('No LearnLoop user found with that email.');

  const newMember = {
    uid: found.uid,
    email: found.email,
    name: found.userName || email.split('@')[0],
    photoURL: found.photoURL || null,
    score: 0,
    isHost: false
  };
  teamMembers.push(newMember);

  await updateDoc(doc(db, 'sessions', sessionId), { members: teamMembers });

  await addNotification(found.uid, {
    icon: '👥',
    color: 'blue',
    title: `${currentUser.displayName || 'Someone'} invited you to a team focus room.`,
    type: 'invite',
    read: false
  });

  document.getElementById('invite-email-input').value = '';
  alert(`Invite sent to ${email}!`);
});

document.getElementById('back-to-mode-btn').addEventListener('click', () => {
  showScreen('mode-selection-screen');
});

document.getElementById('start-quiz-btn').addEventListener('click', async () => {
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
    const member = teamMembers.find(m => m.email === currentUser.email);
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
  const userName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner';

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
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'finished',
        members: teamMembers,
        teamName: `Team ${userName}`,
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
  document.getElementById('mode-selection-screen').classList.add('hidden');
  document.getElementById('team-lobby-screen').classList.add('hidden');
  document.getElementById('quiz-screen').classList.add('hidden');
  document.getElementById(screenId).classList.remove('hidden');
}

initAuth();
