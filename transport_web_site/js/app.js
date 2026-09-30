/* ============================================================
   JRR Transportation — app.js
   ============================================================ */

"use strict";

/* ── Toast System ── */
const toastContainer = (() => {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    el.className = "toast-container";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    document.body.appendChild(el);
  }
  return el;
})();

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");

  const icon =
    type === "success"
      ? `<i data-lucide="check-circle-2"></i>`
      : `<i data-lucide="x-circle"></i>`;

  toast.innerHTML = icon + " " + message;
  toastContainer.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => toast.remove(), 3500);
}

/* ── Dynamic Active Nav ── */
function initActiveNav() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  // Desktop nav links
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
    }
  });

  // Mobile menu links (excluding the book button)
  document
    .querySelectorAll(".mobile-menu a:not(.btn-book-mobile)")
    .forEach((link) => {
      const href = link.getAttribute("href");
      if (href === currentPage) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    });

  // Book nav button highlight when on booking page
  const bookNavBtn = document.querySelector(".btn-book-nav");
  if (bookNavBtn) {
    if (currentPage === "booking.html") {
      bookNavBtn.classList.add("active");
      bookNavBtn.setAttribute("aria-current", "page");
    } else {
      bookNavBtn.classList.remove("active");
      bookNavBtn.removeAttribute("aria-current");
    }
  }
}

/* ── Navbar Hamburger ── */
function initNavbar() {
  const hamburger = document.getElementById("hamburger");
  const mobileMenu = document.getElementById("mobile-menu");
  if (!hamburger || !mobileMenu) return;

  function closeMenu() {
    mobileMenu.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.innerHTML = `<i data-lucide="menu"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = mobileMenu.classList.toggle("open");
    hamburger.setAttribute("aria-expanded", String(isOpen));
    hamburger.innerHTML = isOpen
      ? `<i data-lucide="x"></i>`
      : `<i data-lucide="menu"></i>`;
    if (window.lucide) window.lucide.createIcons();
  });

  // Close when a link is clicked
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileMenu.classList.contains("open")) {
      closeMenu();
      hamburger.focus();
    }
  });
}

/* ── Scroll Reveal ── */
function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  els.forEach((el) => obs.observe(el));
}

/* ── Vehicle Data ── */
const vehicles = [
  {
    id: "sedan",
    name: "Sedan",
    category: "Standard",
    capacity: "Up to 4 passengers",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAoMoxyNltWZ2XwTd3Xiy6-w3gPgCzQcvJ6oSRAHLMxJU5xdoi4_dAARb-1IWMz8RCD4uTI0wGY18JIYHx5rOZZAnoXbJ6Q7X5p4egzSVskEm1GHIkInkyuFyxAUmbPQshIbRpq1TVJWoBWDY1q8LUCyQRLWNf3bXCsrmgtimT7Aqc6rtxBCm8bd3niyhu81A9OSZF-5DnQDVl2Ke6lMWgGS1R7_WiGPUaxcRkpwV-NHsV1lo5j9FTb6kWqWUhSxTVOAdW9FGrwr1Dr",
    description: "Ideal for individuals or small groups",
  },
  {
    id: "luxury-sedan",
    name: "Luxury Sedan",
    category: "Premium",
    capacity: "Up to 3 passengers",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAsAiTidVgtA1dNsEKmuvpq0XKDGCa4IFuylFCNPTZdpjensNRPf2mhoOWiFA6xH4r7avuyL3OtkVTnLxiSlzC8xBpjPZO4bVE-ZJxixtWLQ-lSUrcyYdHIds6VI2EgXjCKC8mPmEkqWvEeOHFWTpI_3zyaNoXp7Xb9CYeu7BOMi8jjwUp_PdXSJXW_ghaZjTvVqygPCq2fnIJq0Myr4DWlEZRLAc0IwcQe0ki1paZdXkNY56iVw8LsC7SuATFybQ2IypvMqYN-Cocy",
    description: "Experience luxury and premium comfort",
  },
  {
    id: "suv",
    name: "SUV",
    category: "Group",
    capacity: "Up to 6 passengers",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCbUdS5h3B1SLcn8yezNSMciQIkz_GuFVUIB6pKTBkeJaKGzzRRDwyOzKT6nvQEPhQPZc29QMTYQAj2Y1ywB-Z77nRfC5yMXHh0hsyXXSBQdc2Wslz_nUtNxCx7eIk-FCqvrD4mdP3tq7O4fcfDEWlL4MnTXnIBOXCiJyjIu4KoqlcaXfmklw_xjJkkoSUNi6oE1cI2760JI0IELNrsQh10fKEe8Iu8Qg4hzR7T2XpiZmAa-Q4Yl8N-cEodShf9FNyEl_rvtS8GpR_a",
    description: "Spacious and comfortable for groups",
  },
  {
    id: "van",
    name: "Van",
    category: "Large Group",
    capacity: "Up to 8 passengers",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCpY2dqDw4y3usiQS-GXRwM5MdVrLcTy4Yx8uS_XNE2v1ZGFTm8yB4j1ISD3NKjOeeFtb8ziT8sM17xHlfrvM--rDXybFhvuwFZWMUwmEiytYMeipyB29CRAIf7CokPqQTnnOm5Iq60H50UP7Y8OzhiJgzpmaGw316MMNiAVSWfUvQd0gBIBJi1XazmZ0MYXYAIEKV99antXobC76XtwjN0jQHwoQnG9OoPsIcygw2GQwh34R_6sTcs9eqJGYoy7rIuonu8_xQEc1oi",
    description: "Perfect for medium-sized groups",
  },
  {
    id: "truck",
    name: "Truck",
    category: "Cargo",
    capacity: "Up to 3 passengers + cargo",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAplK5YH5AAjhyH3IB1gwaldyl0SqfLezwEysaJJlrJHBNR-Nf296yMoX_Lg8AtytpsL5QgZaQR2WNXOYWcC7gLusdbxlJvyqE8xYc5iUfRGbsF-b2DjE-RFpTVl07BNLEpKan1-gglFMdWhYHhZAZWWYMJYzZFRq6zr7sff95yizS7Myu6l3iCj14ahn8Uo_qk5Aa4bhdUbraw0Ro_7h0nUHP5lMkyofC_cTDGs6iRZmPHPasYSH0Kh8KhTAH8S3UKUqs__damkeSc",
    description: "Best for large groups or heavy loads",
  },
  {
    id: "limousine",
    name: "Limousine",
    category: "Executive",
    capacity: "Up to 8 passengers",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBOyqBvCOr2kgDOnfuvWAKgE1vkvICl418PgBiOmaMmWS0MgiNfB7GKakiYv1xsSzYM-3-jYQE0p_tmGw7jpaZxOwRgPt6FZyFe_PHPh3reH_MlX1TqEN4VF-G1H9Eg5XJ5f3uqOa_uR7zUhVOi8fJtLzyJKYhse7jRhv-ujWLmZuN3lDFKg1ECaEbNpWtpQmxkXNdex3DuYcXxB34fjUX__sonPXCrRj8MM4velrMYzqXMg1azeonHc_3IT4GTki2fOC2ikEquer0e",
    description: "Premium executive transportation",
  },
];

/* ── Session Storage helpers ── */
const VEHICLE_KEY = "jrr_selectedVehicle";

function saveSelectedVehicle(vehicle) {
  sessionStorage.setItem(VEHICLE_KEY, JSON.stringify(vehicle));
}
function getSelectedVehicle() {
  try {
    const raw = sessionStorage.getItem(VEHICLE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function clearSelectedVehicle() {
  sessionStorage.removeItem(VEHICLE_KEY);
}

/* ── Vehicles Page ── */
function initVehiclesPage() {
  const list = document.getElementById("vehicles-list");
  if (!list) return;

  list.innerHTML = vehicles
    .map(
      (v) => `
    <div class="vehicle-row reveal">
      <div class="vehicle-row-inner">
        <div class="vehicle-info">
          <span class="vehicle-category">${v.category}</span>
          <span class="vehicle-name">${v.name}</span>
          <span class="vehicle-capacity">${v.capacity}</span>
          <button
            class="btn-secondary mt-2"
            style="align-self:flex-start"
            onclick="selectVehicle('${v.id}')"
            aria-label="Select ${v.name}"
          >Select</button>
        </div>
        <div
          class="vehicle-img"
          style="background-image:url('${v.image}')"
          role="img"
          aria-label="${v.name} vehicle"
        ></div>
      </div>
    </div>`,
    )
    .join("");

  initReveal();
}

function selectVehicle(id) {
  const v = vehicles.find((x) => x.id === id);
  if (!v) return;
  saveSelectedVehicle(v);
  showToast(`${v.name} selected!`, "success");
  setTimeout(() => {
    window.location.href = "booking.html";
  }, 600);
}

/* ── Booking Page: Vehicle picker HTML builder ── */
function buildPickerHTML(quickPicks) {
  return `
    <div class="quick-picks" role="list" aria-label="Quick vehicle selection">
      ${quickPicks
        .map(
          (v) => `
        <div class="quick-pick" role="listitem" onclick="quickPickBooking('${v.id}')" tabindex="0"
             onkeydown="if(event.key==='Enter'||event.key===' ')quickPickBooking('${v.id}')"
             aria-label="Select ${v.name} — ${v.description}">
          <div class="quick-pick-img" style="background-image:url('${v.image}')" role="img" aria-hidden="true"></div>
          <p class="quick-pick-name">${v.name}</p>
          <p class="quick-pick-desc">${v.description}</p>
        </div>`,
        )
        .join("")}
    </div>
    <a href="vehicles.html" class="btn-view-all mt-3">Browse All Vehicles</a>`;
}

function buildSelectedHTML(sel, changeFn) {
  return `
    <div class="selected-vehicle">
      <div class="selected-inner">
        <div class="vehicle-info" style="flex:2">
          <span class="vehicle-category">${sel.category}</span>
          <span class="vehicle-name">${sel.name}</span>
          <span class="vehicle-capacity">${sel.capacity}</span>
          <button class="btn-secondary mt-2" style="align-self:flex-start"
            onclick="${changeFn}()" aria-label="Change selected vehicle">
            Change Vehicle
          </button>
        </div>
        <div
          style="flex:1;min-height:120px;border-radius:10px;background-size:cover;background-position:center;background-image:url('${sel.image}')"
          role="img"
          aria-label="${sel.name} vehicle"
        ></div>
      </div>
    </div>`;
}

/* ── Booking Page (simple picker — unused, wizard takes over) ── */
function initBookingPage() {
  // Handled by initBookingWizard below
}

/* ── Copyright year ── */
function initYear() {
  document.querySelectorAll(".year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/* ── Theme Toggle Logic ── */
function initTheme() {
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  if (!toggleBtns.length) return;
  
  // Check local storage or system preference
  const savedTheme = localStorage.getItem('jrr-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', initialTheme);
  
  const updateIcons = (theme) => {
    toggleBtns.forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    });
    if (window.lucide) window.lucide.createIcons();
  };
  
  updateIcons(initialTheme);

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('jrr-theme', newTheme);
      
      updateIcons(newTheme);
    });
  });
}

/* ── Boot ── */
document.addEventListener("DOMContentLoaded", () => {
  if (window.emailjs) {
    emailjs.init("vfMCIRoZCpk1QUx_t");
  }
  initTheme();
  initYear();
  initActiveNav();
  initNavbar();
  initReveal();
  initVehiclesPage();
  initBookingPage();
  initBookingWizard();
});

/* ══════════════════════════════════════════════════════════════
   BOOKING WIZARD
   ══════════════════════════════════════════════════════════════ */
function initBookingWizard() {
  const grid = document.getElementById("vehicle-wizard-grid");
  if (!grid) return; // not on booking page

  const btnNext = document.getElementById("btn-wnext");
  const btnBack = document.getElementById("btn-wback");
  const hint = document.getElementById("wizard-step-hint");
  const progressFill = document.getElementById("wizard-progress-fill");
  const wizardNav = document.getElementById("wizard-nav");
  const wizardPanels = document.getElementById("wizard-panels");
  const successEl = document.getElementById("wizard-success");

  let currentStep = 1;
  const TOTAL = 4;

  // ── Render vehicle grid ──────────────────────────────────────
  function renderVehicleGrid() {
    grid.innerHTML = vehicles
      .map(
        (v) => `
      <div class="vehicle-wizard-card${getSelectedVehicle()?.id === v.id ? " selected" : ""}"
           onclick="wizardPickVehicle('${v.id}')"
           tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')wizardPickVehicle('${v.id}')"
           role="button"
           aria-pressed="${getSelectedVehicle()?.id === v.id}"
           aria-label="Select ${v.name}">
        <div class="vwc-check" aria-hidden="true">
          <i data-lucide="check"></i>
        </div>
        <div class="vwc-img" style="background-image:url('${v.image}')" role="img" aria-hidden="true"></div>
        <div class="vwc-info">
          <div class="vwc-name">${v.name}</div>
          <div class="vwc-cap">${v.capacity}</div>
        </div>
      </div>`,
      )
      .join("");
  }

  window.wizardPickVehicle = function (id) {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;
    saveSelectedVehicle(v);
    renderVehicleGrid();
    if (window.lucide) window.lucide.createIcons();
    updateNextBtn();
  };

  // ── Step indicator ───────────────────────────────────────────
  function updateStepIndicator(n) {
    for (let i = 1; i <= TOTAL; i++) {
      const num = document.getElementById(`ws${i}-num`);
      const lbl = document.getElementById(`ws${i}-lbl`);
      const line = document.getElementById(`wsline${i}`);
      if (!num) continue;
      num.classList.remove("active", "done");
      if (lbl) lbl.classList.remove("active");
      if (line) line.classList.remove("done");
      if (i < n) {
        num.classList.add("done");
        num.textContent = "✓";
        if (line) line.classList.add("done");
      } else if (i === n) {
        num.classList.add("active");
        num.textContent = String(i);
        num.setAttribute("aria-current", "step");
        if (lbl) lbl.classList.add("active");
      } else {
        num.textContent = String(i);
        num.removeAttribute("aria-current");
      }
    }
    // progress bar
    const pct = (n / TOTAL) * 100;
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressFill)
      progressFill
        .closest("[role='progressbar']")
        ?.setAttribute("aria-valuenow", n);
    // hint
    if (hint) hint.textContent = `Step ${n} of ${TOTAL}`;
  }

  // ── Panel switch ─────────────────────────────────────────────
  function showPanel(n) {
    for (let i = 1; i <= TOTAL; i++) {
      const p = document.getElementById(`panel-${i}`);
      if (p) p.classList.toggle("active", i === n);
    }
    updateStepIndicator(n);
    // Back button
    if (btnBack) btnBack.style.display = n > 1 ? "inline-flex" : "none";
    // Next button label
    if (btnNext) {
      if (n === TOTAL) {
        btnNext.innerHTML = `
          <i data-lucide="check"></i> Confirm Booking`;
      } else {
        btnNext.innerHTML = `Next <i data-lucide="chevron-right"></i>`;
      }
    }
    updateNextBtn();
    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Validation per step ──────────────────────────────────────
  function stepValid(n) {
    if (n === 1) return !!getSelectedVehicle();
    if (n === 2) {
      const date = document.getElementById("b-date")?.value;
      const time = document.getElementById("b-time")?.value;
      return !!(date && time && isFutureDate(date));
    }
    if (n === 3) {
      const name = document.getElementById("b-name")?.value.trim();
      const email = document.getElementById("b-email")?.value.trim();
      const phone = document.getElementById("b-phone")?.value.trim();
      const block = document.getElementById("loc-block")?.value.trim();
      const lot = document.getElementById("loc-lot")?.value.trim();
      const str = document.getElementById("loc-street")?.value.trim();
      const brgy = document.getElementById("loc-barangay")?.value.trim();
      const city = document.getElementById("loc-city")?.value.trim();
      const prov = document.getElementById("loc-province")?.value.trim();
      return !!(
        name &&
        isValidEmail(email) &&
        isValidPhone(phone) &&
        block &&
        lot &&
        str &&
        brgy &&
        city &&
        prov
      );
    }
    return true; // step 4 always valid if we got here
  }

  function updateNextBtn() {
    if (btnNext) btnNext.disabled = !stepValid(currentStep);
  }

  // ── Populate confirm summary ─────────────────────────────────
  function populateConfirm() {
    const sel = getSelectedVehicle();
    const date = document.getElementById("b-date")?.value;
    const time = document.getElementById("b-time")?.value;
    const name = document.getElementById("b-name")?.value.trim();
    const email = document.getElementById("b-email")?.value.trim();
    const phone = document.getElementById("b-phone")?.value.trim();
    const block = document.getElementById("loc-block")?.value.trim();
    const lot = document.getElementById("loc-lot")?.value.trim();
    const street = document.getElementById("loc-street")?.value.trim();
    const brgy = document.getElementById("loc-barangay")?.value.trim();
    const city = document.getElementById("loc-city")?.value.trim();
    const prov = document.getElementById("loc-province")?.value.trim();
    const lmk = document.getElementById("loc-landmark")?.value.trim();

    const fullAddress =
      [block, lot, street, brgy, city, prov].filter(Boolean).join(", ") +
      (lmk ? ` (Near: ${lmk})` : "");

    const fmtDate = date
      ? new Date(date + "T00:00").toLocaleDateString("en-PH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "—";

    setText("cs-vehicle", sel?.name || "—");
    setText("cs-category", sel?.category || "—");
    setText("cs-date", fmtDate);
    setText("cs-time", time || "—");
    setText("cs-name", name || "—");
    setText("cs-email", email || "—");
    setText("cs-phone", phone || "—");
    setText("cs-address", fullAddress || "—");
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Navigation ───────────────────────────────────────────────
  btnNext?.addEventListener("click", () => {
    if (!stepValid(currentStep)) return;

    if (currentStep < TOTAL) {
      currentStep++;
      if (currentStep === TOTAL) populateConfirm();
      showPanel(currentStep);
    } else {
      // Final step — submit
      submitBooking();
    }
  });

  btnBack?.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      showPanel(currentStep);
    }
  });

  // ── Live validation listeners ────────────────────────────────
  [
    "b-date",
    "b-time",
    "b-name",
    "b-email",
    "b-phone",
    "loc-block",
    "loc-lot",
    "loc-street",
    "loc-barangay",
    "loc-city",
    "loc-province",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateNextBtn);
    document.getElementById(id)?.addEventListener("change", updateNextBtn);
  });

  // ── Real-time email validation feedback ──────────────────────
  const emailField = document.getElementById("b-email");
  if (emailField) {
    emailField.addEventListener("input", () => {
      const value = emailField.value;
      if (value === "") {
        emailField.style.borderColor = "";
      } else if (isValidEmail(value)) {
        emailField.style.borderColor = "var(--primary)";
      } else {
        emailField.style.borderColor = "hsl(0, 55%, 50%)";
      }
    });
  }

  // ── Submit ───────────────────────────────────────────────────
  let _pdfData = null;

  function submitBooking() {
    const sel = getSelectedVehicle();
    const date = document.getElementById("b-date")?.value;
    const time = document.getElementById("b-time")?.value;
    const fullName = document.getElementById("b-name")?.value.trim();
    const email = document.getElementById("b-email")?.value.trim();
    const phone = document.getElementById("b-phone")?.value.trim();
    const block = document.getElementById("loc-block")?.value.trim();
    const lot = document.getElementById("loc-lot")?.value.trim();
    const street = document.getElementById("loc-street")?.value.trim();
    const brgy = document.getElementById("loc-barangay")?.value.trim();
    const city = document.getElementById("loc-city")?.value.trim();
    const prov = document.getElementById("loc-province")?.value.trim();
    const lmk = document.getElementById("loc-landmark")?.value.trim();

    const fullAddress =
      [block, lot, street, brgy, city, prov].filter(Boolean).join(", ") +
      (lmk ? ` (Near: ${lmk})` : "");

    // Disable button
    if (btnNext) {
      btnNext.disabled = true;
      btnNext.innerHTML =
        '<i class="spinner" data-lucide="loader-2"></i> Confirming…';
      if (window.lucide) window.lucide.createIcons();
    }

    const fd = new FormData();
    fd.append("action", "booking");
    fd.append("vehicleId", sel.id);
    fd.append("vehicleName", sel.name);
    fd.append("date", date);
    fd.append("time", time);
    fd.append("fullName", fullName);
    fd.append("email", email);
    fd.append("phone", phone);
    fd.append("address", fullAddress);

    const fmtDate = new Date(date + "T00:00").toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const onSuccess = (bookingId) => {
      const refCode = generateRef(bookingId);
      showToast(`Booking confirmed! Ref: ${refCode}`, "success");

      // Hide wizard, show success
      if (wizardPanels) wizardPanels.style.display = "none";
      if (wizardNav) wizardNav.style.display = "none";
      if (successEl) successEl.classList.add("show");

      // Fill success screen
      const refText = document.getElementById("success-ref-text");
      if (refText) refText.textContent = refCode;

      const rowsEl = document.getElementById("success-rows");
      if (rowsEl) {
        rowsEl.innerHTML = [
          ["Vehicle", sel.name],
          ["Date", fmtDate],
          ["Time", time],
          ["Passenger", fullName],
          ["Phone", phone],
          ["Email", email],
          ["Pickup", fullAddress],
        ]
          .map(
            ([k, v]) => `
          <div class="cs-section" style="padding:0.75rem 1.25rem;">
            <div class="cs-row"><span class="cs-key">${k}</span><span class="cs-val">${v}</span></div>
          </div>`,
          )
          .join("");
      }

      _pdfData = {
        ref: refCode,
        booking: {
          vehicle: sel.name,
          category: sel.category,
          date: fmtDate,
          time,
          fullName,
          phone,
          email,
          address: fullAddress,
        },
      };

      clearSelectedVehicle();

      // Send booking receipt email via EmailJS
      if (window.emailjs) {
        const pdfBase64 = generatePDFBase64(_pdfData.ref, _pdfData.booking);
        emailjs
          .send("service_yp78obm", "template_sdx2mgh", {
            to_email: email,
            to_name: fullName,
            ref_code: refCode,
            vehicle: sel.name,
            date: fmtDate,
            time: time,
            address: fullAddress,
            pdf_base64: pdfBase64,
          })
          .then(() => showToast("Receipt sent to " + email, "success"))
          .catch(() =>
            showToast("Could not send receipt. Download it manually.", "error"),
          );
      }
    };

    fetch("api.php", { method: "POST", body: fd })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data.success) {
          onSuccess(data.bookingId || null);
        } else {
          showToast(
            data.message || "Booking failed. Please try again.",
            "error",
          );
          if (btnNext) {
            btnNext.disabled = false;
            btnNext.innerHTML = `<i data-lucide="check"></i> Confirm Booking`;
            if (window.lucide) window.lucide.createIcons();
          }
        }
      })
      .catch(() => onSuccess(null)); // fallback for local dev
  }

  // ── PDF button ───────────────────────────────────────────────
  document.getElementById("btn-pdf")?.addEventListener("click", () => {
    if (_pdfData) generatePDF(_pdfData.ref, _pdfData.booking);
    else showToast("No booking data available.", "error");
  });

  // ── Init ─────────────────────────────────────────────────────
  renderVehicleGrid();
  showPanel(1);
}

/* ── Booking Page: Step indicator (legacy, kept for compatibility) ── */
function markStep(n) {
  // No-op: wizard handles its own step state
}

/* ── Booking Page: Reference generator ── */
function generateRef(bookingId) {
  if (bookingId) return "JRR-" + String(bookingId).padStart(6, "0");
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return "JRR-" + ts + rnd;
}

/* ── Validation helpers ── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPhone(phone) {
  const digits = phone.replace(/[\s\-().+]/g, "");
  return /^\d{7,15}$/.test(digits);
}
function isFutureDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) >= today;
}

/* ── Booking Page: PDF generator ── */
function generatePDF(refCode, bookingData) {
  if (!window.jspdf) {
    showToast("PDF library not loaded. Please try again.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  const col = margin;
  let y = 0;

  // Header banner
  doc.setFillColor(30, 64, 175); // #1e40af
  doc.rect(0, 0, pageW, 90, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("JRR.", col, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("JRR Transportation", col, 62);
  doc.text("Booking Receipt", col, 78);

  // Confirmed badge (right)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - margin - 120, 20, 120, 50, 8, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text("✓ CONFIRMED", pageW - margin - 60, 40, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Status: Pending", pageW - margin - 60, 56, { align: "center" });

  y = 110;

  // Reference number box
  doc.setFillColor(239, 246, 255); // light blue bg
  doc.roundedRect(col, y, pageW - margin * 2, 46, 6, 6, "F");
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(1);
  doc.roundedRect(col, y, pageW - margin * 2, 46, 6, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("BOOKING REFERENCE NUMBER", col + 14, y + 16);
  doc.setFont("courier", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 90, 60);
  doc.text(refCode, col + 14, y + 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  const issuedLabel =
    "Issued: " +
    new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  doc.text(issuedLabel, pageW - margin - 14, y + 36, { align: "right" });

  y += 68;

  function sectionHeader(title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(46, 125, 90);
    doc.text(title.toUpperCase(), col, y);
    doc.setDrawColor(46, 125, 90);
    doc.setLineWidth(0.5);
    doc.line(col, y + 3, pageW - margin, y + 3);
    y += 16;
  }

  function dataRow(label, value, isLast) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(110, 110, 110);
    doc.text(label, col, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    const valX = col + 130;
    const wrapped = doc.splitTextToSize(value, pageW - margin - valX - 10);
    doc.text(wrapped, valX, y);
    const lineH = Math.max(wrapped.length * 13, 14);
    if (!isLast) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(col, y + lineH - 2, pageW - margin, y + lineH - 2);
    }
    y += lineH + 4;
  }

  sectionHeader("Vehicle");
  dataRow("Vehicle Type", bookingData.vehicle, false);
  dataRow("Category", bookingData.category, true);
  y += 8;
  sectionHeader("Schedule");
  dataRow("Pickup Date", bookingData.date, false);
  dataRow("Pickup Time", bookingData.time, true);
  y += 8;
  sectionHeader("Passenger");
  dataRow("Full Name", bookingData.fullName, false);
  dataRow("Phone", bookingData.phone, false);
  dataRow("Email", bookingData.email, true);
  y += 8;
  sectionHeader("Pickup Location");
  dataRow("Address", bookingData.address, true);
  y += 20;

  // Notice box
  doc.setFillColor(250, 250, 235);
  doc.setDrawColor(200, 180, 60);
  doc.setLineWidth(0.5);
  doc.roundedRect(col, y, pageW - margin * 2, 52, 5, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 100, 0);
  doc.text("Important Notice", col + 12, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 70, 0);
  doc.text(
    "Please keep this receipt for your records. Present your booking reference number to the driver upon pickup.\nFor cancellations or changes, contact JRR Transportation at least 2 hours before your scheduled ride.",
    col + 12,
    y + 28,
    { maxWidth: pageW - margin * 2 - 24 },
  );

  // Footer
  doc.setFillColor(46, 125, 90);
  const fH = 36;
  doc.rect(0, doc.internal.pageSize.getHeight() - fH, pageW, fH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 240, 220);
  doc.text(
    "© " +
      new Date().getFullYear() +
      " JRR Transportation. All rights reserved.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - fH + 14,
    { align: "center" },
  );
  doc.text(
    "This is a system-generated receipt.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - fH + 26,
    { align: "center" },
  );

  doc.save(`JRR-Booking-${refCode}.pdf`);
}

/* ── PDF base64 generator (for email receipt) ── */
function generatePDFBase64(refCode, bookingData) {
  if (!window.jspdf) return null;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  const col = margin;
  let y = 0;

  // Header banner
  doc.setFillColor(46, 125, 90);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("JRR.", col, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("JRR Transportation", col, 62);
  doc.text("Booking Receipt", col, 78);

  // Confirmed badge (right)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - margin - 120, 20, 120, 50, 8, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(46, 125, 90);
  doc.text("✓ CONFIRMED", pageW - margin - 60, 40, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Status: Pending", pageW - margin - 60, 56, { align: "center" });

  y = 110;

  // Reference number box
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(col, y, pageW - margin * 2, 46, 6, 6, "F");
  doc.setDrawColor(46, 125, 90);
  doc.setLineWidth(1);
  doc.roundedRect(col, y, pageW - margin * 2, 46, 6, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("BOOKING REFERENCE NUMBER", col + 14, y + 16);
  doc.setFont("courier", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 90, 60);
  doc.text(refCode, col + 14, y + 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  const issuedLabel =
    "Issued: " +
    new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  doc.text(issuedLabel, pageW - margin - 14, y + 36, { align: "right" });

  y += 68;

  function sectionHeader(title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(46, 125, 90);
    doc.text(title.toUpperCase(), col, y);
    doc.setDrawColor(46, 125, 90);
    doc.setLineWidth(0.5);
    doc.line(col, y + 3, pageW - margin, y + 3);
    y += 16;
  }

  function dataRow(label, value, isLast) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(110, 110, 110);
    doc.text(label, col, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    const valX = col + 130;
    const wrapped = doc.splitTextToSize(value, pageW - margin - valX - 10);
    doc.text(wrapped, valX, y);
    const lineH = Math.max(wrapped.length * 13, 14);
    if (!isLast) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(col, y + lineH - 2, pageW - margin, y + lineH - 2);
    }
    y += lineH + 4;
  }

  sectionHeader("Vehicle");
  dataRow("Vehicle Type", bookingData.vehicle, false);
  dataRow("Category", bookingData.category, true);
  y += 8;
  sectionHeader("Schedule");
  dataRow("Pickup Date", bookingData.date, false);
  dataRow("Pickup Time", bookingData.time, true);
  y += 8;
  sectionHeader("Passenger");
  dataRow("Full Name", bookingData.fullName, false);
  dataRow("Phone", bookingData.phone, false);
  dataRow("Email", bookingData.email, true);
  y += 8;
  sectionHeader("Pickup Location");
  dataRow("Address", bookingData.address, true);
  y += 20;

  // Notice box
  doc.setFillColor(250, 250, 235);
  doc.setDrawColor(200, 180, 60);
  doc.setLineWidth(0.5);
  doc.roundedRect(col, y, pageW - margin * 2, 52, 5, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 100, 0);
  doc.text("Important Notice", col + 12, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 70, 0);
  doc.text(
    "Please keep this receipt for your records. Present your booking reference number to the driver upon pickup.\nFor cancellations or changes, contact JRR Transportation at least 2 hours before your scheduled ride.",
    col + 12,
    y + 28,
    { maxWidth: pageW - margin * 2 - 24 },
  );

  // Footer
  doc.setFillColor(46, 125, 90);
  const fH = 36;
  doc.rect(0, doc.internal.pageSize.getHeight() - fH, pageW, fH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 240, 220);
  doc.text(
    "© " +
      new Date().getFullYear() +
      " JRR Transportation. All rights reserved.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - fH + 14,
    { align: "center" },
  );
  doc.text(
    "This is a system-generated receipt.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - fH + 26,
    { align: "center" },
  );

  return doc.output("datauristring");
}

/* ── DEPRECATED: replaced by initBookingWizard ── */
function initBookingPageFull() {
  const form = document.getElementById("booking-form");
  if (!form) return;

  markStep(1);

  const pickerEl = document.getElementById("vehicle-picker");
  const selectedEl = document.getElementById("vehicle-selected");
  if (!pickerEl || !selectedEl) return;

  function renderBookingPicker() {
    const sel = getSelectedVehicle();
    if (sel) {
      pickerEl.style.display = "none";
      selectedEl.style.display = "block";
      selectedEl.innerHTML = buildSelectedHTML(sel, "changeVehicleBooking");
      markStep(2);
    } else {
      pickerEl.style.display = "block";
      selectedEl.style.display = "none";
      pickerEl.innerHTML = buildPickerHTML(vehicles.slice(0, 3));
      markStep(1);
    }
  }

  window.quickPickBooking = function (id) {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;
    saveSelectedVehicle(v);
    renderBookingPicker();
  };

  window.changeVehicleBooking = function () {
    clearSelectedVehicle();
    renderBookingPicker();
  };

  renderBookingPicker();

  // PDF button
  let _pdfData = null;
  const pdfBtn = document.getElementById("btn-pdf");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", function () {
      if (_pdfData) generatePDF(_pdfData.ref, _pdfData.booking);
      else showToast("No booking data available.", "error");
    });
  }

  // Form submit
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const sel = getSelectedVehicle();
    const date = document.getElementById("b-date").value;
    const time = document.getElementById("b-time").value;
    const fullName = document.getElementById("b-name").value.trim();
    const email = document.getElementById("b-email").value.trim();
    const phone = document.getElementById("b-phone").value.trim();
    const locBlock = document.getElementById("loc-block").value.trim();
    const locLot = document.getElementById("loc-lot").value.trim();
    const locStreet = document.getElementById("loc-street").value.trim();
    const locBarangay = document.getElementById("loc-barangay").value.trim();
    const locCity = document.getElementById("loc-city").value.trim();
    const locProvince = document.getElementById("loc-province").value.trim();
    const locLandmark = document.getElementById("loc-landmark").value.trim();

    // Validation
    if (!sel) {
      showToast("Please select a vehicle.", "error");
      return;
    }
    if (!date) {
      showToast("Please select a pickup date.", "error");
      return;
    }
    if (!isFutureDate(date)) {
      showToast("Please select a future date.", "error");
      return;
    }
    if (!time) {
      showToast("Please select a pickup time.", "error");
      return;
    }
    if (!fullName) {
      showToast("Please enter your full name.", "error");
      return;
    }
    if (!isValidEmail(email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    if (!phone) {
      showToast("Please enter your phone number.", "error");
      return;
    }
    if (!isValidPhone(phone)) {
      showToast("Enter a valid phone number (7–15 digits).", "error");
      return;
    }
    if (!locBlock) {
      showToast("Please enter your Block No.", "error");
      return;
    }
    if (!locLot) {
      showToast("Please enter your Lot No.", "error");
      return;
    }
    if (!locStreet) {
      showToast("Please enter your Street / Road.", "error");
      return;
    }
    if (!locBarangay) {
      showToast("Please enter your Barangay.", "error");
      return;
    }
    if (!locCity) {
      showToast("Please enter your City / Municipality.", "error");
      return;
    }
    if (!locProvince) {
      showToast("Please enter your Province.", "error");
      return;
    }

    const fullAddress =
      [locBlock, locLot, locStreet, locBarangay, locCity, locProvince]
        .filter(Boolean)
        .join(", ") + (locLandmark ? ` (Near: ${locLandmark})` : "");

    const submitBtn = document.getElementById("submit-booking");
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="spinner" aria-hidden="true"></span> Confirming…';

    const fd = new FormData();
    fd.append("action", "booking");
    fd.append("vehicleId", sel.id);
    fd.append("vehicleName", sel.name);
    fd.append("date", date);
    fd.append("time", time);
    fd.append("fullName", fullName);
    fd.append("email", email);
    fd.append("phone", phone);
    fd.append("address", fullAddress);

    const onSuccess = (bookingId) => {
      const refCode = generateRef(bookingId);
      showToast(`Booking confirmed! Ref: ${refCode}`, "success");
      markStep(4);

      const refTextEl = document.getElementById("booking-ref-text");
      if (refTextEl) refTextEl.textContent = refCode;

      const summaryEl = document.getElementById("booking-summary");
      const rowsEl = document.getElementById("summary-rows");

      const formattedDate = new Date(date + "T00:00").toLocaleDateString(
        "en-PH",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      );

      if (rowsEl) {
        rowsEl.innerHTML = [
          ["Vehicle", sel.name],
          ["Date", formattedDate],
          ["Time", time],
          ["Passenger", fullName],
          ["Phone", phone],
          ["Email", email],
          ["Pickup", fullAddress],
        ]
          .map(
            ([k, v]) => `
            <div class="summary-row">
              <span class="summary-key">${k}</span>
              <span class="summary-val">${v}</span>
            </div>`,
          )
          .join("");
      }

      _pdfData = {
        ref: refCode,
        booking: {
          vehicle: sel.name,
          category: sel.category,
          date: formattedDate,
          time,
          fullName,
          phone,
          email,
          address: fullAddress,
        },
      };

      if (summaryEl) {
        summaryEl.classList.add("show");
        summaryEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      const RESET_DELAY = 30000;
      setTimeout(() => {
        form.reset();
        clearSelectedVehicle();
        renderBookingPicker();
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Confirm Booking';
        if (summaryEl) summaryEl.classList.remove("show");
      }, RESET_DELAY);
    };

    fetch("api.php", { method: "POST", body: fd })
      .then((r) => {
        if (!r.ok) throw new Error("Network response was not ok");
        return r.json();
      })
      .then((data) => {
        if (data.success) {
          onSuccess(data.bookingId || null);
        } else {
          showToast(
            data.message || "Booking failed. Please try again.",
            "error",
          );
          submitBtn.disabled = false;
          submitBtn.innerHTML = "Confirm Booking";
        }
      })
      .catch(() => {
        // Fallback: show success UI without a real booking ID (e.g., local dev)
        onSuccess(null);
      });
  });
}
