// renderer/js/theme.js

(function() {
    const savedTheme = localStorage.getItem('transport-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    window.toggleTheme = function() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('transport-theme', next);
        
        // Update Icons if they exist
        const icon = document.getElementById('theme-icon');
        if (icon && window.lucide) {
            icon.setAttribute('data-lucide', next === 'dark' ? 'moon' : 'sun');
            lucide.createIcons();
        }
    };

    // Initialize toggle listener and sidebar state
    function initSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (sidebar && mainContent) {
            // Desktop Toggle
            let toggle = document.querySelector('.sidebar-toggle');
            if (!toggle) {
                toggle = document.createElement('div');
                toggle.className = 'sidebar-toggle';
                toggle.innerHTML = '<i data-lucide="chevron-left"></i>';
                sidebar.appendChild(toggle);
            }

            // Mobile Toggle
            let mobileToggle = document.querySelector('.mobile-nav-toggle');
            if (!mobileToggle) {
                mobileToggle = document.createElement('button');
                mobileToggle.className = 'mobile-nav-toggle';
                mobileToggle.innerHTML = '<i data-lucide="menu"></i>';
                document.body.appendChild(mobileToggle);
                
                if (window.lucide) lucide.createIcons(); // Render the hamburger icon
                
                mobileToggle.addEventListener('click', () => {
                    sidebar.classList.toggle('mobile-open');
                });
            }

            const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';

            // Apply initial state
            if (isCollapsed) {
                sidebar.classList.add('collapsed');
                mainContent.classList.add('expanded');
                document.body.classList.add('sidebar-collapsed');
                toggle.innerHTML = '<i data-lucide="chevron-right"></i>';
                toggle.setAttribute('title', 'Expand Sidebar');
            } else {
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('expanded');
                document.body.classList.remove('sidebar-collapsed');
                toggle.innerHTML = '<i data-lucide="chevron-left"></i>';
                toggle.setAttribute('title', 'Close Sidebar');
            }

            // Set tooltips on menu items for collapsed icon mode
            document.querySelectorAll('#menu-list li a').forEach(a => {
                const span = a.querySelector('span');
                if (span && !a.getAttribute('title')) {
                    a.setAttribute('title', span.textContent.trim());
                }
            });

            // Trigger lucide to render icons in the toggle
            if (window.lucide) lucide.createIcons();

            // Clear previous listeners if re-running
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);

            newToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const collapsed = sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('expanded');
                document.body.classList.toggle('sidebar-collapsed', collapsed);
                localStorage.setItem('sidebar-collapsed', collapsed);
                
                // Update Icon & Title
                newToggle.innerHTML = collapsed ? 
                    '<i data-lucide="chevron-right"></i>' : 
                    '<i data-lucide="chevron-left"></i>';
                newToggle.setAttribute('title', collapsed ? 'Expand Sidebar' : 'Close Sidebar');
                
                if (window.lucide) lucide.createIcons();
            });
        }
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }

    // Also run on window load to ensure everything (like lucide) is fully ready
    window.addEventListener('load', initSidebar);

    window.addEventListener('DOMContentLoaded', () => {
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', window.toggleTheme);
            
            // Sync initial icon
            const icon = document.getElementById('theme-icon');
            if (icon) {
                icon.setAttribute('data-lucide', savedTheme === 'dark' ? 'moon' : 'sun');
                if (window.lucide) lucide.createIcons();
            }
        }
    });
})();
