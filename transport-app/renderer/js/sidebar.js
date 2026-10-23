function initSidebar() {
    // ============================
    // Ensure SIDEBAR_PATHS is loaded
    // ============================
    if (typeof SIDEBAR_PATHS === "undefined") {
        console.warn("SIDEBAR_PATHS is NOT loaded before sidebar.js. Navigation may be limited.");
    }

    // ============================
    // DYNAMIC SUPER ADMIN LINK & USER PROFILE SYNC
    // ============================
    const currentPage = window.location.pathname.split("/").pop();
    let isSuperAdmin = false;
    let currentUser = null;
    try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            currentUser = JSON.parse(userStr);
            if (currentUser && currentUser.role === "super_admin") {
                isSuperAdmin = true;
            }
        }
    } catch (e) {
        console.error("Failed to check user role in sidebar.js:", e);
    }

    // Role-based sidebar menu items
    const menuList = document.getElementById("menu-list");
    if (menuList) {
        if (isSuperAdmin) {
            // For Super Admin on operational pages: prepend IT & GOVERNANCE menu items
            if (currentPage !== "admin_panel.html" && !document.getElementById("super-admin-nav-group")) {
                const navContainer = document.createElement("div");
                navContainer.id = "super-admin-nav-group";
                navContainer.innerHTML = `
                    <li class="sidebar-section-header"><span>IT & GOVERNANCE</span></li>
                    <li><a href="admin_panel.html?view=api" class="super-admin-link" title="API Gateway & Endpoint Modification"><i data-lucide="webhook"></i><span>API Modification</span></a></li>
                    <li><a href="admin_panel.html?view=devices" class="super-admin-link" title="Driver Phone Embedding & 1-Device Lock"><i data-lucide="smartphone"></i><span>Driver Device Lock</span></a></li>
                    <li><a href="admin_panel.html?view=monitor" class="super-admin-link" title="System Infrastructure Health"><i data-lucide="cpu"></i><span>System Diagnostics</span></a></li>
                    <li><a href="admin_panel.html?view=audit" class="super-admin-link" title="Administrative & Security Audit Trail"><i data-lucide="scroll-text"></i><span>Audit Trail</span></a></li>
                    <li><a href="admin_panel.html?view=users" class="super-admin-link" title="User Management & Role Approvals"><i data-lucide="users"></i><span>User Approvals</span></a></li>
                    <li class="sidebar-section-header" style="margin-top: 8px;"><span>OPERATIONS</span></li>
                `;
                while (navContainer.firstChild) {
                    menuList.insertBefore(navContainer.firstChild, menuList.firstChild);
                }
            }
        } else {
            // For Regular Admin: Strip any Super Admin links or headers
            document.querySelectorAll(".super-admin-link, #super-admin-nav-item, #super-admin-nav-group").forEach(el => el.remove());
        }
    }

    // Update user info display in footer for admin and super admin
    if (currentUser) {
        const nameEl = document.querySelector(".admin-text .name");
        const emailEl = document.querySelector(".admin-text .email");
        const avatarEl = document.querySelector(".admin-avatar");

        if (isSuperAdmin) {
            if (nameEl) nameEl.textContent = currentUser.full_name || "Super Admin";
            if (emailEl && currentUser.email) emailEl.textContent = currentUser.email;
            if (avatarEl) avatarEl.textContent = "SA";
        } else {
            if (nameEl) nameEl.textContent = currentUser.full_name || "Administrator";
            if (emailEl && currentUser.email) emailEl.textContent = currentUser.email;
            if (avatarEl) avatarEl.textContent = currentUser.full_name ? currentUser.full_name.substring(0, 2).toUpperCase() : "AD";
        }
    }

    // Ensure all menu links have tooltip titles for collapsed mode
    document.querySelectorAll("#menu-list li a").forEach(a => {
        const span = a.querySelector("span");
        if (span && !a.getAttribute("title")) {
            a.setAttribute("title", span.textContent.trim());
        }
    });

    // ============================
    // INJECT LOGOUT MODAL
    // ============================
    function injectLogoutModal() {
        if (document.getElementById("logout-modal")) return;

        const modalHtml = `
            <div id="logout-modal" class="logout-modal">
                <div class="logout-modal-content">
                    <div class="logout-icon-container">
                        <i data-lucide="log-out" size="26"></i>
                    </div>
                    <h3>Sign Out</h3>
                    <p>Are you sure you want to log out of the system? You will need to enter your credentials again to access your account.</p>
                    <div class="logout-actions">
                        <button class="logout-btn-cancel" id="logout-cancel">Cancel</button>
                        <button class="logout-btn-confirm" id="logout-confirm">Sign Out</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", modalHtml);

        // Re-run lucide for the new icon
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        // Modal Listeners
        document.getElementById("logout-cancel").addEventListener("click", hideLogoutModal);
        document.getElementById("logout-confirm").addEventListener("click", performLogout);

        // Close on backdrop click
        document.getElementById("logout-modal").addEventListener("click", (e) => {
            if (e.target.id === "logout-modal") hideLogoutModal();
        });
    }

    function showLogoutModal() {
        injectLogoutModal();
        const modal = document.getElementById("logout-modal");
        if (modal) {
            modal.style.display = "flex";
            modal.classList.add("visible");
        }
    }

    function hideLogoutModal() {
        const modal = document.getElementById("logout-modal");
        if (modal) {
            modal.classList.remove("visible");
            modal.style.display = "none";
        }
    }

    function performLogout() {
        console.log("Logging out...");
        localStorage.removeItem("user");
        sessionStorage.clear();

        const currentPath = window.location.pathname;
        if (currentPath.includes("/renderer/html/")) {
            window.location.replace("index.html");
        } else {
            window.location.replace("../html/index.html");
        }
    }

    // ============================
    // PAGE NAVIGATION
    // ============================
    document.querySelectorAll("#menu-list li[data-page]").forEach(item => {
        item.addEventListener("click", () => {
            if (typeof SIDEBAR_PATHS === "undefined") return;

            const pageKey = item.dataset.page;
            const targetPath = SIDEBAR_PATHS[pageKey];

            if (!targetPath) {
                console.error("No path found for:", pageKey);
                return;
            }

            window.location.href = targetPath;
        });
    });

    // ============================
    // ACTIVE PAGE HIGHLIGHT
    // ============================
    if (typeof SIDEBAR_PATHS !== "undefined") {
        Object.entries(SIDEBAR_PATHS).forEach(([key, path]) => {
            if (currentPage === path.split("/").pop()) {
                const activeItem = document.querySelector(`#menu-list li[data-page="${key}"]`);
                if (activeItem) {
                    document.querySelectorAll("#menu-list li a").forEach(a => a.classList.remove("active"));
                    const anchor = activeItem.querySelector("a");
                    if (anchor) anchor.classList.add("active");
                    else activeItem.classList.add("active");
                }
            }
        });
    }

    // If on admin_panel.html and super admin item exists, make it active
    if (currentPage === "admin_panel.html") {
        const superAdminAnchor = document.querySelector("#super-admin-nav-item a");
        if (superAdminAnchor) {
            superAdminAnchor.classList.add("active");
        }
    }

    // ============================
    // LOGOUT BUTTON
    // ============================
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showLogoutModal();
        });
    }

    // ============================
    // ICONS INIT
    // ============================
    if (typeof lucide !== "undefined" && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Run immediately if DOM is already parsed, otherwise wait for DOMContentLoaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar);
} else {
    initSidebar();
}
