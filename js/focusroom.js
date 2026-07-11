import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
  import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

  const firebaseConfig = {
    apiKey: "AIzaSyC0SlrLGv9luVqaogkW4lpYL3mwIxxvSdA",
    authDomain: "learnloop-f89c2.firebaseapp.com",
    projectId: "learnloop-f89c2",
    storageBucket: "learnloop-f89c2.firebasestorage.app",
    messagingSenderId: "777914976314",
    appId: "1:777914976314:web:2cd051169684c24caf8d03"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let currentUser = null;
  let sessionId = null;
  let currentMode = null;
  let teamMembers = [];
  let currentQuestionIndex = 0;
  let userScore = 0;
  let timerInterval = null;

  // Sample questions
  const questions = [
    {
      question: "What is the capital of France?",
      answers: ["London", "Berlin", "Paris", "Madrid"],
      correct: 2
    },
    {
      question: "Which planet is known as the Red Planet?",
      answers: ["Venus", "Mars", "Jupiter", "Saturn"],
      correct: 1
    },
    {
      question: "What is 15 × 8?",
      answers: ["120", "125", "115", "130"],
      correct: 0
    },
    {
      question: "Who wrote 'Romeo and Juliet'?",
      answers: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
      correct: 1
    },
    {
      question: "What is the largest ocean on Earth?",
      answers: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
      correct: 3
    }
  ];

  // Theme (user choice only, defaults to light)
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

  // Auth check
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    const photoURL = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email)}&backgroundColor=111111&textColor=ffffff`;
    document.getElementById('nav-avatar').src = photoURL;
    document.getElementById('nav-username').textContent = user.displayName ? user.displayName.split(' ')[0] : 'Profile';
  });

  // Mode selection
  document.getElementById('individual-mode-btn').addEventListener('click', () => {
    currentMode = 'individual';
    startIndividualQuiz();
  });

  document.getElementById('team-mode-btn').addEventListener('click', () => {
    currentMode = 'team';
    showTeamLobby();
  });

  function startIndividualQuiz() {
    sessionId = 'individual_' + Date.now();
    teamMembers = [{
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
      email: currentUser.email,
      name: currentUser.displayName || currentUser.email,
      photoURL: currentUser.photoURL,
      score: 0,
      isHost: true
    }];
    renderMemberList();
    showScreen('team-lobby-screen');

    // Create Firestore session
    setDoc(doc(db, 'sessions', sessionId), {
      hostEmail: currentUser.email,
      members: teamMembers,
      createdAt: serverTimestamp(),
      status: 'lobby'
    });

    // Listen for new members
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

    // In a real app, you'd send an actual invite. For now, simulate adding them
    const newMember = {
      email: email,
      name: email.split('@')[0],
      photoURL: null,
      score: 0,
      isHost: false
    };
    teamMembers.push(newMember);
    
    await updateDoc(doc(db, 'sessions', sessionId), {
      members: teamMembers
    });

    document.getElementById('invite-email-input').value = '';
    alert(`Invite sent to ${email}!`);
  });

  document.getElementById('back-to-mode-btn').addEventListener('click', () => {
    showScreen('mode-selection-screen');
  });

  document.getElementById('start-quiz-btn').addEventListener('click', async () => {
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'started'
    });
  });

  function startQuiz() {
    currentQuestionIndex = 0;
    userScore = 0;
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
      if (idx === q.correct) {
        opt.classList.add('correct');
      } else if (idx === selectedIdx) {
        opt.classList.add('incorrect');
      }
    });

    if (selectedIdx === q.correct) {
      userScore += 10;
      teamMembers.find(m => m.email === currentUser.email).score = userScore;
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
        selectAnswer(-1); // Auto-submit with wrong answer
      }
    }, 1000);
  }

  document.getElementById('next-question-btn').addEventListener('click', () => {
    currentQuestionIndex++;
    showQuestion();
  });

  document.getElementById('finish-quiz-btn').addEventListener('click', () => {
    alert(`Quiz completed! Your score: ${userScore}/${questions.length * 10}`);
    window.location.href = 'index.html';
  });

  function showScreen(screenId) {
    document.getElementById('mode-selection-screen').classList.add('hidden');
    document.getElementById('team-lobby-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
  }
