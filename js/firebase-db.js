// ============================================================
// Momentum Education — Firebase helper (v10 Modular SDK, no npm)
// Pure HTML/JS site friendly. Loaded as a module script:
//   <script type="module" src="../js/firebase-db.js"></script>
// Exposes: window.FirebaseHelper = { loginWithGoogle, logout,
//   onAuth, saveHighScore, getLeaderboard, currentUser }
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- Your web app's Firebase configuration ----
const firebaseConfig = {
  apiKey: "AIzaSyA_8KfXi_gDYrTm7mwX9nc-oigxOg0ajLE",
  authDomain: "momentum-games.firebaseapp.com",
  projectId: "momentum-games",
  storageBucket: "momentum-games.firebasestorage.app",
  messagingSenderId: "517200338017",
  appId: "1:517200338017:web:9d1e9d27f9519fe867de20",
  measurementId: "G-RVFYJD7WNT"
};

// ---- Initialize Firebase (guard against double-init) ----
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
// Optional: always show account chooser (nice UX for shared devices)
// googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Sign in with Google popup.
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
async function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

/**
 * Sign out the current user.
 * @returns {Promise<void>}
 */
async function logout() {
  return signOut(auth);
}

/**
 * Subscribe to auth-state changes.
 * @param {(user: object|null) => void} cb
 * @returns {Function} unsubscribe function
 */
function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

/**
 * Save the user's best IQ score to the `leaderboard` collection.
 * Document ID = user's uid. Only overwrites when the new score is
 * STRICTLY greater than the stored one.
 * Safe to call for guests — it no-ops when nobody is signed in.
 *
 * @param {number} score - final rounded IQ (e.g. 112)
 * @param {number} percentile - 0..100 rounded percentile
 * @returns {Promise<{saved: boolean, reason: string}>}
 */
async function saveHighScore(score, percentile) {
  const user = auth.currentUser;
  if (!user) return { saved: false, reason: "not-logged-in" };

  const s = Math.round(Number(score));
  const p = Math.round(Number(percentile));
  if (!Number.isFinite(s)) return { saved: false, reason: "bad-score" };

  const ref = doc(db, "leaderboard", user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const prev = snap.data().score;
      if (typeof prev === "number" && prev >= s) {
        return { saved: false, reason: "not-higher" }; // keep old best
      }
    }
    await setDoc(ref, {
      displayName: user.displayName || "Anonymous",
      photoURL: user.photoURL || "",
      score: s,
      percentile: Number.isFinite(p) ? p : 0,
      timestamp: serverTimestamp()
    }, { merge: true });
    return { saved: true, reason: "saved" };
  } catch (err) {
    console.warn("[FirebaseHelper] saveHighScore failed:", err);
    return { saved: false, reason: "error" };
  }
}

/**
 * Fetch the global top-10 leaderboard, highest IQ first.
 * @returns {Promise<Array<{id:string, displayName:string, photoURL:string, score:number, percentile:number}>>}
 */
async function getLeaderboard() {
  try {
    const q = query(
      collection(db, "leaderboard"),
      orderBy("score", "desc"),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[FirebaseHelper] getLeaderboard failed:", err);
    return [];
  }
}

// ---- Export globally so the classic inline script in iq.html can use it ----
window.FirebaseHelper = {
  loginWithGoogle,
  logout,
  onAuth,
  saveHighScore,
  getLeaderboard,
  // live getter so `FirebaseHelper.currentUser` always reflects auth state
  get currentUser() { return auth.currentUser; },
  // raw handles for advanced use
  auth,
  db
};
