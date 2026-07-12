// Firebase helpers

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

// Setup

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

// Firestore REST fallback (works on GitHub Pages when the SDK is blocked)

function parseRestValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(parseRestValue);
  }
  if (value.mapValue) {
    const obj = {};
    const fields = value.mapValue.fields || {};
    for (const key in fields) {
      obj[key] = parseRestValue(fields[key]);
    }
    return obj;
  }
  return null;
}

function parseRestDoc(doc) {
  const data = {};
  const fields = doc.fields || {};
  for (const key in fields) {
    data[key] = parseRestValue(fields[key]);
  }
  const parts = (doc.name || '').split('/');
  return { id: parts[parts.length - 1], ...data };
}

async function restListCollection(collectionName) {
  const docs = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '300' });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collectionName}?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`REST ${collectionName} failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.documents) {
      for (let i = 0; i < data.documents.length; i++) {
        docs.push(parseRestDoc(data.documents[i]));
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return docs;
}

async function restGetDocument(collectionName, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collectionName}/${docId}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`REST ${collectionName}/${docId} failed: ${res.status}`);
  }
  return parseRestDoc(await res.json());
}

async function loadCollectionWithFallback(collectionName) {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (sdkErr) {
    console.warn(`Firestore SDK read failed for ${collectionName}, using REST fallback.`, sdkErr);
    return restListCollection(collectionName);
  }
}

async function loadDocumentWithFallback(collectionName, docId) {
  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    if (snap.exists()) return snap.data();
    return null;
  } catch (sdkErr) {
    console.warn(`Firestore SDK read failed for ${collectionName}/${docId}, using REST fallback.`, sdkErr);
    return restGetDocument(collectionName, docId);
  }
}

// Constants

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

// Paths

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

// Helpers
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
    companionAlerts: true,
    publicMatchmaking: true
  };
}

// App config

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

// User profile

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

// Goals

export function subscribeGoals(uid, callback) {
  return onSnapshot(goalsCol(uid), snap => {
    callback(snap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      progress: d.data().progress || 0,
      status: d.data().status ? d.data().status : 'active'
    })));
  });
}

export async function loadGoals(uid) {
  const snap = await getDocs(goalsCol(uid));
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name,
    progress: d.data().progress || 0,
    status: d.data().status ? d.data().status : 'active'
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

// Activities

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

// Resources

export function subscribeResources(uid, callback) {
  const q = query(resourcesCol(uid), orderBy('uploadedAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name, size: data.size, scope: data.scope, url: data.url || null };
    }));
  });
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

// Achievements

export function subscribeAchievements(uid, callback) {
  return onSnapshot(achievementsCol(uid), snap => {
    callback(new Set(snap.docs.map(d => d.id)));
  });
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

// Notifications

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
  const updates = [];
  for (const d of snap.docs) {
    if (!d.data().read) {
      updates.push(updateDoc(d.ref, { read: true }));
    }
  }
  await Promise.all(updates);
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

// Quiz

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

// Leaderboards
export async function getIndividualLeaderboard(max = 10) {
  const rows = await loadCollectionWithFallback('quizResults');
  const byUser = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = r.uid;
    if (!key) continue;

    if (!byUser[key]) {
      byUser[key] = { uid: key, name: r.userName || 'Learner', score: 0, quizzes: 0, totalPercent: 0 };
    }
    const cur = byUser[key];
    cur.score += r.score || 0;
    cur.quizzes += 1;
    cur.totalPercent += r.avgPercent || 0;
    cur.name = r.userName || cur.name;
  }

  const users = [];
  for (const uid in byUser) {
    const u = byUser[uid];
    const avg = u.quizzes ? Math.round(u.totalPercent / u.quizzes) : 0;
    users.push({ uid: u.uid, name: u.name, score: u.score, quizzes: u.quizzes, totalPercent: u.totalPercent, avg });
  }

  users.sort((a, b) => b.score - a.score);
  return users.slice(0, max);
}


export async function getTeamLeaderboard(max = 10) {
  let rows = [];

  try {
    const snap = await getDocs(collection(db, 'sessions'));
    rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (sdkErr) {
    console.warn('Firestore SDK read failed for sessions, using REST fallback.', sdkErr);
    try {
      rows = await restListCollection('sessions');
    } catch (restErr) {
      console.warn('Could not load team leaderboard.', restErr);
      return [];
    }
  }

  const teams = [];

  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    if (s.status !== 'finished' || !s.members?.length) continue;

    let teamScore = 0;
    for (const m of s.members) {
      teamScore += m.score || 0;
    }

    teams.push({
      name: s.teamName || `Team ${s.hostEmail?.split('@')[0] || 'Session'}`,
      score: teamScore,
      members: s.members.length,
      sessions: 1
    });
  }

  return teams.sort((a, b) => b.score - a.score).slice(0, max);
}

// Platform stats

export async function getPlatformStats() {
  const cached = await loadDocumentWithFallback('platformStats', 'global');
  if (cached) return cached;

  if (!auth.currentUser) {
    return { studentCount: 0, sessionCount: 0, goalsCompletedCount: 0 };
  }

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
  await setDoc(doc(db, 'platformStats', 'global'), { ...stats, updatedAt: serverTimestamp() });
  return stats;
}

export async function incrementPlatformStats(field) {
  const ref = doc(db, 'platformStats', 'global');
  const snap = await getDoc(ref);
  if (!snap.exists()) await getPlatformStats();
  await updateDoc(ref, { [field]: increment(1), updatedAt: serverTimestamp() });
}

// Testimonials

export async function loadTestimonials() {
  const rows = await loadCollectionWithFallback('testimonials');
  return rows;
}

// Study sessions

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

// Team invites

export const FOCUS_ROOM_MAX_TEAM = 5;

export function buildTeamJoinUrl(sessionId) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://learnloop-f89c2.web.app';
  return `${base}/focusroom.html?join=${encodeURIComponent(sessionId)}`;
}

export async function joinTeamSession({ sessionId, user }) {
  const sessionRef = doc(db, 'sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error('Team session not found. Check the link and try again.');
  const session = sessionSnap.data();

  if (session.status !== 'lobby') throw new Error('This team game has already started.');

  const members = session.members || [];
  if (members.some(m => m.uid === user.uid)) {
    return { ...session, members, teamName: session.teamName };
  }

  if (members.length >= FOCUS_ROOM_MAX_TEAM) {
    throw new Error('This team is full (5/5).');
  }

  const newMember = {
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email?.split('@')[0] || 'Player',
    photoURL: user.photoURL || null,
    score: 0,
    isHost: false
  };

  const updatedMembers = [...members, newMember];
  await updateDoc(sessionRef, { members: updatedMembers });

  try {
    await addNotification(user.uid, {
      icon: '✅',
      color: 'green',
      title: `You joined "${session.teamName}" for the team quiz.`,
      type: 'team_join',
      read: false
    });
  } catch (err) {
    console.warn('Could not add join notification.', err);
  }

  return { ...session, members: updatedMembers, teamName: session.teamName };
}
