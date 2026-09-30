const fs = require("fs");
const path = require("path");

const files = ["index.html", "about.html", "vehicles.html", "booking.html"];

files.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, "utf-8");

  // 1. Add ambient mesh after <body>
  if (!content.includes('<div class="ambient-mesh"></div>')) {
    content = content.replace(
      /<body>/i,
      '<body>\n    <div class="ambient-mesh"></div>'
    );
  }

  // 2. Add theme toggle button in the navbar right before hamburger
  if (!content.includes('class="theme-toggle-btn"')) {
    content = content.replace(
      /(<button class="hamburger" [^>]*>[\s\S]*?<\/button>)/,
      '<button class="theme-toggle-btn" aria-label="Toggle dark mode"><i data-lucide="moon"></i></button>\n          $1'
    );
  }

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`Updated ${file}`);
});
