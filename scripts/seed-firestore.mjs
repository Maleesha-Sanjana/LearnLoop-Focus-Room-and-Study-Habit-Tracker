/**
 * Seed quizSets/default into Firestore.
 * Uses serviceAccountKey.json OR Firebase CLI login (firebase login).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'learnloop-f89c2';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5iuvb6lqs27jnf00.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9pE8B7s2vJ9pE8B7s2v';

const QUIZ_QUESTIONS = JSON.parse(
  readFileSync(resolve(__dirname, '../data/quiz-questions.json'), 'utf8')
);

const APP_CONFIG = {
  subjects: ['Java', 'React', 'Database', 'Networking', 'Algorithms', 'Machine Learning', 'System Design'],
  avatars: ['Aisha', 'David', 'Emma', 'Sarah', 'Caleb', 'Maya'],
  badgeDefinitions: [
    { id: 'streak-badge', title: '7 Day Streak', icon: '🔥', threshold: 7, metric: 'streak' },
    { id: 'goal-badge', title: 'Goal Master', icon: '🎯', threshold: 20, metric: 'goalsCompleted' },
    { id: 'hours-badge', title: '100 Study Hours', icon: '📚', threshold: 100, metric: 'hours' },
    { id: 'team-badge', title: 'Reputation Pro', icon: '✨', threshold: 500, metric: 'reputation' },
    { id: 'notes-badge', title: 'Contributor Portfolio', icon: '📝', threshold: 3, metric: 'resourcesCount' },
    { id: 'focus-badge', title: 'Focus Champion', icon: '⚡', threshold: 95, metric: 'focusScore' }
  ]
};

function getFirebaseCliRefreshToken() {
  const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!existsSync(configPath)) return null;
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const user = Object.values(config.users || {})[0];
  return user?.tokens?.refresh_token || null;
}

async function getFirestoreDb() {
  const envKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const defaultKey = resolve(__dirname, '../serviceAccountKey.json');
  const keyPath = (envKey && existsSync(envKey)) ? envKey
    : (existsSync(defaultKey) ? defaultKey : null);

  if (keyPath) {
    return new Firestore({ projectId: PROJECT_ID, keyFilename: keyPath });
  }

  const refreshToken = getFirebaseCliRefreshToken();
  if (refreshToken) {
    const auth = new GoogleAuth({
      credentials: {
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
        refresh_token: refreshToken,
        type: 'authorized_user'
      },
      scopes: ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/cloud-platform']
    });
    const authClient = await auth.getClient();
    return new Firestore({ projectId: PROJECT_ID, authClient });
  }

  return new Firestore({ projectId: PROJECT_ID });
}

async function seed() {
  const db = await getFirestoreDb();
  const now = Firestore.FieldValue.serverTimestamp();

  console.log(`Seeding Firestore for project: ${PROJECT_ID}`);

  await db.doc('quizSets/default').set({
    questions: QUIZ_QUESTIONS,
    updatedAt: now
  });
  console.log(`✓ quizSets/default (${QUIZ_QUESTIONS.length} questions)`);

  await db.doc('config/app').set({ ...APP_CONFIG, updatedAt: now });
  console.log('✓ config/app');

  await db.doc('platformStats/global').set({
    studentCount: 0,
    sessionCount: 0,
    goalsCompletedCount: 0,
    updatedAt: now
  }, { merge: true });
  console.log('✓ platformStats/global');

  console.log('\nDone. Focus Room loads these from Firestore for all users.');
}

seed().catch(err => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
