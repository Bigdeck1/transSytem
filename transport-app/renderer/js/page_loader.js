window.PageLoader = {

  async load(pageName) {
    window.UI.showLoading();

    const htmlPath = `./${pageName}.html`;
    const cssPath = `../css/${pageName}.css`;
    const jsPath = `../js/pages/${pageName}.js`;

    try {
      // Load HTML
      const res = await fetch(htmlPath);
      const text = await res.text();
      document.getElementById("main-content").innerHTML = text;

      // Load CSS
      const link = document.getElementById("page-style");
      const cssRes = await fetch(cssPath);
      link.href = cssRes.ok ? cssPath : "";

      // Load JS
      await loadDynamicScript(jsPath);

      // Run init function
      const fn = window[`init${capitalize(pageName)}`];
      if (typeof fn === "function") fn();

    } catch (err) {
      console.error("Error loading page:", err);
    }

    window.UI.hideLoading();
  }

};

function loadDynamicScript(src) {
  return new Promise((resolve) => {
    const old = document.querySelector("script[data-dynamic]");
    if (old) old.remove();

    const script = document.createElement("script");
    script.src = src;
    script.dataset.dynamic = "true";
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
