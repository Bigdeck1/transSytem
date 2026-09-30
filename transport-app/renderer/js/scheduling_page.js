// scheduling_page.js
window.initScheduling_page = function () {
  console.log("Scheduling Page initialized");

  // Clean up previous realtime listener
  if (window._schedulingRealtimeUnsub) {
    window._schedulingRealtimeUnsub();
    window._schedulingRealtimeUnsub = null;
  }

  // --------------------
  // DOM Elements
  // --------------------
  const tripsContainer = document.getElementById("tripsContainer");
  const tripDetails = document.getElementById("tripDetails");
  const searchInput = document.getElementById("searchInput");
  const currentDate = document.getElementById("current-date");
  const newTripBtn = document.getElementById("newTripBtn");
  const modal = document.getElementById("newTripModal");
  const closeModalBtn = modal?.querySelector(".close-modal");
  const newTripForm = document.getElementById("newTripForm");

  const inputs = {
    tripNumber: document.getElementById("tripNumberInput"),
    driver: document.getElementById("driverSelect"),
    vehicle: document.getElementById("vehicleSelect"),
    customerNumber: document.getElementById("customerNumberInput"),
    pickupLocation: document.getElementById("pickupLocationInput"),
    deliveryLocation: document.getElementById("deliveryLocationInput"),
    pickupTime: document.getElementById("pickupTimeInput"),
    deliveryTime: document.getElementById("deliveryTimeInput"),
    cargo: document.getElementById("cargoInput"),
    status: document.getElementById("status"),
  };

  const driverInfo = document.getElementById("driverInfo");
  const vehicleInfo = document.getElementById("vehicleInfo");
  const clientSelect = document.getElementById("clientSelect");
  const clientInfo = document.getElementById("clientInfo");

  // --------------------
  // State
  // --------------------
  let trips = [];
  let employees = [];
  let vehicles = [];
  let clients = [];

  let driversMap = {};
  let vehiclesMap = {};
  let clientsMap = {};
  let selectedTripId = null;
  let editingTripId = null;

  // --------------------
  // Utility Functions
  // --------------------
  const getStatusClass = (status) => {
    switch ((status || "").toLowerCase()) {
      case "scheduled":
        return "status-scheduled";
      case "in transit":
      case "in-transit":
        return "status-in-transit";
      case "completed":
        return "status-completed";
      case "delayed":
        return "status-delayed";
      default:
        return "";
    }
  };

  const formatDateTime = (dt) =>
    dt
      ? new Date(dt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "N/A";

  const showDriverInfo = () => {
    const selected = inputs.driver.options[inputs.driver.selectedIndex];
    if (!selected?.value) return (driverInfo.innerHTML = "");

    driverInfo.innerHTML = `
      <strong>Driver Details:</strong><br>
      Name: ${selected.textContent.replace("(Unavailable)", "")}<br>
      Contact: ${selected.dataset.contact || "N/A"}<br>
      Status: ${
        selected.disabled
          ? '<span style="color:#dc2626;">Unavailable</span>'
          : '<span style="color:#16a34a;">Available</span>'
      }
    `;
  };

  const showVehicleInfo = () => {
    const selected = inputs.vehicle.options[inputs.vehicle.selectedIndex];
    if (!selected?.value) return (vehicleInfo.innerHTML = "");

    vehicleInfo.innerHTML = `
      <strong>Vehicle Details:</strong><br>
      Type: ${selected.dataset.type || "N/A"}<br>
      Capacity: ${selected.dataset.capacity || "N/A"}<br>
      Status: ${
        selected.disabled
          ? '<span style="color:#dc2626;">In Use</span>'
          : '<span style="color:#16a34a;">Available</span>'
      }
    `;
  };

  const showClientInfo = () => {
    const selected = clientSelect.options[clientSelect.selectedIndex];
    if (!selected?.value) return (clientInfo.innerHTML = "");

    const c = clientsMap[selected.value];
    if (!c) return (clientInfo.innerHTML = "");

    clientInfo.innerHTML = `
      <strong>Client Details:</strong><br>
      Name: ${c.name}<br>
      Email: ${c.email || "N/A"}<br>
      Phone: ${c.phone || "N/A"}
    `;

    if (c.customer_number) {
      inputs.customerNumber.value = c.customer_number;
    }
  };

  // --------------------
  // Load Data
  // --------------------
  const loadResources = async () => {
    try {
      [vehicles, employees, trips, clients] = await Promise.all([
        window.api.getVehicles() || [],
        window.api.getEmployees() || [],
        window.api.getTrips() || [],
        window.api.getClients() || [],
      ]);

      // Map
      driversMap = {};
      employees.forEach((e) => (driversMap[e.id] = e));
      vehiclesMap = {};
      vehicles.forEach((v) => (vehiclesMap[v.id] = v));
      clientsMap = {};
      clients.forEach((c) => (clientsMap[c.id] = c));

      // Which driver/vehicle ids are in active trips?
      const busyDrivers = trips
        .filter((t) =>
          ["pending", "scheduled", "in transit", "in-transit", "inprogress"].includes(
            (t.status || "").toLowerCase()
          )
        )
        .map((t) => t.driver_id)
        .filter(Boolean);

      const busyVehicles = trips
        .filter((t) =>
          ["pending", "scheduled", "in transit", "in-transit", "inprogress"].includes(
            (t.status || "").toLowerCase()
          )
        )
        .map((t) => t.vehicle_id)
        .filter(Boolean);

      // Populate drivers — use employee.status too (we only use available/unavailable)
      inputs.driver.innerHTML = '<option value="">Select Driver</option>';
      employees
        .filter((e) => e.position?.toLowerCase() === "driver")
        .forEach((d) => {
          const empStatus = (d.status || "available").toLowerCase();
          const busy = busyDrivers.includes(d.id) || empStatus !== "available";
          const opt = document.createElement("option");
          opt.value = d.id;
          opt.textContent = `${d.full_name} ${busy ? "(Unavailable)" : ""} ${d.phone ? `(${d.phone})` : ""}`;
          opt.disabled = !!busy;
          opt.dataset.contact = d.phone || "";
          inputs.driver.appendChild(opt);
        });

      // Populate vehicles
      inputs.vehicle.innerHTML = '<option value="">Select Vehicle</option>';
      vehicles.forEach((v) => {
        const vehicleStatus = (v.status || "available").toLowerCase();
        const busy = busyVehicles.includes(v.id) || vehicleStatus === "in-use";
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.vehicle_type || "Vehicle"} — ${v.plate} ${busy ? "(In Use)" : ""}`;
        opt.disabled = !!busy;
        opt.dataset.type = v.vehicle_type || "";
        opt.dataset.capacity = v.capacity || "";
        inputs.vehicle.appendChild(opt);
      });

      // Populate clients
      clientSelect.innerHTML = '<option value="">Select Client</option>';
      clients.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        clientSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load resources:", err);
    }
  };

  const loadTrips = async () => {
    try {
      trips = await window.api.getTrips();
      renderTrips(searchInput.value);
    } catch (err) {
      console.error("Failed to load trips:", err);
    }
  };

  const loadTripNumber = async () => {
    const allTrips = await window.api.getTrips();
    // Generate from MAX existing trip number to prevent collision after deletions
    let maxNum = 0;
    (allTrips || []).forEach(t => {
      const match = String(t.trip_number || "").match(/TRP-(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    inputs.tripNumber.value = `TRP-${String(maxNum + 1).padStart(4, "0")}`;
  };

  const loadCustomerNumber = async () => {
    const allTrips = await window.api.getTrips();
    let maxNum = 0;
    (allTrips || []).forEach(t => {
      const match = String(t.customer_number || "").match(/CUS-(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    inputs.customerNumber.value = `CUS-${String(maxNum + 1).padStart(4, "0")}`;
  };

  // --------------------
  // Rendering Logic
  // --------------------
  const renderTrips = (filter = "") => {
    tripsContainer.innerHTML = "";

    const search = (filter || "").trim().toLowerCase();
    if (!search) {
      tripsContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; padding: 40px;">Please use the search bar to display dispatch records.</p>';
      return;
    }

    const filtered = trips.filter((trip) => {
      return (
        (trip.trip_number || "").toLowerCase().includes(search) ||
        (driversMap[trip.driver_id]?.full_name || "").toLowerCase().includes(search) ||
        (vehiclesMap[trip.vehicle_id]?.plate || "").toLowerCase().includes(search) ||
        (clientsMap[trip.client_id]?.name || "").toLowerCase().includes(search)
      );
    });

    if (!filtered.length) {
      tripsContainer.innerHTML = '<p style="text-align:center; color:#94a3b8;">No trips found</p>';
      return;
    }

    filtered.forEach((trip) => {
      const btn = document.createElement("div");
      btn.className = "trip-item" + (trip.id === selectedTripId ? " active" : "");
      btn.innerHTML = `
        <h3>${trip.trip_number}</h3>
        <p>${driversMap[trip.driver_id]?.full_name || "N/A"} • ${vehiclesMap[trip.vehicle_id]?.plate || "N/A"}</p>
        <span class="status-badge ${getStatusClass(trip.status)}">${trip.status}</span>
      `;
      btn.onclick = () => selectTrip(trip.id);
      tripsContainer.appendChild(btn);
    });
  };

  const selectTrip = (id) => {
    const trip = trips.find((t) => t.id === id);
    selectedTripId = id;
    renderTrips(searchInput.value);

    if (!trip) {
      tripDetails.innerHTML = '<p style="text-align:center;">Select a trip</p>';
      return;
    }

    const driver = driversMap[trip.driver_id];
    const vehicle = vehiclesMap[trip.vehicle_id];
    const client = clientsMap[trip.client_id];

    tripDetails.innerHTML = `
      <div class="trip-details-content">
        <div class="detail-card">
          <h4>Trip Number</h4>
          <p>${trip.trip_number}</p>
        </div>

        <div class="detail-card">
          <h4>Status</h4>
          <select id="updateStatusSelect">
            <option value="Pending" ${trip.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="In Transit" ${trip.status === "In Transit" ? "selected" : ""}>In Transit</option>
            <option value="Completed" ${trip.status === "Completed" ? "selected" : ""}>Completed</option>
            <option value="Cancelled" ${trip.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
            <option value="Delayed" ${trip.status === "Delayed" ? "selected" : ""}>Delayed</option>
          </select>
          <button id="saveStatusBtn">Update</button>
        </div>

        <div class="detail-card">
          <h4>Driver</h4>
          <p>${driver?.full_name || "N/A"}</p>
          <small>Contact: ${driver?.phone || "N/A"}</small>
        </div>

        <div class="detail-card">
          <h4>Vehicle</h4>
          <p>${vehicle?.plate || "N/A"}</p>
          <small>Type: ${vehicle?.vehicle_type || "N/A"}</small>
        </div>

        <div class="detail-card">
          <h4>Pickup</h4>
          <p>${trip.pickup_location} at ${formatDateTime(trip.pickup_time)}</p>
        </div>

        <div class="detail-card">
          <h4>Delivery</h4>
          <p>${trip.delivery_location} at ${formatDateTime(trip.delivery_time)}</p>
        </div>

        <div class="detail-card">
          <h4>Cargo</h4>
          <p>${trip.cargo}</p>
        </div>

        <div class="detail-card">
          <h4>Customer No.</h4>
          <p>${trip.customer_number}</p>
        </div>

        <div class="detail-card" style="background: rgba(37,99,235,0.06); border-color: rgba(37,99,235,0.25);">
          <h4>Tracking Code</h4>
          <p style="font-family: monospace; font-weight: 700; color: #1e40af;">${trip.tracking_code || trip.trip_number}</p>
          <div style="display: flex; gap: 8px; margin-top: 6px;">
            <button id="copyTrackLinkBtn" style="padding: 4px 8px; font-size: 11px; background: #1e40af; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              Copy Live Link
            </button>
            <a href="/track/${trip.tracking_code || trip.trip_number}" target="_blank" style="padding: 4px 8px; font-size: 11px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center;">
              Open Radar ↗
            </a>
          </div>
        </div>

        <div class="trip-actions" style="grid-column: 1 / -1; display: flex; gap: 12px; margin-top: 16px;">
          <button id="editTripBtn" class="btn-primary">Edit Trip</button>
          <button id="deleteTripBtn" class="btn-secondary" style="background: var(--error-bg); color: var(--error); border-color: var(--error);">Delete Trip</button>
        </div>
      </div>
    `;

    document.getElementById("copyTrackLinkBtn")?.addEventListener("click", () => {
      const trackingUrl = `${window.location.origin}/track/${trip.tracking_code || trip.trip_number}`;
      navigator.clipboard.writeText(trackingUrl);
      alert(`Customer Tracking Link copied to clipboard:\n${trackingUrl}`);
    });

    document.getElementById("saveStatusBtn").addEventListener("click", async () => {
      const newStatus = document.getElementById("updateStatusSelect").value;
      const result = await window.api.updateTripStatus(id, newStatus);
      if (!result.success) return alert("Failed to update: " + (result.error || ""));
      // After update, main will recalculate statuses for driver/vehicle. Just refresh UI.
      await loadResources();
      await loadTrips();
      selectTrip(id);
    });

    document.getElementById("editTripBtn")?.addEventListener("click", () => {
      editingTripId = id;
      modal.style.display = "flex";
      
      // Remove disabled state temporarily to allow selecting current values
      Array.from(inputs.driver.options).forEach(opt => opt.disabled = false);
      Array.from(inputs.vehicle.options).forEach(opt => opt.disabled = false);

      inputs.tripNumber.value = trip.trip_number || "";
      inputs.driver.value = trip.driver_id || "";
      inputs.vehicle.value = trip.vehicle_id || "";
      clientSelect.value = trip.client_id || "";
      inputs.customerNumber.value = trip.customer_number || "";
      inputs.pickupLocation.value = trip.pickup_location || "";
      inputs.deliveryLocation.value = trip.delivery_location || "";
      
      if (trip.pickup_time) inputs.pickupTime.value = new Date(trip.pickup_time).toISOString().slice(0, 16);
      if (trip.delivery_time) inputs.deliveryTime.value = new Date(trip.delivery_time).toISOString().slice(0, 16);
      
      inputs.cargo.value = trip.cargo || "";
      inputs.status.value = trip.status || "Pending";
      
      showDriverInfo();
      showVehicleInfo();
      showClientInfo();
    });

    document.getElementById("deleteTripBtn")?.addEventListener("click", async () => {
      if (confirm(`Are you sure you want to delete trip ${trip.trip_number}? This action cannot be undone.`)) {
        const result = await window.api.deleteTrip(id);
        if (!result.success) return alert("Failed to delete trip: " + (result.error || ""));
        selectedTripId = null;
        await loadResources();
        await loadTrips();
      }
    });
  };

  // --------------------
  // Modal handling
  // --------------------
  const openModal = async () => {
    editingTripId = null;
    modal.style.display = "flex";
    newTripForm.reset();
    driverInfo.innerHTML = vehicleInfo.innerHTML = clientInfo.innerHTML = "";

    // Set calendar min date to now (prevent scheduling in the past)
    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    inputs.pickupTime.min = localISO;
    inputs.deliveryTime.min = localISO;

    await Promise.all([loadTripNumber(), loadCustomerNumber(), loadResources()]);
  };

  // When pickup time changes, update delivery min to be after pickup
  inputs.pickupTime.addEventListener("change", () => {
    if (inputs.pickupTime.value) {
      inputs.deliveryTime.min = inputs.pickupTime.value;
      // Clear delivery if it's now before pickup
      if (inputs.deliveryTime.value && inputs.deliveryTime.value <= inputs.pickupTime.value) {
        inputs.deliveryTime.value = "";
      }
    }
  });
  const closeModal = () => (modal.style.display = "none");

  newTripBtn.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  // Only close modal on Escape if it's currently visible
  const _schedulingEscapeHandler = (e) => {
    if (e.key === "Escape" && modal && modal.style.display === "flex") closeModal();
  };
  document.addEventListener("keydown", _schedulingEscapeHandler);

  // --------------------
  // Package Estimation & Dual-Leg Calculator
  // --------------------
  const pkgInputs = {
    length: document.getElementById("pkgLength"),
    width: document.getElementById("pkgWidth"),
    height: document.getElementById("pkgHeight"),
    weight: document.getElementById("pkgWeight"),
    fragile: document.getElementById("pkgFragile"),
    express: document.getElementById("pkgExpress"),
    volWeight: document.getElementById("estVolWeight"),
    chargeableWeight: document.getElementById("estChargeableWeight"),
    vehicleTier: document.getElementById("estVehicleTier"),
    fareAmount: document.getElementById("estFareAmount"),
  };

  let currentPackageEstimate = null;
  let currentDualLegEstimate = null;

  const updatePackageEstimation = async () => {
    const l = parseFloat(pkgInputs.length?.value) || 0;
    const w = parseFloat(pkgInputs.width?.value) || 0;
    const h = parseFloat(pkgInputs.height?.value) || 0;
    const wt = parseFloat(pkgInputs.weight?.value) || 0;

    if (l > 0 && w > 0 && h > 0) {
      if (window.api?.tracking?.estimatePackage) {
        const res = await window.api.tracking.estimatePackage({
          lengthCm: l,
          widthCm: w,
          heightCm: h,
          actualWeightKg: wt,
          distanceKm: currentDualLegEstimate?.totalDistanceKm || 25,
          isFragile: pkgInputs.fragile?.checked,
          isExpress: pkgInputs.express?.checked,
        });

        if (res?.success && res?.data) {
          currentPackageEstimate = res.data;
          if (pkgInputs.volWeight) pkgInputs.volWeight.textContent = `${res.data.volumetricWeightKg} kg`;
          if (pkgInputs.chargeableWeight) pkgInputs.chargeableWeight.textContent = `${res.data.chargeableWeightKg} kg`;
          if (pkgInputs.vehicleTier) pkgInputs.vehicleTier.textContent = res.data.recommendedVehicle;
          if (pkgInputs.fareAmount) pkgInputs.fareAmount.textContent = `₱${res.data.totalEstimatedCost.toLocaleString()}`;
        }
      }
    }
  };

  [pkgInputs.length, pkgInputs.width, pkgInputs.height, pkgInputs.weight, pkgInputs.fragile, pkgInputs.express].forEach(el => {
    el?.addEventListener("input", updatePackageEstimation);
    el?.addEventListener("change", updatePackageEstimation);
  });

  // Calculate Dual-Leg Route
  const calcRouteBtn = document.getElementById("calcRouteBtn");
  calcRouteBtn?.addEventListener("click", async () => {
    const pickup = inputs.pickupLocation.value.trim();
    const delivery = inputs.deliveryLocation.value.trim();
    if (!pickup || !delivery) {
      return alert("Please enter both pickup and delivery locations first.");
    }

    calcRouteBtn.textContent = "Calculating...";
    try {
      if (window.api?.tracking?.getDualLegEstimate) {
        // Mock approximate lat/long coordinates based on location strings
        const res = await window.api.tracking.getDualLegEstimate({
          hq: { lat: 14.546827, lng: 121.229383, address: "Malalim St, Sitio Malalim, Morong, 1960 Rizal" },
          pickup: { lat: 14.5547, lng: 121.0244, address: pickup },
          delivery: { lat: 14.6760, lng: 121.0437, address: delivery }
        });

        if (res.success && res.data) {
          currentDualLegEstimate = res.data;
          const leg1 = res.data.dispatchLeg;
          const leg2 = res.data.transitLeg;
          
          document.getElementById("leg1Stats").textContent = `${leg1.distanceKm} km • ~${leg1.durationMins} mins`;
          document.getElementById("leg2Stats").textContent = `${leg2.distanceKm} km • ~${leg2.durationMins} mins`;
          updatePackageEstimation();
        }
      }
    } catch (err) {
      console.warn("Route estimation failed:", err);
    } finally {
      calcRouteBtn.textContent = "Calculate Route";
    }
  });

  // Dropdown listeners
  inputs.driver.addEventListener("change", showDriverInfo);
  inputs.vehicle.addEventListener("change", showVehicleInfo);
  clientSelect.addEventListener("change", showClientInfo);

  // Add Trip
  newTripForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const driverOpt = inputs.driver.options[inputs.driver.selectedIndex];
    const vehicleOpt = inputs.vehicle.options[inputs.vehicle.selectedIndex];

    if (driverOpt?.disabled) return alert("Selected driver unavailable");
    if (vehicleOpt?.disabled) return alert("Vehicle in use");

    // Date validation
    if (inputs.pickupTime.value && inputs.deliveryTime.value) {
      const pickup = new Date(inputs.pickupTime.value);
      const delivery = new Date(inputs.deliveryTime.value);
      if (delivery <= pickup) {
        return alert("Delivery time must be after pickup time.");
      }
    }

    if (!inputs.pickupLocation.value.trim() || !inputs.deliveryLocation.value.trim()) {
      return alert("Pickup and delivery locations are required.");
    }

    const tripPayload = {
      trip_number: inputs.tripNumber.value,
      driver_id: inputs.driver.value || null,
      vehicle_id: inputs.vehicle.value || null,
      client_id: clientSelect.value || null,
      customer_number: inputs.customerNumber.value,
      pickup_location: inputs.pickupLocation.value,
      delivery_location: inputs.deliveryLocation.value,
      pickup_time: inputs.pickupTime.value,
      delivery_time: inputs.deliveryTime.value,
      cargo: inputs.cargo.value,
      status: inputs.status.value || "Pending",
      package_length_cm: parseFloat(pkgInputs.length?.value) || null,
      package_width_cm: parseFloat(pkgInputs.width?.value) || null,
      package_height_cm: parseFloat(pkgInputs.height?.value) || null,
      package_weight_kg: parseFloat(pkgInputs.weight?.value) || null,
      volumetric_weight_kg: currentPackageEstimate?.volumetricWeightKg || null,
      chargeable_weight_kg: currentPackageEstimate?.chargeableWeightKg || null,
      estimated_fare: currentPackageEstimate?.totalEstimatedCost || null,
      leg1_distance_km: currentDualLegEstimate?.dispatchLeg?.distanceKm || null,
      leg1_duration_mins: currentDualLegEstimate?.dispatchLeg?.durationMins || null,
      leg2_distance_km: currentDualLegEstimate?.transitLeg?.distanceKm || null,
      leg2_duration_mins: currentDualLegEstimate?.transitLeg?.durationMins || null,
      total_est_duration_mins: currentDualLegEstimate?.totalDurationMins || null,
    };

    if (editingTripId) {
      const result = await window.api.updateTrip(editingTripId, tripPayload);
      if (!result.success) {
        alert("Failed to update: " + result.error);
        return;
      }
      alert("Trip updated!");
    } else {
      const result = await window.api.addTrip(tripPayload);
      if (!result.success) {
        alert("Failed to create: " + result.error);
        // Force-reload resources in case of partial changes
        await loadResources();
        await loadTrips();
        return;
      }
      alert("Trip created with automated estimation!");
    }

    // UI feedback
    closeModal();

    // load fresh data (main recalc runs server-side)
    await loadResources();
    await loadTrips();
  });

  // Search
  searchInput.addEventListener("input", (e) => renderTrips(e.target.value));

  // Realtime: react to DB changes pushed from main
  if (window.api && window.api.onRealtime) {
    window._schedulingRealtimeUnsub = window.api.onRealtime((evt, data) => {
      try {
        if (!data || !data.table) return;
        if (["trips", "vehicles", "employees", "clients"].includes(data.table)) {
          loadResources();
          loadTrips();
        }
      } catch (e) {
        console.error("realtime handler err:", e);
      }
    });
  }

  // Date text
  currentDate.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Initial load
  (async () => {
    const loader = document.getElementById("loading-overlay");
    loader?.classList.add("visible");
    const start = Date.now();
    try {
      await loadResources();
      await loadTrips();
      if (window.lucide) window.lucide.createIcons();
    } finally {
      const delta = Date.now() - start;
      setTimeout(() => loader?.classList.remove("visible"), Math.max(0, 500 - delta));
    }
  })();
};

// Auto-run
if (document.readyState !== "loading") window.initScheduling_page();
else document.addEventListener("DOMContentLoaded", window.initScheduling_page);
