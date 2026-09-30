document.addEventListener("DOMContentLoaded", async () => {
  const sidebarContainer = document.getElementById("sidebar-container");
  const mainContent = document.getElementById("main-content");

  let currentPage = null; //  Track currently active page

  //  Prepare dynamic <link> for page CSS
  let pageStyle = document.getElementById("page-style");
  if (!pageStyle) {
    pageStyle = document.createElement("link");
    pageStyle.rel = "stylesheet";
    pageStyle.id = "page-style";
    document.head.appendChild(pageStyle);
  }

  // 1️ Load sidebar first
  try {
    const sidebarRes = await fetch("./sidebar.html");
    if (!sidebarRes.ok) throw new Error("Sidebar not found!");
    sidebarContainer.innerHTML = await sidebarRes.text();

    //  Logout button handler
    const logoutBtn = sidebarContainer.querySelector("#logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("user"); // Clear auth session
        sidebarContainer.classList.add("hidden");
        setTimeout(() => (window.location.href = "index.html"), 300);
      });
    }

  } catch (err) {
    console.error(" Sidebar failed to load:", err);
  }

  // 2️ Load the default page
  await loadPage("dashboard");

  // 3️ Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // 4️ Sidebar click event (for navigation)
  sidebarContainer.addEventListener("click", async (e) => {
    const li = e.target.closest("li[data-page]");
    if (!li) return;

    const page = li.getAttribute("data-page");

    //  Prevent reloading the same page
    if (page === currentPage) {
      console.log(`⚙️ ${page} already active — skipping reload`);
      return;
    }

    // Highlight active menu
    sidebarContainer.querySelectorAll("li").forEach(item => item.classList.remove("active"));
    li.classList.add("active");

    await loadPage(page);
  });

  //  Function to load a page dynamically
  async function loadPage(pageName) {
    const pagePath = `./${pageName}.html`;
    const cssPath = `../css/${pageName}.css`;
    const jsPath = `../js/${pageName}.js`;

    try {
      const response = await fetch(pagePath);
      if (!response.ok) throw new Error(`Page not found: ${pagePath}`);

      const htmlText = await response.text();
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlText, "text/html");

      //  Inject HTML into main content
      mainContent.innerHTML = htmlDoc.body.innerHTML;
      currentPage = pageName;

      //  Load page script
      await loadScript(jsPath);

      //  Look for init function (e.g., initDashboard)
      const initFnName = `init${pageName.charAt(0).toUpperCase()}${pageName.slice(1)}`;
      const initFn = window[initFnName];
      try {
        if (typeof initFn === "function") {
          await initFn();
          console.log(` Initialized ${pageName}`);
        } else {
          console.log(`ℹ No init function for ${pageName}`);
        }
      } catch (fnErr) {
        console.error(`Error initializing ${pageName}:`, fnErr);
      } finally {
        const loader = mainContent.querySelector("#loading-overlay");
        if (loader) {
          loader.classList.remove("visible");
        }
      }

      //  Load CSS dynamically
      try {
        const cssResponse = await fetch(cssPath);
        if (cssResponse.ok) {
          pageStyle.href = cssPath;
          console.log(` Loaded CSS for ${pageName}`);
        } else {
          pageStyle.href = "";
          console.warn(` No CSS found for ${pageName}`);
        }
      } catch (cssErr) {
        pageStyle.href = "";
      }

      if (window.lucide) lucide.createIcons();

    } catch (err) {
      mainContent.innerHTML = `<p style="color:red;">Error loading ${pageName}</p>`;
      console.error("Failed to load page:", err);
    }
  }

  // *-Helper: dynamically load a JS file
  async function loadScript(src) {
    // Remove old script (if exists)
    const old = document.querySelector(`script[data-dynamic="true"]`);
    if (old) old.remove();

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.type = "text/javascript";
      script.dataset.dynamic = "true";
      script.onload = resolve;
      script.onerror = (err) => {
        console.warn(` Script not found: ${src}`);
        resolve(); // still resolve, no crash
      };
      document.body.appendChild(script);
    });
  }
});
