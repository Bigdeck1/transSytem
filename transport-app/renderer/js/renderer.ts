// renderer.ts
// Handles login UI through Electron preload bridge

declare const lucide: any;

document.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  const debugPanel = document.getElementById("debugPanel") as HTMLDivElement | null;
  const form = document.getElementById("loginForm") as HTMLFormElement | null;
  const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement | null;
  const emailInput = document.getElementById("email") as HTMLInputElement | null;
  const passwordInput = document.getElementById("password") as HTMLInputElement | null;
  const rememberMe = document.getElementById("rememberMe") as HTMLInputElement | null;

  // 1. Auto-Login Check: If a session exists, redirect immediately
  const existingUser = localStorage.getItem("user");
  if (existingUser) {
    console.log("Active session found. Redirecting...");
    try {
      const user = JSON.parse(existingUser);
      if (user && user.role === "super_admin") {
        window.location.href = "../html/admin_panel.html";
        return;
      }
    } catch (e) {
      console.error("Failed to parse existing user session:", e);
    }
    window.location.href = "../html/dashboard.html";
    return;
  }

  // 2. Restore remembered email and handle focus
  if (emailInput && rememberMe) {
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) {
      emailInput.value = savedEmail;
      rememberMe.checked = true;
      // Focus password if email is already filled
      if (passwordInput) passwordInput.focus();
    } else {
      emailInput.focus();
    }
  }

  let isSubmitting = false;

  function logDebug(
    message: string,
    type: "info" | "error" | "success" | "warn" = "info"
  ) {
    console.log(`[DEBUG][${type.toUpperCase()}]`, message);

    if (!debugPanel) return;

    const row = document.createElement("div");
    row.textContent = message;
    row.style.marginBottom = "6px";

    switch (type) {
      case "error":
        row.style.color = "#dc2626";
        break;
      case "success":
        row.style.color = "#16a34a";
        break;
      case "warn":
        row.style.color = "#d97706";
        break;
      default:
        row.style.color = "#2563eb";
        break;
    }

    debugPanel.appendChild(row);
    debugPanel.scrollTop = debugPanel.scrollHeight;
  }

  function showError(message: string, isVerificationError = false, email = "") {
    logDebug(`Error: ${message}`, "error");
    if (isVerificationError && email) {
      const wantToVerify = confirm("Your email is not verified yet. Would you like to verify it now?");
      if (wantToVerify) {
        window.location.href = `signup_page.html?verify=true&email=${encodeURIComponent(email)}`;
      }
    } else {
      alert(message);
    }
  }

  function showSuccess(message: string) {
    logDebug(`Success: ${message}`, "success");
    alert(message);
  }

  function setLoading(state: boolean) {
    if (!loginBtn) return;

    if (state) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = `<div class="spinner"></div> Signing in...`;
    } else {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `Sign In <i data-lucide="arrow-right"></i>`;
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }
    }
  }

  function redirectToDashboard() {
    logDebug("Redirecting to dashboard.html...", "success");
    window.location.href = "../html/dashboard.html";
  }

  if (!form || !loginBtn || !emailInput || !passwordInput) {
    console.error("Login form elements missing in HTML.");
    logDebug("Login form elements missing in HTML.", "error");
    return;
  }

  logDebug("Renderer initialized.");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      logDebug("Submit ignored because login is already in progress.", "warn");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    logDebug("Submit clicked");
    logDebug(`Email entered: ${email || "(empty)"}`);
    logDebug(`Password entered: ${password ? "******" : "(empty)"}`);

    if (!email || !password) {
      showError("Please fill in both email and password.");
      return;
    }

    isSubmitting = true;
    setLoading(true);
    logDebug("Sending login request through preload bridge...");

    try {
      const data = await window.api.login(email, password);

      logDebug("Response received: " + JSON.stringify(data));

      if (data) {
        // Check for error responses (from gated login: unverified / unapproved)
        if (data.error) {
          const isVer = data.error.toLowerCase().includes("verify your email");
          showError(data.error, isVer, email);
          logDebug("Login blocked: " + data.error, "error");
          return;
        }

        // Save user session to localStorage for auth_guard to see
        localStorage.setItem("user", JSON.stringify(data));

        // Handle Remember Me (Email persistence)
        if (rememberMe?.checked) {
          localStorage.setItem("remembered_email", email);
        } else {
          localStorage.removeItem("remembered_email");
        }

        // Check if super admin — redirect to admin panel
        if (data.role === "super_admin") {
          logDebug("Super admin detected. Redirecting to admin panel...", "success");
          setTimeout(() => {
            window.location.href = "../html/admin_panel.html";
          }, 600);
          return;
        }

        showSuccess("Login successful! Redirecting to dashboard...");
        setTimeout(() => {
          redirectToDashboard();
        }, 800);
      } else {
        showError("Invalid email or password.");
        logDebug("Login failed: No matching user found.", "error");
      }
    } catch (err: any) {
      showError("Failed to connect.");
      logDebug("Login error: " + (err?.message || String(err)), "error");
    } finally {
      isSubmitting = false;
      setLoading(false);
    }
  });
});