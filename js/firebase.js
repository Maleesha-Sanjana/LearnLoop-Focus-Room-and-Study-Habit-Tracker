import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyC0SlrLGv9luVqaogkW4lpYL3mwIxxvSdA',
  authDomain: 'learnloop-f89c2.firebaseapp.com',
  projectId: 'learnloop-f89c2',
  storageBucket: 'learnloop-f89c2.firebasestorage.app',
  messagingSenderId: '777914976314',
  appId: '1:777914976314:web:2cd051169684c24caf8d03',
  measurementId: 'G-3SBVP21TE7'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const SUBJECTS_POOL = ['Java', 'React', 'Database', 'Networking', 'Algorithms', 'Machine Learning', 'System Design'];
export const PRESET_AVATARS = ['Aisha', 'David', 'Emma', 'Sarah', 'Caleb', 'Maya'];

export const BADGE_DEFINITIONS = [
  { id: 'streak-badge', title: '7 Day Streak', icon: '🔥', threshold: 7, metric: 'streak' },
  { id: 'goal-badge', title: 'Goal Master', icon: '🎯', threshold: 20, metric: 'goalsCompleted' },
  { id: 'hours-badge', title: '100 Study Hours', icon: '📚', threshold: 100, metric: 'hours' },
  { id: 'team-badge', title: 'Reputation Pro', icon: '✨', threshold: 500, metric: 'reputation' },
  { id: 'notes-badge', title: 'Contributor Portfolio', icon: '📝', threshold: 3, metric: 'resourcesCount' },
  { id: 'focus-badge', title: 'Focus Champion', icon: '⚡', threshold: 95, metric: 'focusScore' }
];

export function learnerSettingsRef(uid) {
  return doc(db, 'users', uid, 'profileData', 'learnerSettings');
}

export function userDocRef(uid) {
  return doc(db, 'users', uid);
}

export function goalsCol(uid) {
  return collection(db, 'users', uid, 'goals');
}

export function activitiesCol(uid) {
  return collection(db, 'users', uid, 'activities');
}

export function resourcesCol(uid) {
  return collection(db, 'users', uid, 'resources');
}

export function achievementsCol(uid) {
  return collection(db, 'users', uid, 'achievements');
}

export function notificationsCol(uid) {
  return collection(db, 'users', uid, 'notifications');
}

export function chatMessagesCol(chatId) {
  return collection(db, 'chats', chatId, 'messages');
}

export function formatTimeAgo(date) {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return d.toLocaleDateString();
}

export function chatIdFor(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export function defaultProfile(user) {
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
    questions: 0,
    availWeekdays: true,
    availWeekends: true,
    matchmakerSearchSubjects: ['Database', 'React'],
    companionAlerts: true,
    publicMatchmaking: true
  };
}

export async function loadAppConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'app'));
    if (snap.exists()) {
      const d = snap.data();
      return {
        subjects: d.subjects?.length ? d.subjects : SUBJECTS_POOL,
        avatars: d.avatars?.length ? d.avatars : PRESET_AVATARS,
        badges: d.badgeDefinitions?.length ? d.badgeDefinitions : BADGE_DEFINITIONS
      };
    }
  } catch (err) {
    console.warn('Could not load app config from Firestore.', err);
  }
  return { subjects: SUBJECTS_POOL, avatars: PRESET_AVATARS, badges: BADGE_DEFINITIONS };
}

export async function saveMatchmakerPreferences(uid, prefs) {
  await saveLearnerSettings(uid, prefs);
}

export function subscribeGoals(uid, callback) {
  return onSnapshot(goalsCol(uid), snap => {
    callback(snap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      progress: d.data().progress ?? 0,
      status: d.data().status ?? 'active'
    })));
  });
}

export function subscribeActivities(uid, callback, max = 20) {
  const q = query(activitiesCol(uid), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: d.id,
      text: d.data().text,
      time: formatTimeAgo(d.data().createdAt)
    })));
  });
}

export function subscribeResources(uid, callback) {
  const q = query(resourcesCol(uid), orderBy('uploadedAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name, size: data.size, scope: data.scope, url: data.url || null };
    }));
  });
}

export function subscribeAchievements(uid, callback) {
  return onSnapshot(achievementsCol(uid), snap => {
    callback(new Set(snap.docs.map(d => d.id)));
  });
}

export function subscribeLearnerSettings(uid, callback) {
  return onSnapshot(learnerSettingsRef(uid), snap => {
    callback(snap.exists() ? snap.data() : defaultProfile(null));
  });
}

export async function getLearnerSettings(uid) {
  const snap = await getDoc(learnerSettingsRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveLearnerSettings(uid, data) {
  await setDoc(learnerSettingsRef(uid), data, { merge: true });
}

export async function logActivity(uid, text, type = 'general') {
  await addDoc(activitiesCol(uid), { text, type, createdAt: serverTimestamp() });
}

export async function loadActivities(uid, max = 20) {
  const q = query(activitiesCol(uid), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    text: d.data().text,
    time: formatTimeAgo(d.data().createdAt)
  }));
}

export async function loadGoals(uid) {
  const snap = await getDocs(goalsCol(uid));
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name,
    progress: d.data().progress ?? 0,
    status: d.data().status ?? 'active'
  }));
}

export async function createGoal(uid, name, progress = 0) {
  const ref = await addDoc(goalsCol(uid), {
    name,
    progress,
    status: 'active',
    createdAt: serverTimestamp()
  });
  await logActivity(uid, `Created goal: '${name}'`, 'goal');
  return ref.id;
}

export async function updateGoal(uid, goalId, data) {
  await updateDoc(doc(db, 'users', uid, 'goals', goalId), data);
}

export async function completeGoal(uid, goalId, goalName) {
  await updateGoal(uid, goalId, { progress: 100, status: 'completed' });
  const settings = (await getDoc(learnerSettingsRef(uid))).data() || defaultProfile(null);
  const goalsCompleted = (settings.goalsCompleted || 0) + 1;
  await saveLearnerSettings(uid, { goalsCompleted });
  await logActivity(uid, `Completed learning target: '${goalName}'`, 'goal');
  await incrementPlatformStats('goalsCompletedCount');
  return goalsCompleted;
}

export async function uploadResourceFile(uid, file) {
  const path = `users/${uid}/resources/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function loadResources(uid) {
  const snap = await getDocs(query(resourcesCol(uid), orderBy('uploadedAt', 'desc')));
  return snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, name: data.name, size: data.size, scope: data.scope, url: data.url || null };
  });
}

export async function addResource(uid, { name, size, scope, url }) {
  await addDoc(resourcesCol(uid), {
    name,
    size,
    scope,
    url: url || null,
    uploadedAt: serverTimestamp()
  });
  await logActivity(uid, `Shared resource: '${name}'`, 'resource');
}

export async function removeResource(uid, resourceId) {
  const ref = doc(db, 'users', uid, 'resources', resourceId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    await logActivity(uid, `Removed resource: '${snap.data().name}'`, 'resource');
  }
}

export async function loadUnlockedAchievements(uid) {
  const snap = await getDocs(achievementsCol(uid));
  return new Set(snap.docs.map(d => d.id));
}

export async function unlockAchievement(uid, badgeId, title) {
  await setDoc(doc(db, 'users', uid, 'achievements', badgeId), {
    badgeId,
    title,
    unlockedAt: serverTimestamp()
  }, { merge: true });
  await logActivity(uid, `Earned achievement: '${title}'`, 'achievement');
  await addNotification(uid, {
    icon: '🏅',
    color: 'yellow',
    title: `Achievement unlocked: ${title}`,
    type: 'achievement',
    read: false
  });
}

export async function addNotification(uid, { icon, color, title, type, read = false }) {
  await addDoc(notificationsCol(uid), {
    icon: icon || '🔔',
    color: color || 'blue',
    title,
    type: type || 'general',
    read,
    createdAt: serverTimestamp()
  });
}

export async function loadNotifications(uid, max = 20) {
  const q = query(notificationsCol(uid), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    time: formatTimeAgo(d.data().createdAt)
  }));
}

export function subscribeNotifications(uid, callback, max = 20) {
  const q = query(notificationsCol(uid), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      time: formatTimeAgo(d.data().createdAt)
    })));
  });
}

export async function markNotificationRead(uid, notifId) {
  await updateDoc(doc(db, 'users', uid, 'notifications', notifId), { read: true });
}

export async function markAllNotificationsRead(uid) {
  const snap = await getDocs(notificationsCol(uid));
  await Promise.all(
    snap.docs.filter(d => !d.data().read).map(d => updateDoc(d.ref, { read: true }))
  );
}

export async function findStudyBuddies(currentUid, searchSubjects = []) {
  const usersSnap = await getDocs(collection(db, 'users'));
  const buddies = [];

  for (const userDoc of usersSnap.docs) {
    if (userDoc.id === currentUid) continue;
    const base = userDoc.data();
    const settingsSnap = await getDoc(learnerSettingsRef(userDoc.id));
    const profile = settingsSnap.exists() ? settingsSnap.data() : {};
    if (profile.publicMatchmaking === false) continue;

    const subjects = profile.subjects || [];
    if (searchSubjects.length && !subjects.some(s => searchSubjects.includes(s))) continue;

    const name = profile.name || base.userName || base.email?.split('@')[0] || 'Learner';
    buddies.push({
      uid: userDoc.id,
      name,
      subjects,
      avatar: (name.charAt(0) || 'U').toUpperCase(),
      status: 'Available',
      desc: profile.bio || 'Looking for study partners.',
      email: base.email || ''
    });
  }
  return buddies;
}

export async function getQuizQuestions() {
  const snap = await getDoc(doc(db, 'quizSets', 'default'));
  if (!snap.exists()) return [];
  return snap.data().questions || [];
}

export async function saveQuizResult({ uid, userName, mode, sessionId, score, totalQuestions, correctCount }) {
  const avgPercent = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  await addDoc(collection(db, 'quizResults'), {
    uid,
    userName,
    mode,
    sessionId,
    score,
    totalQuestions,
    correctCount,
    avgPercent,
    completedAt: serverTimestamp()
  });

  const settings = (await getDoc(learnerSettingsRef(uid))).data() || defaultProfile(null);
  await saveLearnerSettings(uid, {
    reputation: (settings.reputation || 0) + score,
    quizzes: (settings.quizzes || 0) + 1,
    questions: (settings.questions || 0) + totalQuestions,
    focusScore: avgPercent
  });

  await logActivity(uid, `Completed ${mode} quiz — ${avgPercent}% (${score} pts)`, 'quiz');
  await addNotification(uid, {
    icon: '🏆',
    color: 'purple',
    title: `Quiz complete! You scored ${avgPercent}% (${score} pts).`,
    type: 'quiz',
    read: false
  });
  await incrementPlatformStats('sessionCount');
}

export async function lookupUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const d of usersSnap.docs) {
    if ((d.data().email || '').toLowerCase() === normalized) {
      return { uid: d.id, ...d.data() };
    }
  }
  return null;
}

export async function getIndividualLeaderboard(max = 10) {
  const snap = await getDocs(collection(db, 'quizResults'));
  const byUser = new Map();

  snap.docs.forEach(d => {
    const r = d.data();
    const key = r.uid;
    if (!key) return;
    const cur = byUser.get(key) || { uid: key, name: r.userName || 'Learner', score: 0, quizzes: 0, totalPercent: 0 };
    cur.score += r.score || 0;
    cur.quizzes += 1;
    cur.totalPercent += r.avgPercent || 0;
    cur.name = r.userName || cur.name;
    byUser.set(key, cur);
  });

  return [...byUser.values()]
    .map(u => ({ ...u, avg: u.quizzes ? Math.round(u.totalPercent / u.quizzes) : 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

export async function getTeamLeaderboard(max = 10) {
  const snap = await getDocs(collection(db, 'sessions'));
  const teams = [];

  snap.docs.forEach(d => {
    const s = d.data();
    if (s.status !== 'finished' || !s.members?.length) return;
    teams.push({
      name: s.teamName || `Team ${s.hostEmail?.split('@')[0] || 'Session'}`,
      score: s.members.reduce((sum, m) => sum + (m.score || 0), 0),
      members: s.members.length,
      sessions: 1
    });
  });

  return teams.sort((a, b) => b.score - a.score).slice(0, max);
}

export async function getPlatformStats() {
  const ref = doc(db, 'platformStats', 'global');
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const usersSnap = await getDocs(collection(db, 'users'));
  let goalsCompleted = 0;
  let sessionCount = 0;

  for (const u of usersSnap.docs) {
    const settings = await getDoc(learnerSettingsRef(u.id));
    if (settings.exists()) {
      goalsCompleted += settings.data().goalsCompleted || 0;
      sessionCount += settings.data().sessions || 0;
    }
  }

  const stats = { studentCount: usersSnap.size, sessionCount, goalsCompletedCount: goalsCompleted };
  await setDoc(ref, { ...stats, updatedAt: serverTimestamp() });
  return stats;
}

export async function incrementPlatformStats(field) {
  const ref = doc(db, 'platformStats', 'global');
  const snap = await getDoc(ref);
  if (!snap.exists()) await getPlatformStats();
  await updateDoc(ref, { [field]: increment(1), updatedAt: serverTimestamp() });
}

export async function loadTestimonials() {
  const snap = await getDocs(collection(db, 'testimonials'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeChatMessages(chatId, callback) {
  const q = query(chatMessagesCol(chatId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function sendChatMessage(chatId, senderUid, senderName, text) {
  await setDoc(doc(db, 'chats', chatId), { updatedAt: serverTimestamp() }, { merge: true });
  await addDoc(chatMessagesCol(chatId), {
    senderUid,
    senderName,
    text,
    createdAt: serverTimestamp()
  });
}

export async function logStudySession(uid, hoursAdded = 2) {
  const settings = (await getDoc(learnerSettingsRef(uid))).data() || defaultProfile(null);
  const hours = (settings.hours || 0) + hoursAdded;
  const sessions = (settings.sessions || 0) + 1;
  const reputation = (settings.reputation || 0) + 25;
  const streak = (settings.streak || 0) + 1;
  await saveLearnerSettings(uid, {
    hours,
    sessions,
    reputation,
    streak,
    todayProgress: `${hoursAdded}h logged`
  });
  await logActivity(uid, `Logged ${hoursAdded} hour study session`, 'session');
  await incrementPlatformStats('sessionCount');
  return { hours, sessions, reputation, streak };
}

export async function upsertUserRecord(user, userName) {
  await setDoc(userDocRef(user.uid), {
    userName: userName || user.displayName || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    phoneNumber: user.phoneNumber || null,
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const settingsSnap = await getDoc(learnerSettingsRef(user.uid));
  if (!settingsSnap.exists()) {
    await setDoc(learnerSettingsRef(user.uid), defaultProfile(user), { merge: true });
    await incrementPlatformStats('studentCount');
  }
}

export async function saveUserProfileOnSignup(user, userName) {
  await upsertUserRecord(user, userName);
}

export const FOCUS_ROOM_MAX_TEAM = 5;

export function buildFocusRoomJoinUrl(sessionId, inviteId) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://learnloop-f89c2.web.app';
  return `${base}/focusroom.html?join=${encodeURIComponent(sessionId)}&invite=${encodeURIComponent(inviteId)}`;
}

export async function queueTeamInviteEmail({ to, teamName, hostName, joinUrl }) {
  await addDoc(collection(db, 'mail'), {
    to: [to.trim().toLowerCase()],
    message: {
      subject: `You're invited to join ${teamName} on LearnLoop`,
      text: `${hostName} invited you to join the team "${teamName}" for a Focus Room quiz on LearnLoop.\n\nOpen this link to join: ${joinUrl}\n\nTeam size is limited to 5 players.`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
          <h2 style="margin:0 0 12px;">You're invited to a team quiz 🎯</h2>
          <p><strong>${hostName}</strong> invited you to join <strong>${teamName}</strong> on LearnLoop Focus Room.</p>
          <p>Click below to join the team lobby (5 players max):</p>
          <p><a href="${joinUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;">Join Team Game</a></p>
          <p style="font-size:12px;color:#666;">If the button does not work, copy this link:<br/>${joinUrl}</p>
        </div>
      `
    },
    createdAt: serverTimestamp()
  });
}

export async function sendTeamInviteRequest({
  sessionId,
  teamName,
  inviteeEmail,
  hostUid,
  hostName,
  pendingInvites = []
}) {
  const email = inviteeEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }

  const alreadyPending = pendingInvites.some(i => (i.email || '').toLowerCase() === email);
  if (alreadyPending) {
    throw new Error('An invite was already sent to this email.');
  }

  const inviteRef = doc(collection(db, 'teamInvites'));
  const joinUrl = buildFocusRoomJoinUrl(sessionId, inviteRef.id);

  await setDoc(inviteRef, {
    sessionId,
    teamName,
    inviteeEmail: email,
    hostUid,
    hostName,
    status: 'pending',
    joinUrl,
    createdAt: serverTimestamp()
  });

  try {
    await queueTeamInviteEmail({ to: email, teamName, hostName, joinUrl });
  } catch (err) {
    console.warn('Email queue failed (invite link still created):', err);
  }

  return { inviteId: inviteRef.id, email, joinUrl };
}

export async function acceptTeamInvite({ inviteId, sessionId, user }) {
  const inviteRef = doc(db, 'teamInvites', inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error('Invite not found or expired.');
  const invite = inviteSnap.data();

  if (invite.sessionId !== sessionId) throw new Error('Invalid invite link.');
  if (invite.status === 'accepted') throw new Error('This invite was already accepted.');
  if (invite.status !== 'pending') throw new Error('This invite is no longer valid.');

  const userEmail = (user.email || '').toLowerCase();
  if (userEmail !== (invite.inviteeEmail || '').toLowerCase()) {
    throw new Error(`Please sign in with ${invite.inviteeEmail} to join this team.`);
  }

  const sessionRef = doc(db, 'sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error('Team session not found.');
  const session = sessionSnap.data();

  if (session.status !== 'lobby') throw new Error('This team game has already started.');

  const members = session.members || [];
  if (members.some(m => m.uid === user.uid)) {
    await updateDoc(inviteRef, { status: 'accepted', acceptedAt: serverTimestamp(), acceptedBy: user.uid });
    return session;
  }

  if (members.length >= FOCUS_ROOM_MAX_TEAM) {
    throw new Error('This team is already full (5/5).');
  }

  const newMember = {
    uid: user.uid,
    email: user.email,
    name: user.displayName || invite.inviteeEmail.split('@')[0],
    photoURL: user.photoURL || null,
    score: 0,
    isHost: false
  };

  const pendingInvites = (session.pendingInvites || []).filter(
    i => (i.email || '').toLowerCase() !== userEmail
  );

  await updateDoc(sessionRef, {
    members: [...members, newMember],
    pendingInvites
  });

  await updateDoc(inviteRef, {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    acceptedBy: user.uid
  });

  await addNotification(user.uid, {
    icon: '✅',
    color: 'green',
    title: `You joined "${session.teamName || invite.teamName}" for the team quiz.`,
    type: 'team_join',
    read: false
  });

  return { ...session, members: [...members, newMember], pendingInvites };
}
