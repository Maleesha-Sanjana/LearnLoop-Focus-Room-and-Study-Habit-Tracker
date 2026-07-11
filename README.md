# 🎓 LearnLoop – Personalized Study Habit Tracker & Focus Room

A web-based student productivity platform built with **HTML, CSS, JavaScript + Firebase**.

## Features

- 🔐 **Authentication** – Register/Login/Logout via Firebase Auth
- ⏱️ **Study Tracker** – Live timer + manual session entry, subject management
- 🎯 **Goals** – Daily, weekly, and long-term goals with progress tracking
- 📊 **Analytics** – Charts (bar, pie, line), smart insights, streaks
- 🧑‍🤝‍🧑 **Focus Rooms** – Real-time virtual study rooms with shared Pomodoro timer and live chat
- 👤 **Profile** – Edit profile, change password, view all-time stats

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| File storage | Firebase Storage |
| Real-time sync | Firestore onSnapshot listeners |
| Hosting | Firebase Hosting |
| Charts | Chart.js |

## Firebase CLI setup

This project is configured for the [Firebase CLI](https://firebase.google.com/docs/cli).

### Prerequisites

```bash
npm install -g firebase-tools   # if not installed
firebase login
npm install                     # installs firebase-admin for seed script
```

### Deploy (already configured for `learnloop-f89c2`)

```bash
# Firestore security rules
npm run firebase:deploy:rules

# Static website (live URL after deploy)
npm run firebase:deploy:hosting

# Everything except Storage (Storage must be enabled in Console first)
npm run firebase:deploy
```

**Live site:** https://learnloop-f89c2.web.app

### Storage rules

Firebase Storage is not enabled yet on this project. One-time setup:

1. Open [Firebase Console → Storage](https://console.firebase.google.com/project/learnloop-f89c2/storage)
2. Click **Get started** and choose a bucket location
3. Then deploy storage rules:

```bash
npm run firebase:deploy:storage
```

### Seed Firestore data (quiz questions + app config)

The seed script writes `quizSets/default`, `config/app`, and `platformStats/global`.

**Option A — Service account (recommended):**

1. Firebase Console → Project Settings → Service accounts → **Generate new private key**
2. Save the file as `serviceAccountKey.json` in the project root (gitignored)
3. Run:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
npm run firebase:seed
```

**Option B — gcloud application-default credentials:**

```bash
gcloud auth application-default login --project=learnloop-f89c2
npm run firebase:seed
```

### Useful CLI commands

| Command | Description |
|---------|-------------|
| `firebase use learnloop-f89c2` | Select project |
| `npm run firebase:deploy:rules` | Deploy Firestore rules |
| `npm run firebase:deploy:hosting` | Deploy website |
| `npm run firebase:deploy:storage` | Deploy Storage rules (after Storage is enabled) |
| `npm run firebase:seed` | Seed quiz + config documents |
| `firebase open hosting:site` | Open live site in browser |