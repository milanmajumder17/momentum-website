// ============================================================
// Momentum Education — shared Auth UI (classic script, no modules)
// Works on ANY page that has: <span id="authArea">...</span>
// Pairs with js/firebase-db.js (module) via window.FirebaseHelper.
// Guest-safe: page stays 100% usable when Firebase is offline.
// ============================================================
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loginBtnHTML() {
    return '<button id="googleLoginBtn" class="auth-btn" title="Login with Google">'
      + '<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>'
      + '<span>Login</span></button>';
  }

  function paintAuth(user) {
    var area = document.getElementById('authArea');
    if (!area) return;
    if (user) {
      var img = user.photoURL
        ? '<img src="' + esc(user.photoURL) + '" alt="" title="' + esc(user.displayName || 'user') + '" class="auth-avatar">'
        : '<span class="auth-avatar-fallback">👤</span>';
      area.innerHTML = img
        + '<button id="logoutBtn" class="btn ghost auth-compact" title="Logout">Logout</button>';
      var out = document.getElementById('logoutBtn');
      if (out) out.onclick = function () {
        var H = window.FirebaseHelper;
        if (H && H.logout) H.logout().catch(function () {});
      };
    } else {
      area.innerHTML = loginBtnHTML();
      wireLogin();
    }
  }

  function wireLogin() {
    var b = document.getElementById('googleLoginBtn');
    if (!b || b.dataset.wired) return;
    b.dataset.wired = '1';
    b.onclick = function () {
      var H = window.FirebaseHelper;
      if (!H || !H.loginWithGoogle) {
        // Firebase module still loading (or blocked) — give it a moment then retry
        b.disabled = true;
        var n = 0;
        var t = setInterval(function () {
          n++;
          var H2 = window.FirebaseHelper;
          if (H2 && H2.loginWithGoogle) {
            clearInterval(t);
            H2.loginWithGoogle().catch(function (err) {
              console.warn('[auth] Google sign-in failed:', err && err.code);
            }).then(function () { b.disabled = false; });
          } else if (n > 20) {
            clearInterval(t);
            b.disabled = false;
            alert('Login is still loading. Please check your connection and try again.');
          }
        }, 250);
        return;
      }
      b.disabled = true;
      H.loginWithGoogle().catch(function (err) {
        console.warn('[auth] Google sign-in failed:', err && err.code);
        if (err && err.code === 'auth/popup-blocked') alert('Please allow popups for this site to login.');
        else if (err && err.code === 'auth/unauthorized-domain') alert('This domain is not authorized for login yet.');
        else if (err && err.code !== 'auth/popup-closed-by-user') alert('Login failed. Please try again.');
      }).then(function () { b.disabled = false; });
    };
  }

  // Wire the server-rendered button immediately (works even before Firebase loads)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireLogin);
  } else {
    wireLogin();
  }

  // Subscribe when the Firebase module arrives (poll ~12s, then stay guest-usable)
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var H = window.FirebaseHelper;
    if (H && H.onAuth) { clearInterval(timer); H.onAuth(paintAuth); return; }
    if (tries > 48) clearInterval(timer);
  }, 250);
})();
