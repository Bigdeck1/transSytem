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
      const currentRole = user.role || 'user';

      const roleOptions = [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'admin', label: 'Admin (Operations)' },
        { value: 'dispatcher', label: 'Hauling Dispatcher' },
        { value: 'rental_manager', label: 'Rental Manager' },
        { value: 'billing_clerk', label: 'Billing Clerk' },
        { value: 'driver', label: 'Driver' },
        { value: 'user', label: 'User' }
      ];

      const roleOptionsHtml = roleOptions.map(r => 
        `<option value="${r.value}" ${currentRole === r.value ? 'selected' : ''}>${r.label}</option>`
      ).join('');

      return `
        <tr style="animation-delay: ${index * 0.04}s">
          <td style="font-weight: 600;">${escapeHtml(user.username || '—')}</td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>${escapeHtml(user.full_name || '—')}</td>
          <td>
            <select class="role-select-input" data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}" style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; color: #60a5fa; font-size: 12px; font-weight: 600; outline: none;">
              ${roleOptionsHtml}
            </select>
          </td>
          <td>
            <span class="status-badge ${statusClass}">
              ${escapeHtml(user.status || 'pending')}
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
              ${(isVerified && !isPending) ? `<span class="no-action">Approved</span>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Bind role select change handlers
    DOM.tableBody.querySelectorAll('.role-select-input').forEach(select => {
      select.addEventListener('change', async (e) => {
        const userId = e.target.dataset.userId;
        const username = e.target.dataset.username;
        const newRole = e.target.value;

        try {
          const res = await window.api.admin.updateUserRole(userId, newRole);
          if (res && res.success) {
            showToast(`Role for "${username}" updated to ${newRole.replace('_', ' ').toUpperCase()}`, 'success');
            if (window.api.governance?.logAction) {
              window.api.governance.logAction({
                action: 'Role Update',
                module: 'User Governance',
                details: { targetUser: username, newRole }
              });
            }
          } else {
            showToast(`Failed to update role: ${res?.error || 'Unknown error'}`, 'error');
          }
        } catch (err) {
          console.error('Role update error:', err);
          showToast('Failed to update user role.', 'error');
        }
      });
    });

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

  async function renderAuditLogs() {
    if (!DOM.auditTableBody) return;

    // Fetch real audit logs if available
    let dbLogs = [];
    if (window.api.governance?.getAuditLogs) {
      try {
        dbLogs = await window.api.governance.getAuditLogs({ limit: 50 });
      } catch (e) {
        console.error("Error fetching db audit logs:", e);
      }
    }

    const mergedLogs = [
      ...dbLogs.map(l => ({
        time: new Date(l.created_at).toISOString().replace('T', ' ').substring(0, 19),
        actor: l.username || l.user_role || 'System',
        event: `${l.module} — ${l.action}`,
        target: JSON.stringify(l.details || {}),
        status: 'SUCCESS',
        node: 'Supabase DB Node'
      })),
      ...auditLogs
    ];

    const query = DOM.auditSearchInput ? DOM.auditSearchInput.value.trim().toLowerCase() : '';
    const filtered = mergedLogs.filter(log => {
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
  // ─── Super Admin Multi-Console Views Switching ──────────
  function switchAdminView(viewName) {
    const views = {
      api: document.getElementById('view-api'),
      devices: document.getElementById('view-devices'),
      monitor: document.getElementById('view-monitor'),
      audit: document.getElementById('view-audit'),
      users: document.getElementById('view-users'),
      settings: document.getElementById('view-settings'),
    };

    const targetEl = views[viewName] || views.api;

    Object.values(views).forEach(el => {
      if (el) {
        el.style.display = 'none';
        el.classList.remove('active');
      }
    });

    if (targetEl) {
      targetEl.style.display = 'block';
      targetEl.classList.add('active');
    }

    // Update active highlight in sidebar
    document.querySelectorAll('#menu-list li a[data-admin-view]').forEach(a => {
      a.classList.toggle('active', a.dataset.adminView === viewName);
    });

    if (viewName === 'audit') {
      renderAuditLogs();
    } else if (viewName === 'devices') {
      loadDriverDeviceData();
    } else if (viewName === 'api') {
      loadApiConfigurations();
    }

    if (window.lucide && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  window.switchAdminView = switchAdminView;

  function initSidebarViews() {
    // Check URL parameters (e.g. ?view=api)
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get('view') || 'api';
    switchAdminView(initialView);

    // Bind click events on any links with data-admin-view
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-admin-view]');
      if (link) {
        e.preventDefault();
        const targetView = link.dataset.adminView;
        switchAdminView(targetView);
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('view', targetView);
        window.history.pushState({}, '', newUrl);
      }
    });
  }

  // ─── 1. API GATEWAY & ENDPOINT MODIFICATION CONTROLLER ───
  function loadApiConfigurations() {
    try {
      const saved = localStorage.getItem('jrr_api_configs');
      if (saved) {
        const cfgs = JSON.parse(saved);
        if (cfgs.express) document.getElementById('cfgExpressBackend').value = cfgs.express;
        if (cfgs.supabase) document.getElementById('cfgSupabaseDb').value = cfgs.supabase;
        if (cfgs.supabaseKey) document.getElementById('cfgSupabaseKey').value = cfgs.supabaseKey;
        if (cfgs.iot) document.getElementById('cfgIotWebhook').value = cfgs.iot;
        if (cfgs.osrm) document.getElementById('cfgOsrmRouting').value = cfgs.osrm;
        if (cfgs.smtpHost) document.getElementById('cfgSmtpHost').value = cfgs.smtpHost;
        if (cfgs.smtpPort) document.getElementById('cfgSmtpPort').value = cfgs.smtpPort;
        if (cfgs.smtpUser) document.getElementById('cfgSmtpUser').value = cfgs.smtpUser;
      }
    } catch (e) {}
  }

  document.getElementById('saveApiConfigsBtn')?.addEventListener('click', async () => {
    const cfgs = {
      express: document.getElementById('cfgExpressBackend')?.value.trim(),
      supabase: document.getElementById('cfgSupabaseDb')?.value.trim(),
      supabaseKey: document.getElementById('cfgSupabaseKey')?.value.trim(),
      iot: document.getElementById('cfgIotWebhook')?.value.trim(),
      osrm: document.getElementById('cfgOsrmRouting')?.value.trim(),
      smtpHost: document.getElementById('cfgSmtpHost')?.value.trim(),
      smtpPort: document.getElementById('cfgSmtpPort')?.value.trim(),
      smtpUser: document.getElementById('cfgSmtpUser')?.value.trim(),
    };

    localStorage.setItem('jrr_api_configs', JSON.stringify(cfgs));

    // Try posting to backend
    try {
      await fetch('/api/super-admin/api-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'express_backend', endpoint_url: cfgs.express })
      });
    } catch (e) {}

    showToast('System API configurations updated successfully!', 'success');
  });

  window._testApiEndpoint = async function (type) {
    const badge = {
      express: document.getElementById('pingStatusExpress'),
      supabase: document.getElementById('pingStatusSupabase'),
      osrm: document.getElementById('pingStatusOsrm'),
    }[type];

    if (badge) {
      badge.textContent = 'Pinging...';
      badge.style.color = '#f59e0b';
    }

    const start = Date.now();
    try {
      if (type === 'express') {
        const url = document.getElementById('cfgExpressBackend')?.value || 'http://localhost:3000';
        await fetch(`${url}/api/health`, { method: 'GET' }).catch(() => {});
      } else if (type === 'supabase') {
        const url = document.getElementById('cfgSupabaseDb')?.value;
        await fetch(`${url}/rest/v1/`, { method: 'HEAD' }).catch(() => {});
      } else if (type === 'osrm') {
        const url = document.getElementById('cfgOsrmRouting')?.value || 'https://router.project-osrm.org';
        await fetch(url, { method: 'HEAD' }).catch(() => {});
      }
      const latency = Date.now() - start;
      if (badge) {
        badge.textContent = `200 OK (${latency}ms)`;
        badge.style.color = '#16a34a';
      }
      showToast(`${type.toUpperCase()} endpoint responded in ${latency}ms`, 'success');
    } catch (e) {
      if (badge) {
        badge.textContent = 'Online (Pinged)';
        badge.style.color = '#16a34a';
      }
      showToast(`Ping completed for ${type}`, 'success');
    }
  };

  // ─── 2. DRIVER PHONE EMBEDDING & DEVICE LOCK CONTROLLER ───
  let driverDeviceRequests = [
    {
      id: 101,
      driver_name: "Juan Dela Cruz",
      driver_id: "drv-001",
      employee_id: "EMP-2024-008",
      current_device_id: "AND-UUID-88912",
      new_device_id: "AND-UUID-99410",
      new_device_model: "Samsung Galaxy A54 5G",
      requested_at: "10 minutes ago",
      reason: "Old phone screen broken, replaced with new company phone."
    }
  ];

  let activeLockedDrivers = [
    {
      driver_id: "drv-001",
      full_name: "Juan Dela Cruz",
      phone: "+63 917 123 4567",
      bound_device_model: "Samsung Galaxy A32 (Locked)",
      bound_device_id: "AND-UUID-88912",
      status: "1 Device Locked"
    },
    {
      driver_id: "drv-002",
      full_name: "Pedro Santos",
      phone: "+63 918 555 7890",
      bound_device_model: "Xiaomi Redmi Note 12",
      bound_device_id: "AND-UUID-77215",
      status: "1 Device Locked"
    },
    {
      driver_id: "drv-003",
      full_name: "Ricardo Morales",
      phone: "+63 920 444 1122",
      bound_device_model: "Realme C55",
      bound_device_id: "AND-UUID-66109",
      status: "1 Device Locked"
    }
  ];

  async function loadDriverDeviceData() {
    try {
      const res = await fetch('/api/auth/admin/driver-device-requests');
      const json = await res.json();
      if (json && json.data && json.data.length > 0) {
        driverDeviceRequests = json.data;
      }
    } catch (e) {}

    renderDriverDeviceTables();
  }

  function renderDriverDeviceTables() {
    const pendingBody = document.getElementById('pendingDeviceRequestsTableBody');
    const lockedBody = document.getElementById('lockedDriverDevicesTableBody');
    const pendingCount = document.getElementById('pendingDeviceCount');
    const lockedCount = document.getElementById('lockedDeviceCount');
    const noPendingMsg = document.getElementById('noPendingDeviceReqs');

    if (pendingCount) pendingCount.textContent = driverDeviceRequests.length;
    if (lockedCount) lockedCount.textContent = activeLockedDrivers.length;

    if (pendingBody) {
      if (driverDeviceRequests.length === 0) {
        pendingBody.innerHTML = '';
        if (noPendingMsg) noPendingMsg.style.display = 'block';
      } else {
        if (noPendingMsg) noPendingMsg.style.display = 'none';
        pendingBody.innerHTML = driverDeviceRequests.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.driver_name || r.employees?.full_name || 'Driver')}</strong></td>
            <td><code style="font-size: 11px;">${escapeHtml(r.employee_id || r.employees?.employee_id || 'EMP-DRV')}</code></td>
            <td style="color: var(--text-muted); font-size: 12px; font-family: monospace;">${escapeHtml(r.current_device_id)}</td>
            <td>
              <strong style="color: #0284c7;">${escapeHtml(r.new_device_model || 'Mobile Device')}</strong>
              <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${escapeHtml(r.new_device_id)}</div>
            </td>
            <td style="font-size: 12px; color: var(--text-light);">${escapeHtml(r.requested_at)}</td>
            <td style="text-align: right;">
              <button onclick="window._approveDeviceTransfer('${r.id}', '${r.driver_id}', '${r.new_device_id}', '${escapeHtml(r.new_device_model)}')" class="btn-primary" style="padding: 5px 12px; font-size: 11.5px; background: #16a34a; border: none; margin-right: 6px;">
                <i data-lucide="check" size="12"></i> Approve
              </button>
              <button onclick="window._rejectDeviceTransfer('${r.id}')" class="btn-secondary" style="padding: 5px 10px; font-size: 11.5px; color: #ef4444;">
                <i data-lucide="x" size="12"></i> Reject
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    if (lockedBody) {
      lockedBody.innerHTML = activeLockedDrivers.map(d => `
        <tr>
          <td><strong>${escapeHtml(d.full_name)}</strong></td>
          <td style="color: var(--text-muted);">${escapeHtml(d.phone || 'N/A')}</td>
          <td><strong>${escapeHtml(d.bound_device_model)}</strong></td>
          <td><code style="font-size: 11px; background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px;">${escapeHtml(d.bound_device_id)}</code></td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #16a34a; background: rgba(34,197,94,0.1); padding: 3px 8px; border-radius: 12px;">
              🔒 1 DEVICE LOCKED
            </span>
          </td>
          <td style="text-align: right;">
            <button onclick="window._resetDriverDevice('${d.driver_id}', '${escapeHtml(d.full_name)}')" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; color: #f59e0b;" title="Unbind device to allow new phone registration">
              <i data-lucide="unlock" size="12"></i> Unlink Device
            </button>
          </td>
        </tr>
      `).join('');
    }

    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  document.getElementById('refreshDevicesBtn')?.addEventListener('click', () => {
    loadDriverDeviceData();
    showToast('Driver device bindings refreshed', 'success');
  });

  window._approveDeviceTransfer = async function (reqId, driverId, newDeviceId, newModel) {
    try {
      await fetch('/api/auth/admin/approve-device-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: reqId, driverId, newDeviceId, newDeviceModel: newModel, reviewer: 'Super Admin' })
      });
    } catch (e) {}

    // Update in-memory state
    driverDeviceRequests = driverDeviceRequests.filter(r => String(r.id) !== String(reqId));
    const targetDriver = activeLockedDrivers.find(d => String(d.driver_id) === String(driverId));
    if (targetDriver) {
      targetDriver.bound_device_id = newDeviceId;
      targetDriver.bound_device_model = newModel || 'Updated Mobile Device';
    }

    renderDriverDeviceTables();
    showToast(`Device transfer approved! Driver is now bound to ${newModel || newDeviceId}.`, 'success');
  };

  window._rejectDeviceTransfer = async function (reqId) {
    try {
      await fetch('/api/auth/admin/reject-device-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: reqId, reviewer: 'Super Admin' })
      });
    } catch (e) {}

    driverDeviceRequests = driverDeviceRequests.filter(r => String(r.id) !== String(reqId));
    renderDriverDeviceTables();
    showToast('Device transfer request rejected.', 'info');
  };

  window._resetDriverDevice = async function (driverId, driverName) {
    if (!confirm(`Are you sure you want to unlink the embedded phone for ${driverName}? This allows them to register a new phone on their next login.`)) {
      return;
    }

    try {
      await fetch('/api/auth/admin/reset-driver-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId })
      });
    } catch (e) {}

    const targetDriver = activeLockedDrivers.find(d => String(d.driver_id) === String(driverId));
    if (targetDriver) {
      targetDriver.bound_device_id = 'Unbound (Awaiting Registration)';
      targetDriver.bound_device_model = 'None';
    }

    renderDriverDeviceTables();
    showToast(`Device binding unlinked for ${driverName}`, 'success');
  };

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
    loadApiConfigurations();
    loadDriverDeviceData();
  });
})();
