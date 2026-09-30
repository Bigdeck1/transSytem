function initSidebar() {
    // ============================
    // Ensure SIDEBAR_PATHS is loaded
    // ============================
    if (typeof SIDEBAR_PATHS === "undefined") {
        console.warn(" SIDEBAR_PATHS is NOT loaded before sidebar.js. Navigation may be limited.");
    }

    // ============================
    // DYNAMIC SUPER ADMIN LINK FOR SUPER ADMINS
    // ============================
    const currentPage = window.location.pathname.split("/").pop();
    let isSuperAdmin = false;
    try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.role === "super_admin") {
                isSuperAdmin = true;
            }
        }
    } catch (e) {
        console.error("Failed to check user role in sidebar.js:", e);
    }

    if (isSuperAdmin && currentPage !== "admin_panel.html") {
        const menuList = document.getElementById("menu-list");
        if (menuList && !document.getElementById("super-admin-nav-item")) {
            const superAdminItem = document.createElement("li");
            superAdminItem.id = "super-admin-nav-item";
            superAdminItem.innerHTML = `
                <a href="admin_panel.html" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; font-weight: 700; border-left: 4px solid #3b82f6; display: flex; align-items: center; gap: 14px; padding: 14px 20px; text-decoration: none; border-radius: 16px; font-size: 14px; transition: all 0.3s ease;">
                    <i data-lucide="shield-alert" style="color: #3b82f6; width: 20px;"></i>
                    <span>Super Admin Console</span>
                </a>
            `;
            menuList.insertBefore(superAdminItem, menuList.firstChild);
        }
    }

    // ============================
    // INJECT LOGOUT MODAL
    // ============================
    function injectLogoutModal() {
        if (document.getElementById("logout-modal")) return;

        const modalHtml = `
            <div id="logout-modal" class="logout-modal">
                <div class="logout-modal-content">
                    <div class="logout-icon-container">
                        <i data-lucide="log-out" size="32"></i>
                    </div>
                    <h3>Sign Out</h3>
                    <p>Are you sure you want to log out of the JRR Transport portal? You will need to enter your credentials again to access your account.</p>
                    <div class="logout-actions">
                        <button class="logout-btn-cancel" id="logout-cancel">Stay Logged In</button>
                        <button class="logout-btn-confirm" id="logout-confirm">Yes, Sign Out</button>
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
            setTimeout(() => modal.classList.add("visible"), 10);
        }
    }

    function hideLogoutModal() {
        const modal = document.getElementById("logout-modal");
        if (modal) {
            modal.classList.remove("visible");
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
        }
    }

    function performLogout() {
        console.log("Logging out...");

        // Clear session data
        localStorage.removeItem("user");
        sessionStorage.clear();

        // Redirect to login page
        // If we are in /renderer/html/, index.html is in the same dir
        const currentPath = window.location.pathname;
        if (currentPath.includes("/renderer/html/")) {
            window.location.replace("index.html");
        } else {
            // Fallback for other locations (like landing page or root)
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
                console.error(" No path found for:", pageKey);
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
            if (currentPage === path.split("/").pop()) { // Compare only file names
                const activeItem = document.querySelector(`#menu-list li[data-page="${key}"]`);
                if (activeItem) {
                    // Remove active from others
                    document.querySelectorAll("#menu-list li a").forEach(a => a.classList.remove("active"));
                    // Add to this one (the anchor inside the li)
                    const anchor = activeItem.querySelector("a");
                    if (anchor) anchor.classList.add("active");
                    else activeItem.classList.add("active");
                }
            }
        });
    }

    // ============================
    // LOGOUT BUTTON
    // ============================
    const logoutBtn = document.getElementById("logout-btn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault(); // Prevent direct href navigation
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
