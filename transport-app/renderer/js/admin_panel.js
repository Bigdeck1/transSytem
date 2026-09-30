/**
 * admin_panel.js — Super Admin Panel Controller
 * Manages user account approvals, diagnostics, gating settings, and security audits.
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────
  let allUsers = [];
  let pendingUsers = [];
  let currentTab = 'pending'; // 'pending' | 'all'
  let searchQuery = '';

  // ─── Simulated Security Audit Ledger ─────────────────────
  let auditLogs = [
    { time: '2026-05-20 08:42:12', actor: 'admin', event: 'User Account Approval', target: 'clarence@test.com', status: 'SUCCESS', node: '127.0.0.1 (Client Node)' },
    { time: '2026-05-20 08:35:55', actor: 'SYSTEM', event: 'SMTP Recovery Requested', target: 'driver3@jrr.com', status: 'SUCCESS', node: '192.168.1.10' },
    { time: '2026-05-20 08:14:02', actor: 'SYSTEM', event: 'Blocked Signup Attempt', target: 'spammer@malware.ru', status: 'FAILED', node: '185.220.101.4' },
    { time: '2026-05-20 08:08:44', actor: 'admin', event: 'Manual Email Verify', target: 'john.doe@jrr.com', status: 'SUCCESS', node: '127.0.0.1 (Client Node)' },
    { time: '2026-05-20 07:55:01', actor: 'SYSTEM', event: 'Failed Plaintext Login', target: 'legacy_admin', status: 'FAILED', node: '45.132.22.90' },
    { time: '2026-05-20 07:42:15', actor: 'SYSTEM', event: 'Email Verified Successfully', target: 'clarence@test.com', status: 'SUCCESS', node: '192.168.1.52' }
  ];

  // ─── XSS Protection ────────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  // ─── DOM References ────────────────────────────────────
  const DOM = {
    // Stats cards
    statTotal: document.getElementById('statTotal'),
    statPending: document.getElementById('statPending'),
    statApproved: document.getElementById('statApproved'),
    statRejected: document.getElementById('statRejected'),
    pendingCount: document.getElementById('pendingCount'),
    allCount: document.getElementById('allCount'),
    
    // User Table
    tableBody: document.getElementById('usersTableBody'),
    tableLoading: document.getElementById('tableLoading'),
    tableWrapper: document.getElementById('tableWrapper'),
    tableEmpty: document.getElementById('tableEmpty'),
    searchInput: document.getElementById('searchInput'),
    
    // Confirm modal
    confirmModal: document.getElementById('confirmModal'),
    confirmIcon: document.getElementById('confirmIcon'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmOk: document.getElementById('confirmOk'),
    confirmCancel: document.getElementById('confirmCancel'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    toastIcon: document.getElementById('toastIcon'),
    
    // System Monitor Simulation
    cpuText: document.getElementById('cpuUsageText'),
    cpuBar: document.getElementById('cpuUsageBar'),
    ramText: document.getElementById('ramUsageText'),
    ramBar: document.getElementById('ramUsageBar'),
    logConsole: document.getElementById('logConsole'),

    // Settings
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    setMandatoryVerify: document.getElementById('setMandatoryVerify'),
    setAdminApproval: document.getElementById('setAdminApproval'),
    setPlaintextFallback: document.getElementById('setPlaintextFallback'),

    // Audit logs
    auditSearchInput: document.getElementById('auditSearchInput'),
    auditTableBody: document.getElementById('auditTableBody'),
  };

  // ─── Toast Feedback ─────────────────────────────────────
  function showToast(message, type = 'success') {
    DOM.toast.className = 'toast visible ' + type;
    DOM.toastMessage.textContent = message;

    if (DOM.toastIcon) {
      DOM.toastIcon.setAttribute('data-lucide', type === 'success' ? 'check-circle' : 'alert-circle');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    setTimeout(() => {
      DOM.toast.classList.remove('visible');
    }, 3500);
  }

  // ─── Confirmation Modal ────────────────────────────────
  function showConfirm(action, username, userId) {
    const isApprove = action === 'approve' || action === 'verify';
    const isVerifyOnly = action === 'verify';

    DOM.confirmIcon.className = 'confirm-icon ' + (isApprove ? 'approve' : 'reject');
    DOM.confirmIcon.innerHTML = isApprove ? '✓' : '✕';
    
    if (isVerifyOnly) {
      DOM.confirmTitle.textContent = 'Verify User Email';
      DOM.confirmMessage.textContent = `Are you sure you want to manually verify the email for "${username}"?`;
      DOM.confirmOk.className = 'confirm-btn-ok approve';
      DOM.confirmOk.textContent = 'Verify';
    } else {
      DOM.confirmTitle.textContent = isApprove ? 'Approve User' : 'Reject User';
      DOM.confirmMessage.textContent = `Are you sure you want to ${action} the user "${username}"? This action will update their account status.`;
      DOM.confirmOk.className = 'confirm-btn-ok ' + (isApprove ? 'approve' : 'reject');
      DOM.confirmOk.textContent = isApprove ? 'Approve' : 'Reject';
    }

    DOM.confirmModal.classList.add('visible');

    // Reset handlers
    const newOk = DOM.confirmOk.cloneNode(true);
    DOM.confirmOk.parentNode.replaceChild(newOk, DOM.confirmOk);
    DOM.confirmOk = newOk;

    const newCancel = DOM.confirmCancel.cloneNode(true);
    DOM.confirmCancel.parentNode.replaceChild(newCancel, DOM.confirmCancel);
    DOM.confirmCancel = newCancel;

    DOM.confirmCancel.addEventListener('click', () => {
      DOM.confirmModal.classList.remove('visible');
    });

    DOM.confirmOk.addEventListener('click', async () => {
      DOM.confirmModal.classList.remove('visible');
      try {
        if (isVerifyOnly) {
          await window.api.admin.approveUser(userId); // Also marks email verified
          showToast(`Email for "${username}" has been manually verified.`, 'success');
          addSimulatedAuditLog('admin', 'Manual Email Verify', username, 'SUCCESS');
        } else if (action === 'approve') {
          await window.api.admin.approveUser(userId);
          showToast(`User "${username}" has been approved successfully.`, 'success');
          addSimulatedAuditLog('admin', 'Account Approval', username, 'SUCCESS');
        } else {
          await window.api.admin.rejectUser(userId);
          showToast(`User "${username}" has been rejected.`, 'error');
          addSimulatedAuditLog('admin', 'Account Rejection', username, 'SUCCESS');
        }
        await loadData();
      } catch (err) {
        console.error(`Failed to ${action} user:`, err);
        showToast(`Failed to ${action} user. Please try again.`, 'error');
        addSimulatedAuditLog('admin', `Failed ${action} attempt`, username, 'FAILED');
      }
    });
  }

  // ─── Render Stats ──────────────────────────────────────
  function renderStats() {
    const total = allUsers.length;
    const pending = allUsers.filter(u => u.status === 'pending').length;
    const approved = allUsers.filter(u => u.status === 'approved').length;
    const rejected = allUsers.filter(u => u.status === 'rejected').length;

    animateNumber(DOM.statTotal, total);
    animateNumber(DOM.statPending, pending);
    animateNumber(DOM.statApproved, approved);
    animateNumber(DOM.statRejected, rejected);

    DOM.pendingCount.textContent = pending;
    DOM.allCount.textContent = total;
  }

  function animateNumber(el, target) {
    const duration = 600;
    const start = parseInt(el.textContent) || 0;
    if (start === target) {
      el.textContent = target;
      return;
    }
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  // ─── Render Table ──────────────────────────────────────
  function renderTable() {
    const users = currentTab === 'pending' ? pendingUsers : allUsers;

    const filtered = users.filter(u => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.status || '').toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      DOM.tableBody.innerHTML = '';
      DOM.tableEmpty.style.display = 'block';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    DOM.tableEmpty.style.display = 'none';

    DOM.tableBody.innerHTML = filtered.map((user, index) => {
      const statusClass = (user.status || 'pending').toLowerCase();
      const isVerified = user.email_confirmed_at || user.email_verified;
      const isPending = statusClass === 'pending';

      return `
        <tr style="animation-delay: ${index * 0.04}s">
          <td>${escapeHtml(user.username || '—')}</td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>${escapeHtml(user.full_name || '—')}</td>
          <td>
            <span class="status-badge ${statusClass}">
              ${escapeHtml(user.status || 'pending')}
            </span>
          </td>
          <td>
            <span class="verified-icon ${isVerified ? 'yes' : 'no'}">
              <i data-lucide="${isVerified ? 'check' : 'x'}" size="16"></i>
            </span>
          </td>
          <td>
            <div class="action-btns">
              ${isPending ? `
                <button class="action-btn btn-approve" data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}">
                  <i data-lucide="check" size="14"></i>
                  Approve
                </button>
                <button class="action-btn btn-reject" data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}">
                  <i data-lucide="x" size="14"></i>
                  Reject
                </button>
              ` : ''}
              ${(!isVerified && !isPending) ? `
                <button class="action-btn btn-approve btn-verify-email" data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}">
                  <i data-lucide="mail" size="14"></i>
                  Verify Email
                </button>
              ` : ''}
              ${(isVerified && !isPending) ? `<span class="no-action">No actions</span>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Bind action buttons
    DOM.tableBody.querySelectorAll('.btn-approve:not(.btn-verify-email)').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm('approve', btn.dataset.username, btn.dataset.userId);
      });
    });

    DOM.tableBody.querySelectorAll('.btn-verify-email').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm('verify', btn.dataset.username, btn.dataset.userId);
      });
    });

    DOM.tableBody.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm('reject', btn.dataset.username, btn.dataset.userId);
      });
    });
  }

  // ─── Data Loading ──────────────────────────────────────
  async function loadData() {
    DOM.tableLoading.style.display = 'block';
    DOM.tableWrapper.style.display = 'none';

    try {
      const [allResult, pendingResult] = await Promise.all([
        window.api.admin.getAllUsers(),
        window.api.admin.getPendingUsers()
      ]);

      const rawAll = (allResult && allResult.success && Array.isArray(allResult.data)) ? allResult.data : [];
      const rawPending = (pendingResult && pendingResult.success && Array.isArray(pendingResult.data)) ? pendingResult.data : [];

      function normalize(user) {
        return {
          ...user,
          status: user.account_status || user.status || 'pending',
          full_name: user.full_name || [user.firstname, user.lastname].filter(Boolean).join(' ') || '—',
        };
      }

      allUsers = rawAll.map(normalize);
      pendingUsers = rawPending.map(normalize);

      renderStats();
      renderTable();
    } catch (err) {
      console.error('❌ Failed to load admin data:', err);
      allUsers = [];
      pendingUsers = [];
      renderStats();
      renderTable();
      showToast('Failed to load user data. Please check connection.', 'error');
    }

    DOM.tableLoading.style.display = 'none';
    DOM.tableWrapper.style.display = 'block';
  }

  // ─── Tab Switching ─────────────────────────────────────
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderTable();
      });
    });
  }

  // ─── Search ────────────────────────────────────────────
  function initSearch() {
    let debounceTimer;
    DOM.searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        renderTable();
      }, 250);
    });
  }

  // initLogout removed as logout is now handled globally by sidebar.js

  // ─── Close modal on backdrop click ─────────────────────
  function initModalBackdrop() {
    DOM.confirmModal.addEventListener('click', (e) => {
      if (e.target === DOM.confirmModal) {
        DOM.confirmModal.classList.remove('visible');
      }
    });
  }

  // ─── Sidebar Views Navigation Swapping ───────────────────
  function initSidebarViews() {
    const menuItems = document.querySelectorAll('#menu-list li a[data-view]');
    const views = document.querySelectorAll('.admin-view');

    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        
        const targetView = item.dataset.view;
        if (!targetView) return;

        // Toggle Sidebar Active Class
        menuItems.forEach(mi => mi.classList.remove('active'));
        item.classList.add('active');

        // Swap Content panels
        views.forEach(view => {
          view.style.display = 'none';
          view.classList.remove('active');
        });

        const activeView = document.getElementById(`view-${targetView}`);
        if (activeView) {
          activeView.style.display = 'block';
          activeView.offsetHeight; // Force reflow
          activeView.classList.add('active');
        }

        // View Specific Inits
        if (targetView === 'monitor') {
          startMonitorSimulation();
        } else {
          stopMonitorSimulation();
        }

        if (targetView === 'audit') {
          renderAuditLogs();
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    });
  }

  // ─── System Monitor Simulation ──────────────────────────
  let monitorInterval = null;
  let logInterval = null;

  const simulatedLogMessages = [
    { tag: 'INFO', text: 'Supabase DB Pool validated connection handshake.' },
    { tag: 'SUCCESS', text: 'IPC channel "admin:getAllUsers" invoked successfully.' },
    { tag: 'WARN', text: 'Rate limiter warning: Client IP 192.168.1.18 reached 4 login attempts.' },
    { tag: 'SUCCESS', text: 'Nodemailer SMTP Relay successfully delivered email token.' },
    { tag: 'INFO', text: 'Edge worker security context validated.' },
    { tag: 'ERROR', text: 'Authentication failed for driver@jrr.com (plain fallback gated).' },
    { tag: 'INFO', text: 'Garbage collection completed. Liberated 180MB RAM.' },
    { tag: 'SUCCESS', text: 'Gating configurations saved successfully by administrator.' }
  ];

  function startMonitorSimulation() {
    if (monitorInterval) return;

    // CPU & RAM random flucutation
    monitorInterval = setInterval(() => {
      const cpu = Math.floor(Math.random() * 11) + 4; // 4% - 15%
      const ramGB = (Math.random() * 0.2 + 1.1).toFixed(1); // 1.1 - 1.3
      const ramPct = Math.round((parseFloat(ramGB) / 8.0) * 100);

      if (DOM.cpuText) DOM.cpuText.textContent = `${cpu}%`;
      if (DOM.cpuBar) DOM.cpuBar.style.width = `${cpu}%`;

      if (DOM.ramText) DOM.ramText.textContent = `${ramGB} GB / 8.0 GB (${ramPct}%)`;
      if (DOM.ramBar) DOM.ramBar.style.width = `${ramPct}%`;
    }, 2000);

    // Initial logs fill
    if (DOM.logConsole && DOM.logConsole.children.length === 0) {
      for (let i = 0; i < 5; i++) {
        appendSimulatedLog();
      }
    }

    // Dynamic log stream
    logInterval = setInterval(() => {
      appendSimulatedLog();
    }, 4500);
  }

  function stopMonitorSimulation() {
    clearInterval(monitorInterval);
    clearInterval(logInterval);
    monitorInterval = null;
    logInterval = null;
  }

  function appendSimulatedLog() {
    if (!DOM.logConsole) return;

    const time = new Date().toLocaleTimeString();
    const msgObj = simulatedLogMessages[Math.floor(Math.random() * simulatedLogMessages.length)];

    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `
      <span class="timestamp">[${time}]</span>
      <span class="tag ${msgObj.tag.toLowerCase()}">[${msgObj.tag}]</span>
      <span>${escapeHtml(msgObj.text)}</span>
    `;

    DOM.logConsole.appendChild(div);
    DOM.logConsole.scrollTop = DOM.logConsole.scrollHeight;

    // Keep console to 50 rows
    if (DOM.logConsole.children.length > 50) {
      DOM.logConsole.removeChild(DOM.logConsole.firstChild);
    }
  }

  // ─── Settings tab configurations ──────────────────────────
  function initSettings() {
    if (!DOM.saveSettingsBtn) return;

    // Load initial switches
    const gatingConfig = JSON.parse(localStorage.getItem('admin_gatings') || '{"verify": true, "approve": true, "fallback": true, "lockout": "5"}');

    if (DOM.setMandatoryVerify) DOM.setMandatoryVerify.checked = gatingConfig.verify;
    if (DOM.setAdminApproval) DOM.setAdminApproval.checked = gatingConfig.approve;
    if (DOM.setPlaintextFallback) DOM.setPlaintextFallback.checked = gatingConfig.fallback;

    const lockoutSelect = document.getElementById('setLockoutAttempts');
    if (lockoutSelect) lockoutSelect.value = gatingConfig.lockout;

    DOM.saveSettingsBtn.addEventListener('click', () => {
      const config = {
        verify: DOM.setMandatoryVerify ? DOM.setMandatoryVerify.checked : true,
        approve: DOM.setAdminApproval ? DOM.setAdminApproval.checked : true,
        fallback: DOM.setPlaintextFallback ? DOM.setPlaintextFallback.checked : true,
        lockout: lockoutSelect ? lockoutSelect.value : "5"
      };

      localStorage.setItem('admin_gatings', JSON.stringify(config));
      showToast('Gating configurations saved successfully!', 'success');

      addSimulatedAuditLog('admin', 'Gating Update', 'Settings parameters modified', 'SUCCESS');
    });
  }

  // ─── Populate Super Admin Profile from Session ───────────
  function populateAdminProfile() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const emailEl = document.getElementById('superAdminEmail');
        if (emailEl && user.email) {
          emailEl.textContent = user.email;
        }
      } catch (e) {
        console.error('Failed to parse user session:', e);
      }
    }
  }

  // ─── Security Audit ledger logs ───────────────────────────
  function addSimulatedAuditLog(actor, event, target, status) {
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);
    auditLogs.unshift({
      time,
      actor,
      event,
      target,
      status,
      node: '127.0.0.1 (Client Node)'
    });
  }

  function renderAuditLogs() {
    if (!DOM.auditTableBody) return;

    const query = DOM.auditSearchInput ? DOM.auditSearchInput.value.trim().toLowerCase() : '';
    const filtered = auditLogs.filter(log => {
      if (!query) return true;
      return (
        log.actor.toLowerCase().includes(query) ||
        log.event.toLowerCase().includes(query) ||
        log.target.toLowerCase().includes(query) ||
        log.status.toLowerCase().includes(query)
      );
    });

    DOM.auditTableBody.innerHTML = filtered.map(log => {
      const statusClass = log.status.toLowerCase();
      return `
        <tr>
          <td style="color: var(--text-muted); font-family: monospace;">${escapeHtml(log.time)}</td>
          <td class="actor">${escapeHtml(log.actor)}</td>
          <td class="event">${escapeHtml(log.event)}</td>
          <td>${escapeHtml(log.target)}</td>
          <td>
            <span class="audit-badge-status ${statusClass}">
              ${escapeHtml(log.status)}
            </span>
          </td>
          <td style="color: var(--text-light); font-size: 12.5px;">${escapeHtml(log.node)}</td>
        </tr>
      `;
    }).join('');
  }

  function initAuditLogs() {
    if (!DOM.auditSearchInput) return;
    DOM.auditSearchInput.addEventListener('input', () => {
      renderAuditLogs();
    });
  }

  // ─── Initialization ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSearch();
    initModalBackdrop();
    initSidebarViews();
    initSettings();
    initAuditLogs();
    populateAdminProfile();
    loadData();
  });
})();
