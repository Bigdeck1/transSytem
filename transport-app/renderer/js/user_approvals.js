/**
 * user_approvals.js — Admin User Approval Controller
 * Manages user account approvals, rejections, and email verifications.
 * This is the admin-facing version (transferred from super admin panel).
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────
  let allUsers = [];
  let pendingUsers = [];
  let currentTab = 'pending'; // 'pending' | 'all'
  let searchQuery = '';

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
          await window.api.admin.approveUser(userId);
          showToast(`Email for "${username}" has been manually verified.`, 'success');
        } else if (action === 'approve') {
          await window.api.admin.approveUser(userId);
          showToast(`User "${username}" has been approved successfully.`, 'success');
        } else {
          await window.api.admin.rejectUser(userId);
          showToast(`User "${username}" has been rejected.`, 'error');
        }
        await loadData();
      } catch (err) {
        console.error(`Failed to ${action} user:`, err);
        showToast(`Failed to ${action} user. Please try again.`, 'error');
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
      const eased = 1 - Math.pow(1 - progress, 3);
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

    // Admin can assign roles but NOT super_admin
    const roleOptions = [
      { value: 'admin', label: 'Admin (Operations)' },
      { value: 'dispatcher', label: 'Hauling Dispatcher' },
      { value: 'rental_manager', label: 'Rental Manager' },
      { value: 'billing_clerk', label: 'Billing Clerk' },
      { value: 'driver', label: 'Driver' },
      { value: 'user', label: 'User' }
    ];

    DOM.tableBody.innerHTML = filtered.map((user, index) => {
      const statusClass = (user.status || 'pending').toLowerCase();
      const isVerified = user.email_confirmed_at || user.email_verified;
      const isPending = statusClass === 'pending';
      const currentRole = user.role || 'user';

      const roleOptionsHtml = roleOptions.map(r => 
        `<option value="${r.value}" ${currentRole === r.value ? 'selected' : ''}>${r.label}</option>`
      ).join('');

      return `
        <tr style="animation-delay: ${index * 0.04}s">
          <td style="font-weight: 600;">${escapeHtml(user.username || '—')}</td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>${escapeHtml(user.full_name || '—')}</td>
          <td>
            <select class="role-select-input" data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}" style="background: var(--bg-elevated, #0f172a); border: 1px solid var(--border, #334155); border-radius: 6px; padding: 4px 8px; color: var(--primary, #60a5fa); font-size: 12px; font-weight: 600; outline: none;">
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
      console.error('❌ Failed to load user data:', err);
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

  // ─── Close modal on backdrop click ─────────────────────
  function initModalBackdrop() {
    DOM.confirmModal.addEventListener('click', (e) => {
      if (e.target === DOM.confirmModal) {
        DOM.confirmModal.classList.remove('visible');
      }
    });
  }

  // ─── Highlight active sidebar link ─────────────────────
  function highlightSidebarLink() {
    const approvalLink = document.querySelector('#admin-user-approvals-link a');
    if (approvalLink) {
      approvalLink.classList.add('active');
    }
  }

  // ─── Initialization ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSearch();
    initModalBackdrop();
    loadData();

    // Wait briefly for sidebar.js to inject the User Approvals link
    setTimeout(highlightSidebarLink, 100);
  });
})();
