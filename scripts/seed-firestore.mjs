/**
 * Seed Firestore collections for LearnLoop.
 *
 * Usage (pick one auth method):
 *   1. Service account: export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *   2. gcloud ADC:      gcloud auth application-default login --project=learnloop-f89c2
 *
 * Then: npm run firebase:seed
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'learnloop-f89c2';

const QUIZ_QUESTIONS = [
  { question: 'What is the capital of France?', answers: ['London', 'Berlin', 'Paris', 'Madrid'], correct: 2 },
  { question: 'Which planet is known as the Red Planet?', answers: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1 },
  { question: 'What is 15 × 8?', answers: ['120', '125', '115', '130'], correct: 0 },
  { question: "Who wrote 'Romeo and Juliet'?", answers: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correct: 1 },
  { question: 'What is the largest ocean on Earth?', answers: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'], correct: 3 }
];

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

function initAdmin() {
  if (admin.apps.length) return admin.app();

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || resolve(__dirname, '../serviceAccountKey.json');

  if (existsSync(keyPath)) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID
    });
  }

  return admin.initializeApp({ projectId: PROJECT_ID });
}

async function seed() {
  initAdmin();
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  console.log(`Seeding Firestore for project: ${PROJECT_ID}`);

  await db.doc('quizSets/default').set({
    questions: QUIZ_QUESTIONS,
    updatedAt: now
  });
  console.log(`✓ quizSets/default (${QUIZ_QUESTIONS.length} questions)`);

  await db.doc('config/app').set({
    ...APP_CONFIG,
    updatedAt: now
  });
  console.log('✓ config/app (subjects, avatars, badges)');

  await db.doc('platformStats/global').set({
    studentCount: 0,
    sessionCount: 0,
    goalsCompletedCount: 0,
    updatedAt: now
  }, { merge: true });
  console.log('✓ platformStats/global');

  console.log('\nFirestore seed complete.');
}

seed().catch(err => {
  console.error('\nSeed failed:', err.message);
  console.error(`
If you see a credentials error, use one of these:

  Option A — Service account key (recommended):
    1. Firebase Console → Project Settings → Service accounts → Generate new private key
    2. Save as serviceAccountKey.json in the project root (already gitignored)
    3. export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
    4. npm run firebase:seed

  Option B — gcloud application-default credentials:
    gcloud auth application-default login --project=${PROJECT_ID}
    npm run firebase:seed
`);
  process.exit(1);
});
