// =============================
// GLOBAL STATE
// =============================
let employees = [];
let requests = [];
let trips = [];
let filter = "all";
let selected = null;
let currentRequestId = null;

// =============================
// MODAL ELEMENTS
// =============================
// Modal elements are initialized inside DOMContentLoaded to prevent null refs in SPA
let timeOffModal, closeTimeOffModal, modalEmpName, modalType, modalDates, modalReason, modalStatus, approveBtn, denyBtn;

// =============================
// DEBOUNCE UTILITY
// =============================
function debounce(fn, delay = 150) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// HELPER: GET STATUS FOR A DATE (COMBINED TRIPS + TIME-OFF)
// =============================
function getStatusForDate(emp, requests, trips, date = new Date()) {
  let status = emp.status || "available";
  const empRole = (emp.role || emp.position || "").trim().toLowerCase();

  // =========================
  // TIME-OFF FIRST (highest priority)
  // =========================
  const approvedTimeOff = requests.find(r =>
    String(r.employee_id) === String(emp.id) &&
    r.status.toLowerCase() === "approved" &&
    new Date(r.start_date) <= date &&
    date <= new Date(r.end_date)
  );
  if (approvedTimeOff) return "unavailable";

  const pendingTimeOff = requests.find(r =>
    String(r.employee_id) === String(emp.id) &&
    r.status.toLowerCase() === "pending" &&
    new Date(r.start_date) <= date &&
    date <= new Date(r.end_date)
  );
  if (pendingTimeOff) status = "partially";

  // =========================
  // TRIP CHECK (only drivers)
  // =========================
  if (empRole === "driver") {
    const empTrips = trips.filter(t => String(t.driver_id) === String(emp.id));
    for (let t of empTrips) {
      const start = new Date(t.pickup_time);
      const end = new Date(t.delivery_time);
      const tripStatus = (t.status || "").trim().toLowerCase();

      // Currently on a trip => unavailable
      if (start <= date && date <= end && ["in transit", "in-transit"].includes(tripStatus)) {
        return "unavailable";
      }

      // Future or pending trips => busy
      if (["pending", "scheduled", "delayed"].includes(tripStatus) && start >= date) {
        if (status !== "unavailable") status = "busy";
      }
    }
  }

  return status;
}
// =============================
// HELPER: CURRENT STATUS
// =============================
function getCurrentStatus(emp) {
  return getStatusForDate(emp, requests, trips, new Date());
}

// =============================
// HELPER: WEEKLY AVAILABILITY
// =============================
function getWeeklyAvailability(emp) {
  const weekStart = new Date();
  weekStart.setHours(0,0,0,0);
  const dayOfWeek = weekStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + mondayOffset);

  const availability = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    availability.push(getStatusForDate(emp, requests, trips, day));
  }
  return availability;
}

// =============================
// REFRESH DRIVER STATUSES
// =============================
async function refreshDriverStatuses() {
  try {
    trips = await window.api.getTrips();
    employees = employees.map(emp => {
      const status = getCurrentStatus(emp);
      return { ...emp, status };
    });
    renderEmployees();
    updateSummaryCards();
  } catch (err) {
    console.error("Failed to refresh driver statuses:", err);
  }
}

// =============================
// LOAD EMPLOYEES
// =============================
async function loadEmployees() {
  try {
    const [data, timeOffData, tripsData] = await Promise.all([
      window.api.getEmployees(),
      window.api.getTimeOffRequests(),
      window.api.getTrips()
    ]);

    trips = tripsData;
    requests = timeOffData;

    employees = data.map(emp => {
      const status = getCurrentStatus(emp);
      const empTrips = trips.filter(t => t.driver_id === emp.id);
      const empTimeOffs = requests.filter(r => r.employee_id === emp.id);

      let nextUnavailable = "None";
      const futureDates = [
        ...empTrips.filter(t => new Date(t.pickup_time) > new Date()).map(t => t.pickup_time),
        ...empTimeOffs.filter(r => new Date(r.start_date) > new Date()).map(r => r.start_date)
      ];
      if (futureDates.length) {
        nextUnavailable = new Date(Math.min(...futureDates.map(d => new Date(d)))).toISOString().split("T")[0];
      }

      return {
        id: emp.id,
        name: emp.full_name || "Unknown",
        role: emp.position || "",
        email: emp.email || "",
        avatar: (emp.full_name?.split(" ").map(w => w[0]).join("") || "U").toUpperCase(),
        status,
        weeklyHours: emp.weekly_hours || 40,
        availableHours: emp.available_hours || 40,
        nextUnavailable,
        workPattern: emp.work_pattern || "Mon-Fri 9AM-5PM"
      };
    });

    renderEmployees();
    updateSummaryCards();
    return employees;
  } catch (err) {
    console.error("Failed to load employees:", err);
  }
}

// =============================
// LOAD TIME-OFF REQUESTS
// =============================
async function loadRequests() {
  try {
    const data = await window.api.getTimeOffRequests();
    requests = data.map(r => {
      const emp = employees.find(e => e.id === r.employee_id) || {};
      return {
        id: r.id,
        employee_id: r.employee_id,
        employee: emp.name || "Unknown",
        type: r.request_type || r.type || "",
        dates: `${r.start_date || ""} → ${r.end_date || ""}`,
        status: r.status || "pending",
        reason: r.reason || "",
      };
    });

    renderRequests();
    updateSummaryCards();
  } catch (err) {
    console.error("Failed to load requests:", err);
  }
}

// =============================
// RENDER EMPLOYEES
// =============================
function createEmployeeCard(emp) {
  const card = document.createElement("div");
  card.className = `employee-card ${emp.status}`;
  if (selected === emp.id) card.classList.add("expanded");

  const weekly = getWeeklyAvailability(emp);
  const dayLabels = ['M','T','W','T','F','S','S'];
  const barHTML = weekly.map((dayStatus, i) => 
    `<div class="week-day ${dayStatus}" title="${dayLabels[i]}: ${dayStatus}"></div>`
  ).join("");

  // Status colors
  const statusColors = {
    available: 'var(--success)',
    partially: 'var(--warning)',
    unavailable: 'var(--error)',
    busy: '#f59e0b'
  };
  const statusColor = statusColors[emp.status] || 'var(--info)';

  card.innerHTML = `
    <div class="employee-info">
      <div style="display:flex; gap:12px; align-items: center;">
        <div class="avatar" style="background: ${statusColor}; box-shadow: 0 4px 12px ${statusColor}33;">${emp.avatar}</div>
        <div>
          <h3 style="margin: 0; font-size: 14px; font-weight: 700;">${emp.name}</h3>
          <p style="margin: 2px 0; font-size: 12px; color: var(--text-muted);">${emp.role}</p>
          <small style="font-size: 11px; color: var(--text-light);">${emp.workPattern}</small>
        </div>
      </div>
    </div>
    <div class="employee-status">
      <span class="status-badge ${emp.status}" style="background: ${statusColor}15; color: ${statusColor}; border-color: ${statusColor}30;">
        ${emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
      </span>
    </div>
    <div class="weekly-bar">
      ${barHTML}
    </div>
  `;

  if (selected === emp.id) {
    const details = document.createElement("div");
    details.className = "employee-details";
    details.style.cssText = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding-top: 16px; border-top: 1px solid var(--border-subtle); margin-top: 12px;";
    details.innerHTML = `
      <div><small style="color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase;">Weekly Hours</small><p style="font-weight: 800; margin: 4px 0 0;">${emp.weeklyHours}h</p></div>
      <div><small style="color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase;">Available</small><p style="font-weight: 800; margin: 4px 0 0;">${emp.availableHours}h</p></div>
      <div><small style="color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase;">Next Time Off</small><p style="font-weight: 800; margin: 4px 0 0;">${emp.nextUnavailable}</p></div>
    `;
    card.appendChild(details);
  }

  card.onclick = () => {
    selected = selected === emp.id ? null : emp.id;
    renderEmployees();
  };

  return card;
}

function renderEmployees() {
  const container = document.getElementById("employee-list");
  if (!container) return;

  const searchInput = document.getElementById("search");
  const searchTerm = searchInput?.value?.trim().toLowerCase() || "";

  container.innerHTML = "";

  if (!searchTerm && filter === "all") {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
      <span style="font-size: 48px; display: block; margin-bottom: 12px;">🔍</span>
      Please use the search bar or select a filter to display staff members.
    </p>`;
    return;
  }

  const filtered = employees.filter(e => {
    const matchesFilter = filter === "all" || e.status.toLowerCase() === filter.toLowerCase();
    const matchesSearch = e.name.toLowerCase().includes(searchTerm) || 
                          e.role.toLowerCase().includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
      <span style="font-size: 48px; display: block; margin-bottom: 12px;">🔍</span>
      No staff members found matching "${searchTerm || filter}".
    </p>`;
    return;
  }

  filtered.forEach(emp => container.appendChild(createEmployeeCard(emp)));
}

// =============================
// RENDER TIME-OFF REQUESTS
// =============================
function renderRequests() {
  const tbody = document.getElementById("requestTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!requests.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">
      <span style="font-size: 36px; display: block; margin-bottom: 8px;">📝</span>
      No time-off requests
    </td>`;
    tbody.appendChild(emptyRow);
    return;
  }

  requests.forEach(r => {
    const row = document.createElement("tr");
    const color = r.status === "approved" ? "green" : r.status === "pending" ? "amber" : "red";

    row.innerHTML = `
      <td><div style="font-weight: 700; color: var(--text-main);">${r.employee}</div></td>
      <td style="color: var(--text-muted); font-size: 12px;">${r.type}</td>
      <td style="font-size: 12px; font-variant-numeric: tabular-nums;">${r.dates.replace(" → ", " - ")}</td>
      <td><span class="badge-small ${color}">${r.status}</span></td>
      <td style="text-align: right;"><button class="view-details-btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" data-id="${r.id}">View</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll(".view-details-btn").forEach(btn => {
    btn.onclick = () => openRequestModal(btn.dataset.id);
  });
}

// =============================
// OPEN TIME-OFF MODAL
// =============================
function openRequestModal(id) {
  const request = requests.find(r => r.id === id);
  if (!request || !timeOffModal) return;

  currentRequestId = id;
  if (modalEmpName) modalEmpName.textContent = request.employee;
  if (modalType) modalType.textContent = request.type;
  if (modalDates) modalDates.textContent = request.dates;
  if (modalReason) modalReason.textContent = request.reason;
  if (modalStatus) modalStatus.textContent = request.status;

  if (request.status.toLowerCase() === "pending") {
    if (approveBtn) approveBtn.style.display = "inline-block";
    if (denyBtn) denyBtn.style.display = "inline-block";
  } else {
    if (approveBtn) approveBtn.style.display = "none";
    if (denyBtn) denyBtn.style.display = "none";
  }

  timeOffModal.style.display = "flex";
}

// =============================
// APPROVE / DENY TIME-OFF
// =============================
async function handleTimeOffStatusChange(status) {
  if (!currentRequestId) return;
  try {
    await window.api.updateTimeOffRequestStatus(currentRequestId, status);
    await loadEmployees();
    await loadRequests();
    if (timeOffModal) timeOffModal.style.display = "none";
  } catch (err) {
    console.error(err);
    alert(`Failed to ${status} request!`);
  }
}

// =============================
// UPDATE SUMMARY CARDS
// =============================
function updateSummaryCards() {
  const availableStatuses = ["available", "active"];
  const unavailableStatuses = ["unavailable", "on leave", "busy", "in-use", "retired"];
  const partialStatuses = ["partially", "pending"];

  const fullyAvailable = employees.filter(e => 
    availableStatuses.includes(e.status.toLowerCase())
  ).length;
  
  const partiallyAvailable = employees.filter(e => 
    partialStatuses.includes(e.status.toLowerCase())
  ).length;
  
  const unavailable = employees.filter(e => 
    unavailableStatuses.includes(e.status.toLowerCase())
  ).length;
  
  const pendingRequests = requests.filter(r => r.status.toLowerCase() === "pending").length;

  const el = (id) => document.getElementById(id);
  if (el("fully-available-count")) el("fully-available-count").textContent = fullyAvailable;
  if (el("partially-available-count")) el("partially-available-count").textContent = partiallyAvailable;
  if (el("unavailable-count")) el("unavailable-count").textContent = unavailable;
  if (el("pending-requests-count")) el("pending-requests-count").textContent = pendingRequests;
}

// =============================
// LEAFLET LIVE FLEET TRACKING MAP
// =============================
let trackingMap = null;
let driverMarkers = {};
let hqMarker = null;

function initTrackingMap() {
  const mapContainer = document.getElementById("trackingMapContainer");
  if (!mapContainer || typeof L === "undefined") return;

  if (trackingMap) {
    trackingMap.remove();
    trackingMap = null;
  }

  // Default HQ location: Malalim St, Sitio Malalim, Morong, 1960 Rizal
  const hqLat = 14.546827;
  const hqLng = 121.229383;

  trackingMap = L.map("trackingMapContainer").setView([hqLat, hqLng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(trackingMap);

  // HQ Depot Marker (Blue circle / building)
  const hqIcon = L.divIcon({
    className: "custom-hq-marker",
    html: `<div style="background: #1e40af; color: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 10px rgba(30,64,175,0.5); border: 2px solid white;">🏢</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  hqMarker = L.marker([hqLat, hqLng], { icon: hqIcon })
    .addTo(trackingMap)
    .bindPopup("<strong>JRR Main Logistics HQ</strong><br>Malalim St, Sitio Malalim, Morong, 1960 Rizal");

  loadFleetLocations();

  // Refresh button
  document.getElementById("refreshMapBtn")?.addEventListener("click", loadFleetLocations);

  // Auto-refresh fleet pings every 15 seconds
  setInterval(loadFleetLocations, 15000);

  // Subscribe to Realtime driver_locations
  if (window.supabase?.createClient) {
    const client = window.supabase.createClient(
      "https://uocavssoqmwjstmvdgwq.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvY2F2c3NvcW13anN0bXZkZ3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5OTg2NjEsImV4cCI6MjA3NzU3NDY2MX0.Ki2CEQ7Wqt4eTCOHs1o0mxKdcywtBh7eEk0JAe9H4xk"
    );

    client
      .channel("live-fleet-pings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => {
          const loc = payload.new;
          if (loc && loc.latitude && loc.longitude) {
            updateDriverMarkerOnMap(loc);
          }
        }
      )
      .subscribe();
  }
}

async function loadFleetLocations() {
  if (!trackingMap) return;

  try {
    let locations = [];
    if (window.api?.tracking?.getLiveFleetLocations) {
      const res = await window.api.tracking.getLiveFleetLocations();
      locations = Array.isArray(res) ? res : res?.data || [];
    } else {
      // Fallback direct web fetch
      const res = await fetch("/api/tracking/fleet-live");
      const json = await res.json();
      locations = json?.data || [];
    }

    if (Array.isArray(locations) && locations.length > 0) {
      const allPoints = [[14.546827, 121.229383]]; // Include Morong HQ
      locations.forEach((loc) => {
        updateDriverMarkerOnMap(loc);
        if (loc.latitude && loc.longitude) {
          allPoints.push([parseFloat(loc.latitude), parseFloat(loc.longitude)]);
        }
      });

      if (allPoints.length > 1) {
        trackingMap.fitBounds(allPoints, { padding: [50, 50], maxZoom: 15 });
      }
    }
  } catch (err) {
    console.warn("Failed to load fleet GPS:", err);
  }
}

function updateDriverMarkerOnMap(loc) {
  if (!trackingMap || !loc.latitude || !loc.longitude) return;

  const driverId = loc.driver_id;
  const lat = parseFloat(loc.latitude);
  const lng = parseFloat(loc.longitude);
  if (isNaN(lat) || isNaN(lng)) return;

  const speed = loc.speed || 0;
  const driverName = loc.employees?.full_name || "Active Driver";
  const driverPhone = loc.employees?.phone ? `📞 ${loc.employees.phone}<br>` : "";
  const vehiclePlate = loc.vehicles?.plate || "Fleet Vehicle";
  const tripNumber = loc.trips?.trip_number ? `Trip: <strong>#${loc.trips.trip_number}</strong><br>` : "";

  const truckIcon = L.divIcon({
    className: "custom-truck-marker",
    html: `<div style="background: #16a34a; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 10px rgba(22,163,74,0.5); border: 2px solid white; animation: pulse 2s infinite;">🚚</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

  const popupContent = `
    <div style="font-family: inherit; font-size: 12px; line-height: 1.5; min-width: 160px;">
      <strong style="color: #1e40af; font-size: 13px;">${driverName}</strong><br>
      ${driverPhone}
      <span>Vehicle: <strong>${vehiclePlate}</strong></span><br>
      ${tripNumber}
      <span>Speed: <strong>${speed} km/h</strong></span><br>
      <small style="color: #64748b;">Ping: ${new Date(loc.updated_at || Date.now()).toLocaleTimeString()}</small>
    </div>
  `;

  if (driverMarkers[driverId]) {
    driverMarkers[driverId].setLatLng([lat, lng]);
    driverMarkers[driverId].setPopupContent(popupContent);
  } else {
    driverMarkers[driverId] = L.marker([lat, lng], { icon: truckIcon })
      .addTo(trackingMap)
      .bindPopup(popupContent);
  }
}

// =============================
// INITIAL LOAD
// =============================
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize modal DOM elements here so they're found after SPA page load
  timeOffModal = document.getElementById("timeOffModal");
  closeTimeOffModal = document.getElementById("closeTimeOffModal");
  modalEmpName = document.getElementById("modalEmpName");
  modalType = document.getElementById("modalType");
  modalDates = document.getElementById("modalDates");
  modalReason = document.getElementById("modalReason");
  modalStatus = document.getElementById("modalStatus");
  approveBtn = document.getElementById("approveBtn");
  denyBtn = document.getElementById("denyBtn");

  // Modal close
  if (closeTimeOffModal) closeTimeOffModal.onclick = () => { timeOffModal.style.display = "none"; currentRequestId = null; };

  // Approve / Deny
  if (approveBtn) approveBtn.onclick = () => handleTimeOffStatusChange("approved");
  if (denyBtn) denyBtn.onclick = () => handleTimeOffStatusChange("denied");

  // e-POD Modal Close
  const closeEpodModalBtn = document.getElementById("closeEpodModalBtn");
  const epodModal = document.getElementById("epodModal");
  if (closeEpodModalBtn) closeEpodModalBtn.onclick = () => { epodModal.style.display = "none"; };

  // Global e-POD Viewer
  window._viewEpod = async function(tripId) {
    if (!epodModal) return;
    try {
      const res = await window.api.epod.get(tripId);
      if (!res.success || !res.data) {
        alert("No e-POD data found for this trip.");
        return;
      }
      const t = res.data;
      document.getElementById("epodTripNumber").textContent = `Order #${t.trip_number || tripId}`;
      document.getElementById("epodTrackingCode").textContent = `Tracking Code: ${t.tracking_code || 'N/A'}`;
      document.getElementById("epodRecipientName").textContent = t.pod_recipient_name || 'Signed Recipient';
      document.getElementById("epodDeliveredAt").textContent = t.pod_delivered_at ? new Date(t.pod_delivered_at).toLocaleString() : 'N/A';
      document.getElementById("epodDeliveryLocation").textContent = t.delivery_location || 'Destination';

      // Signature preview
      const sigBox = document.getElementById("epodSignatureBox");
      if (t.pod_signature_data) {
        sigBox.innerHTML = `<img src="${t.pod_signature_data}" alt="Signature" style="max-height: 80px; max-width: 100%; object-fit: contain;">`;
      } else {
        sigBox.innerHTML = `<span style="font-size:12px; color:#94a3b8;">No Signature Data</span>`;
      }

      // Photo preview
      const photoBox = document.getElementById("epodPhotoBox");
      if (t.pod_photo_url) {
        photoBox.innerHTML = `<img src="${t.pod_photo_url}" alt="Cargo Photo" style="max-height: 80px; max-width: 100%; border-radius: 6px; object-fit: cover;">`;
      } else {
        photoBox.innerHTML = `<span style="font-size:12px; color:#94a3b8;">No Photo Attached</span>`;
      }

      epodModal.style.display = "flex";
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      alert("Error loading e-POD: " + err.message);
    }
  };

  // Global Copy Tracking Link
  window._copyTrackingLink = function(trackingCode) {
    if (!trackingCode) {
      alert("Tracking code not yet assigned.");
      return;
    }
    const trackingUrl = `${window.location.origin}/track/${trackingCode}`;
    navigator.clipboard.writeText(trackingUrl).then(() => {
      alert(`Customer Live Tracking link copied to clipboard!\n\n${trackingUrl}`);
    }).catch(() => {
      prompt("Copy tracking URL:", trackingUrl);
    });
  };

  // Filter buttons
  document.querySelectorAll(".filter-buttons button").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".filter-buttons button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.dataset.filter;
      renderEmployees();
    };
  });

  // ===== SEARCH LISTENER =====
  const searchEl = document.getElementById("search");
  if (searchEl) {
    searchEl.addEventListener("input", debounce(() => {
      renderEmployees();
    }, 150));
  }

  const loader = document.getElementById("loading-overlay");
  if (loader) loader.classList.add("visible");

  const startTime = Date.now();
  
  try {
    await loadEmployees();
    await loadRequests();
    initTrackingMap();
    if (window.lucide) lucide.createIcons();
  } finally {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 500 - elapsed);
    setTimeout(() => { if (loader) loader.classList.remove("visible"); }, remaining);
  }
});
