import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC0SlrLGv9luVqaogkW4lpYL3mwIxxvSdA",
  authDomain: "learnloop-f89c2.firebaseapp.com",
  projectId: "learnloop-f89c2",
  storageBucket: "learnloop-f89c2.firebasestorage.app",
  messagingSenderId: "777914976314",
  appId: "1:777914976314:web:2cd051169684c24caf8d03",
  measurementId: "G-3SBVP21TE7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function saveUserToDatabase(user, userName) {
  const resolvedName = (userName || user.displayName || user.phoneNumber || user.email?.split('@')[0] || 'User').trim();
  await setDoc(doc(db, 'users', user.uid), {
    userName: resolvedName,
    email: user.email || '',
    phoneNumber: user.phoneNumber || null,
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return resolvedName;
}

function normalizePhone(raw) {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('94')) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+94${digits}`;
  }
  return `+${digits}`;
}

function getPhoneAuthErrorMessage(error) {
  const messages = {
    'auth/invalid-phone-number': 'Invalid phone number. Please check and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/captcha-check-failed': 'Verification failed. Please refresh and try again.',
    'auth/invalid-verification-code': 'Invalid verification code. Please try again.',
    'auth/code-expired': 'Code expired. Please request a new OTP.',
    'auth/missing-verification-code': 'Please enter the 6-digit code.',
    'auth/billing-not-enabled': 'Unable to send OTP. Please try again later.',
    'auth/operation-not-allowed': 'Unable to send OTP. Please try again later.',
  };
  return messages[error.code] || 'Something went wrong. Please try again.';
}

async function initLoginPageAuth() {
  await auth.authStateReady();
  if (auth.currentUser) {
    window.location.replace('index.html');
  }
}

initLoginPageAuth();

function showError(msg) {
  let el = document.getElementById('auth-error');
  if (!el) {
    el = document.createElement('p');
    el.id = 'auth-error';
    el.style.cssText = 'color:#e53e3e;font-size:.85rem;margin-top:8px;text-align:center;';
    document.querySelector('.auth-container').appendChild(el);
  }
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 5000);
}

const SUN = document.getElementById('theme-icon-sun');
const MOON = document.getElementById('theme-icon-moon');

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  SUN.style.display = dark ? 'block' : 'none';
  MOON.style.display = dark ? 'none' : 'block';
  localStorage.setItem('ll_theme', dark ? 'dark' : 'light');
}

applyTheme(localStorage.getItem('ll_theme') === 'dark');

document.getElementById('theme-toggle').addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark'));
});

// Must match Firebase Console → Authentication → Phone → test numbers
const TEST_PHONES = {
  '+94786360508': '123456',
};

function isSignupPage() {
  return new URLSearchParams(window.location.search).get('mode') === 'signup'
    || window.location.hash === '#signup'
    || document.documentElement.classList.contains('auth-signup');
}

let isSignUp = isSignupPage();
let recaptchaVerifier = null;
let confirmationResult = null;
let pendingPhone = '';
let useLocalTestOtp = false;

function isTestPhone(phone) {
  return Object.prototype.hasOwnProperty.call(TEST_PHONES, phone);
}

function clearAuthMessages() {
  const err = document.getElementById('auth-error');
  if (err) err.textContent = '';
}

function showOtpStep(phoneNumber) {
  pendingPhone = phoneNumber;
  clearAuthMessages();
  document.getElementById('phone-section').classList.add('hidden');
  document.getElementById('otp-section').classList.remove('hidden');
  document.getElementById('otp-sent-msg').textContent = 'Enter the 6-digit code sent to your phone.';
  document.getElementById('otp-code').value = '';
  document.getElementById('otp-code').focus();
}

async function signInWithTestPhone(phoneNumber) {
  const pseudoEmail = `${phoneNumber.replace(/\D/g, '')}@phone.learnloop.app`;
  const pseudoPassword = `ll_otp_${phoneNumber.replace(/\D/g, '')}`;

  let result;
  try {
    result = await signInWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
  } catch (error) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      result = await createUserWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
      await updateProfile(result.user, { displayName: phoneNumber });
    } else {
      throw error;
    }
  }

  await saveUserToDatabase(result.user, phoneNumber);
  return result;
}

window.toggleAuth = function(signUp) {
  isSignUp = signUp;
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const submitBtn = document.getElementById('submit-btn');
  const nameGroup = document.getElementById('name-group');
  const toggleText = document.getElementById('toggle-text');

  if (isSignUp) {
    title.innerText = "Create an account";
    subtitle.innerText = "Start tracking your study sessions today.";
    submitBtn.innerText = "Create Account";
    nameGroup.classList.remove('hidden');
    toggleText.innerHTML = 'Already have an account? <span onclick="toggleAuth(false)">Log in</span>';
  } else {
    title.innerText = "Welcome back";
    subtitle.innerText = "Log in to continue your study journey.";
    submitBtn.innerText = "Sign In";
    nameGroup.classList.add('hidden');
    toggleText.innerHTML = 'Don\'t have an account? <span onclick="toggleAuth(true)">Sign up</span>';
  }
};

const authMode = new URLSearchParams(window.location.search).get('mode');
if (isSignUp || authMode === 'signup' || window.location.hash === '#signup') {
  toggleAuth(true);
}

window.showForgetPassword = async function() {
  const email = document.getElementById('user-email').value;
  if (!email) {
    alert("Please enter your email address first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset link sent to: " + email);
  } catch (error) {
    console.error("Password reset error:", error);
    alert("Error sending password reset email: " + error.message);
  }
};

async function resetRecaptcha() {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (_) {}
    recaptchaVerifier = null;
  }
}

async function getRecaptchaVerifier() {
  await resetRecaptcha();
  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible'
  });
  await recaptchaVerifier.render();
  return recaptchaVerifier;
}

document.getElementById('google-login-btn').addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToDatabase(result.user);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Google login error:", error);
    showError("Google login failed: " + error.message);
  }
});

document.getElementById('main-auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('user-email').value.trim();
  const password = document.getElementById('user-password').value;
  const userName = document.getElementById('userName').value.trim();

  try {
    if (isSignUp) {
      if (!userName) {
        showError("Please enter your UserName.");
        return;
      }
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: userName });
      await saveUserToDatabase(result.user, userName);
      window.location.href = "index.html";
    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await saveUserToDatabase(result.user);
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Authentication error:", error);
    showError(error.message);
  }
});

document.getElementById('send-otp-btn').addEventListener('click', async () => {
  const rawPhone = document.getElementById('phone-number').value;
  if (!rawPhone.trim()) {
    showError("Please enter a phone number");
    return;
  }

  const phoneNumber = normalizePhone(rawPhone);
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    showError('Invalid phone number. Please check and try again.');
    return;
  }

  const btn = document.getElementById('send-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const verifier = await getRecaptchaVerifier();
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    useLocalTestOtp = false;
    showOtpStep(phoneNumber);
  } catch (error) {
    const sparkBlocked = error.code === 'auth/operation-not-allowed' || error.code === 'auth/billing-not-enabled';

    if (sparkBlocked && isTestPhone(phoneNumber)) {
      useLocalTestOtp = true;
      confirmationResult = null;
      showOtpStep(phoneNumber);
      await resetRecaptcha();
      return;
    }

    console.error("Error sending OTP:", error);
    showError(getPhoneAuthErrorMessage(error));
    await resetRecaptcha();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send OTP via SMS';
  }
});

document.getElementById('verify-otp-btn').addEventListener('click', async () => {
  const code = document.getElementById('otp-code').value.trim();
  if (!code) {
    showError("Please enter the OTP code");
    return;
  }
  if (!confirmationResult && !useLocalTestOtp) {
    showError("Please send an OTP first.");
    return;
  }

  const btn = document.getElementById('verify-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    if (useLocalTestOtp) {
      if (TEST_PHONES[pendingPhone] !== code) {
        showError('Invalid verification code. Please try again.');
        return;
      }
      await signInWithTestPhone(pendingPhone);
      window.location.href = "index.html";
      return;
    }

    const result = await confirmationResult.confirm(code);
    await saveUserToDatabase(result.user, pendingPhone);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error verifying OTP:", error);
    showError(getPhoneAuthErrorMessage(error));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify & Login';
  }
});

document.getElementById('change-phone-btn').addEventListener('click', async () => {
  confirmationResult = null;
  pendingPhone = '';
  useLocalTestOtp = false;
  clearAuthMessages();
  document.getElementById('otp-section').classList.add('hidden');
  document.getElementById('phone-section').classList.remove('hidden');
  await resetRecaptcha();
});
