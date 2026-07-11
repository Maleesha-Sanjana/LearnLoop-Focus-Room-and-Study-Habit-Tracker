// Import Firebase modules
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
    import { 
        getAuth, 
        onAuthStateChanged,
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

    // Your Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyC0SlrLGv9luVqaogkW4lpYL3mwIxxvSdA",
        authDomain: "learnloop-f89c2.firebaseapp.com",
        projectId: "learnloop-f89c2",
        storageBucket: "learnloop-f89c2.firebasestorage.app",
        messagingSenderId: "777914976314",
        appId: "1:777914976314:web:2cd051169684c24caf8d03",
        measurementId: "G-3SBVP21TE7"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    async function saveUserToDatabase(user, userName) {
        const resolvedName = (userName || user.displayName || user.email?.split('@')[0] || 'User').trim();
        await setDoc(doc(db, 'users', user.uid), {
            userName: resolvedName,
            email: user.email || '',
            photoURL: user.photoURL || null,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return resolvedName;
    }

    // If already logged in, skip the login page entirely
    onAuthStateChanged(auth, (user) => {
        if (user) window.location.href = "index.html";
    });

    // ── Error display (replaces alert) ──
    function showError(msg) {
        let el = document.getElementById('auth-error');
        if (!el) {
            el = document.createElement('p');
            el.id = 'auth-error';
            el.style.cssText = 'color:#e53e3e;font-size:.85rem;margin-top:8px;text-align:center;';
            document.querySelector('.auth-container').appendChild(el);
        }
        el.textContent = msg;
        setTimeout(() => { el.textContent = ''; }, 4000);
    }

    // ── Theme: read from localStorage (shared with index.html / profile.html) ──
    const SUN  = document.getElementById('theme-icon-sun');
    const MOON = document.getElementById('theme-icon-moon');

    function applyTheme(dark) {
        document.body.classList.toggle('dark', dark);
        SUN.style.display  = dark ? 'block' : 'none';
        MOON.style.display = dark ? 'none'  : 'block';
        localStorage.setItem('ll_theme', dark ? 'dark' : 'light');
    }

    // On load: respect whatever the dashboard last saved, fall back to system pref
    const saved = localStorage.getItem('ll_theme');
    if (saved) {
        applyTheme(saved === 'dark');
    } else {
        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    document.getElementById('theme-toggle').addEventListener('click', () => {
        applyTheme(!document.body.classList.contains('dark'));
    });

    let isSignUp = false;
    let recaptchaVerifier;
    let confirmationResult;

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
    }

    window.showForgetPassword = async function() {
        const email = document.getElementById('user-email').value;
        if(!email) {
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
    }

    // Google Login
    document.getElementById('google-login-btn').addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            await saveUserToDatabase(result.user);
            console.log("Google login successful:", result.user);
            window.location.href = "index.html";
        } catch (error) {
            console.error("Google login error:", error);
            showError("Google login failed: " + error.message);
        }
    });

    // Email/Password Authentication
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
                console.log("Sign up successful:", result.user);
                window.location.href = "index.html";
            } else {
                const result = await signInWithEmailAndPassword(auth, email, password);
                await saveUserToDatabase(result.user);
                console.log("Sign in successful:", result.user);
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Authentication error:", error);
            showError(error.message);
        }
    });

    // Phone Authentication - Send OTP
    document.getElementById('send-otp-btn').addEventListener('click', async () => {
        const phoneNumber = document.getElementById('phone-number').value;
        if (!phoneNumber) {
            showError("Please enter a phone number");
            return;
        }

        try {
            if (!recaptchaVerifier) {
                recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': (response) => { console.log("reCAPTCHA solved"); }
                });
            }
            confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            document.getElementById('phone-section').classList.add('hidden');
            document.getElementById('otp-section').classList.remove('hidden');
        } catch (error) {
            console.error("Error sending OTP:", error);
            showError("Failed to send OTP: " + error.message);
        }
    });

    // Phone Authentication - Verify OTP
    document.getElementById('verify-otp-btn').addEventListener('click', async () => {
        const code = document.getElementById('otp-code').value;
        if (!code) {
            showError("Please enter the OTP code");
            return;
        }

        try {
            const result = await confirmationResult.confirm(code);
            await saveUserToDatabase(result.user);
            console.log("Phone authentication successful:", result.user);
            window.location.href = "index.html";
        } catch (error) {
            console.error("Error verifying OTP:", error);
            showError("Invalid OTP code: " + error.message);
        }
    });
