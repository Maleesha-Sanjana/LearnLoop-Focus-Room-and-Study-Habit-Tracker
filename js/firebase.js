import { initializeApp } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyBEUIOfXeULzYSqBHsD8PSg-HagvYg48MA",
  authDomain: "study-habit-tracker-f3e8a.firebaseapp.com",
  projectId: "study-habit-tracker-f3e8a",
  storageBucket: "study-habit-tracker-f3e8a.firebasestorage.app",
  messagingSenderId: "927845652543",
  appId: "1:927845652543:web:2396fbbbc92dc8f22e008a",
  measurementId: "G-HHBPZGZ69D"
};


const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);