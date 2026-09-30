// Initialize Lucide icons
lucide.createIcons();

const form = document.getElementById('loginForm');
const btn = document.getElementById('loginBtn');

// Handle form submit — calls the real IPC login API
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    alert('Please fill in all fields.');
    return;
  }

  // Disable button and show loading spinner
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Signing in...';

  try {
    const result = await window.api.login(email, password);

    if (!result) {
      alert('Invalid email or password. Please try again.');
      return;
    }

    // Handle error responses (gated login: unverified / unapproved)
    if (result.error) {
      if (result.error.toLowerCase().includes("verify your email")) {
        const wantToVerify = confirm("Your email is not verified yet. Would you like to verify it now?");
        if (wantToVerify) {
          window.location.href = `signup_page.html?verify=true&email=${encodeURIComponent(email)}`;
          return;
        }
      }
      alert(result.error);
      return;
    }

    // Store user data for auth guard and payroll lookups
    localStorage.setItem('user', JSON.stringify(result));
    localStorage.setItem('lastActivity', String(Date.now()));

    // Super admin → redirect to admin panel
    if (result.role === 'super_admin') {
      window.location.href = '../html/admin_panel.html';
      return;
    }

    // Redirect to the main dashboard
    window.location.href = 'landingpage.html';
  } catch (err) {
    console.error('Login error:', err);
    alert('Login failed: ' + (err.message || 'Unknown error'));
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Sign In <i data-lucide="arrow-right"></i>';
    if (window.lucide) lucide.createIcons();
  }
});
