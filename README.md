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
| Real-time | Firebase Realtime Database |
| Charts | Chart.js |

## Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → name it `learnloop`
3. Enable **Google Analytics** (optional)

### 2. Enable Firebase Services

In your Firebase project:

- **Authentication** → Sign-in method → Enable **Email/Password**
- **Firestore Database** → Create database → Start in **test mode**
- **Realtime Database** → Create database → Start in **test mode**

### 3. Get Your Config

Go to **Project Settings → Your apps → Web app** → Register app → Copy the config object.

### 4. Update `js/firebase-config.js`

Replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 5. Set Firestore Security Rules

In Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 6. Set Realtime Database Rules

In Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

### 7. Run the App

Open `learnloop/login.html` in your browser, or use a local server:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (npx)
npx serve learnloop
```

Then visit `http://localhost:8080`

## Project Structure

```
learnloop/
├── index.html          # Dashboard
├── login.html          # Login / Register
├── tracker.html        # Study Timer & Sessions
├── goals.html          # Goal Management
├── analytics.html      # Charts & Insights
├── focus-room.html     # Real-time Focus Rooms
├── profile.html        # User Profile
├── css/
│   └── style.css       # All styles (dark theme)
└── js/
    ├── firebase-config.js  # Firebase init + auth guard
    ├── app.js              # Shared utilities
    ├── auth.js             # Login/Register logic
    ├── tracker.js          # Timer & session management
    ├── goals.js            # Goal CRUD & progress
    ├── analytics.js        # Chart.js visualizations
    ├── focus-room.js       # Real-time rooms (RTDB)
    └── profile.js          # Profile management
```

## Firestore Collections

| Collection | Description |
|-----------|-------------|
| `users` | User profiles, streak, preferences |
| `sessions` | Study sessions (subject, duration, notes) |
| `goals` | Goals with progress tracking |
| `subjects` | User's subject list |

## Realtime Database Structure

```
rooms/
  {roomId}/
    name, subject, createdBy, status
    timerSeconds, timerStatus, timerMode
    participants/
      {userId}/ name, status
    chat/
      {msgId}/ sender, text, timestamp
```
