// =============================================
// Auth & Storage – localStorage (no Firebase)
// =============================================

const USERS = [
  { uid: "user_test", email: "test@gmail.com", password: "test123", displayName: "Test User" }
];

// ── Simple Auth ──
const auth = {
  _current: null,
  _listeners: [],

  onAuthStateChanged(cb) {
    const stored = localStorage.getItem("ll_user");
    this._current = stored ? JSON.parse(stored) : null;
    cb(this._current);
    this._listeners.push(cb);
  },

  signInWithEmailAndPassword(email, password) {
    const user = USERS.find(u => u.email === email && u.password === password);
    if (!user) return Promise.reject({ code: "auth/wrong-password" });
    const u = { uid: user.uid, email: user.email, displayName: user.displayName };
    localStorage.setItem("ll_user", JSON.stringify(u));
    this._current = u;
    return Promise.resolve({ user: u });
  },

  createUserWithEmailAndPassword(email, password) {
    if (USERS.find(u => u.email === email)) return Promise.reject({ code: "auth/email-already-in-use" });
    const uid = "user_" + Date.now();
    const u = { uid, email, displayName: "" };
    USERS.push({ uid, email, password, displayName: "" });
    localStorage.setItem("ll_user", JSON.stringify(u));
    this._current = u;
    return Promise.resolve({ user: { ...u, updateProfile(p) { u.displayName = p.displayName; localStorage.setItem("ll_user", JSON.stringify(u)); return Promise.resolve(); } } });
  },

  signOut() {
    localStorage.removeItem("ll_user");
    this._current = null;
    return Promise.resolve();
  },

  currentUser() {
    const s = localStorage.getItem("ll_user");
    return s ? JSON.parse(s) : null;
  }
};

// ── Simple Firestore-like DB (localStorage) ──
const db = {
  collection(name) {
    return new Collection(name);
  }
};

class Collection {
  constructor(name) { this.name = name; }

  _load() {
    return JSON.parse(localStorage.getItem("ll_col_" + this.name) || "{}");
  }
  _save(data) {
    localStorage.setItem("ll_col_" + this.name, JSON.stringify(data));
  }

  doc(id) { return new Doc(this.name, id); }

  add(data) {
    const store = this._load();
    const id = "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    data.createdAt = data.createdAt || new Date().toISOString();
    store[id] = { ...data };
    this._save(store);
    return Promise.resolve({ id });
  }

  where(field, op, value) { return new Query(this.name, [{ field, op, value }]); }
  orderBy() { return new Query(this.name, []); }
  get() { return new Query(this.name, []).get(); }
}

class Doc {
  constructor(colName, id) { this.colName = colName; this.id = id; }

  _load() { return JSON.parse(localStorage.getItem("ll_col_" + this.colName) || "{}"); }
  _save(data) { localStorage.setItem("ll_col_" + this.colName, JSON.stringify(data)); }

  get() {
    const store = this._load();
    const d = store[this.id];
    return Promise.resolve({ exists: !!d, data: () => d || {}, id: this.id });
  }

  set(data) {
    const store = this._load();
    store[this.id] = { ...data };
    this._save(store);
    return Promise.resolve();
  }

  update(data) {
    const store = this._load();
    store[this.id] = { ...(store[this.id] || {}), ...data };
    this._save(store);
    return Promise.resolve();
  }

  delete() {
    const store = this._load();
    delete store[this.id];
    this._save(store);
    return Promise.resolve();
  }
}

class Query {
  constructor(colName, filters) { this.colName = colName; this.filters = filters; this._limit = null; }

  _load() { return JSON.parse(localStorage.getItem("ll_col_" + this.colName) || "{}"); }

  where(field, op, value) { return new Query(this.colName, [...this.filters, { field, op, value }]); }
  orderBy() { return this; }
  limit(n) { this._limit = n; return this; }

  get() {
    const store = this._load();
    let docs = Object.entries(store).map(([id, data]) => ({ id, data: () => data, ...data }));

    for (const f of this.filters) {
      docs = docs.filter(d => {
        const val = d.data()[f.field];
        if (f.op === "==") return val === f.value;
        if (f.op === ">=") return val >= f.value;
        if (f.op === "<=") return val <= f.value;
        return true;
      });
    }

    // Sort by createdAt desc by default
    docs.sort((a, b) => {
      const ta = a.data().createdAt || a.data().startTime || "";
      const tb = b.data().createdAt || b.data().startTime || "";
      return tb > ta ? 1 : -1;
    });

    if (this._limit) docs = docs.slice(0, this._limit);

    return Promise.resolve({
      docs,
      size: docs.length,
      forEach(cb) { docs.forEach(cb); }
    });
  }
}

// ── Batch ──
db.batch = function () {
  const ops = [];
  return {
    delete(ref) { ops.push(() => ref.delete()); },
    commit() { return Promise.all(ops.map(op => op())); }
  };
};

// ── Stub for rtdb (focus-room uses it) ──
const rtdb = {
  ref(path) {
    return {
      on() {}, once() { return Promise.resolve({ val: () => null, forEach() {} }); },
      set() { return Promise.resolve(); }, update() { return Promise.resolve(); },
      remove() { return Promise.resolve(); }, push() { return Promise.resolve(); },
      child() { return this; }, onDisconnect() { return { remove() {} }; },
      limitToLast() { return this; }, off() {}
    };
  }
};

// ── firebase stub (Timestamp used in tracker/goals) ──
const firebase = {
  firestore: {
    Timestamp: {
      fromDate(d) { return d instanceof Date ? d.toISOString() : d; },
      FieldValue: { serverTimestamp: () => new Date().toISOString() }
    },
    FieldValue: { serverTimestamp: () => new Date().toISOString() }
  }
};

// ── Auth guard ──
function requireAuth(redirectTo = "login.html") {
  return new Promise((resolve) => {
    const stored = localStorage.getItem("ll_user");
    if (!stored) {
      window.location.href = redirectTo;
    } else {
      const user = JSON.parse(stored);
      // attach updateProfile / updatePassword stubs
      user.updateProfile = (p) => {
        user.displayName = p.displayName;
        localStorage.setItem("ll_user", JSON.stringify(user));
        return Promise.resolve();
      };
      user.updatePassword = () => Promise.resolve();
      user.delete = () => { localStorage.removeItem("ll_user"); return Promise.resolve(); };
      resolve(user);
    }
  });
}
