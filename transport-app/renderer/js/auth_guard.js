window.Auth = {
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes of inactivity
  _activityTimer: null,
  _warningTimer: null,

  check() {
    const user = localStorage.getItem("user");
    const lastActivity = localStorage.getItem("lastActivity");

    if (!user) return false;

    // Check session timeout
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed > this.SESSION_TIMEOUT) {
        console.warn("[AUTH] Session expired due to inactivity.");
        this.logout();
        return false;
      }
    }

    return true;
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  },

  requireAuth() {
    const path = window.location.pathname;
    const isPublicPage = path.endsWith("index.html") || path.endsWith("signup_page.html") || path.endsWith("forgot_password_page.html") || path.endsWith("admin_panel.html") || path.endsWith("/");

    if (!this.check() && !isPublicPage) {
      window.location.replace("index.html");
      return;
    }

    // Start activity tracking on protected pages
    if (!isPublicPage && this.check()) {
      this._startActivityTracking();
    }
  },

  _startActivityTracking() {
    // Update last activity on user interactions
    const updateActivity = () => {
      localStorage.setItem("lastActivity", String(Date.now()));
    };

    // Track user interactions
    ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Set initial activity
    updateActivity();

    // Check every minute for expiry
    if (this._activityTimer) clearInterval(this._activityTimer);
    this._activityTimer = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem("lastActivity") || "0", 10);
      const elapsed = Date.now() - lastActivity;
      const remaining = this.SESSION_TIMEOUT - elapsed;

      // Warn 5 minutes before expiry
      if (remaining > 0 && remaining <= 5 * 60 * 1000) {
        this._showWarning(Math.ceil(remaining / 60000));
      }

      // Session expired
      if (remaining <= 0) {
        alert("Your session has expired due to inactivity. Please log in again.");
        this.logout();
      }
    }, 60 * 1000); // Check every 60 seconds
  },

  _showWarning(minutesLeft) {
    // Only show warning once per minute
    const warningKey = `session_warning_${minutesLeft}`;
    if (sessionStorage.getItem(warningKey)) return;
    sessionStorage.setItem(warningKey, "true");

    // Create a non-blocking notification
    const existing = document.getElementById("session-warning-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "session-warning-toast";
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      background: linear-gradient(135deg, #f59e0b, #d97706); color: white;
      padding: 16px 24px; border-radius: 12px; font-family: 'Outfit', sans-serif;
      font-weight: 600; font-size: 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease-out;
    `;
    toast.innerHTML = ` Session expires in ${minutesLeft} minute(s). Move your mouse to stay logged in.`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
  },

  logout() {
    if (this._activityTimer) clearInterval(this._activityTimer);
    localStorage.removeItem("user");
    localStorage.removeItem("lastActivity");
    sessionStorage.clear();
    window.location.replace("index.html");
  }
};

// Auto-enforce on script load
window.Auth.requireAuth();
