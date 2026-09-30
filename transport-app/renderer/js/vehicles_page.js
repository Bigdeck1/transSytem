// vehicles_page.js — wrapped in init function for SPA compatibility
window.initVehicles_page = function () {
  const vehicleList = document.getElementById("vehicleList");
  const searchInput = document.getElementById("searchInput");
  const filterSelect = document.getElementById("filterSelect");
  const addBtn = document.getElementById("addBtn");
  const vehicleModal = document.getElementById("vehicleModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const vehicleForm = document.getElementById("vehicleForm");

  let allVehicles = [];
  let editingVehicleId = null;

  // Clean up previous realtime listener
  if (window._vehiclesRealtimeUnsub) {
    window._vehiclesRealtimeUnsub();
    window._vehiclesRealtimeUnsub = null;
  }

  async function fetchVehicles() {
    try {
      const res = await window.api.getVehicles();
      allVehicles = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      updateStats(allVehicles);
      applyFilters();
    } catch (err) {
      console.error("❌ Error fetching vehicles:", err);
      allVehicles = [];
      updateStats(allVehicles);
      applyFilters();
    }
  }

  function updateStats(vehicles) {
    if (!Array.isArray(vehicles)) vehicles = [];
    const el = (id) => document.getElementById(id);
    if (el("stat-total")) el("stat-total").textContent = vehicles.length;
    if (el("stat-available")) el("stat-available").textContent = vehicles.filter(v => v && v.status === "available").length;
    if (el("stat-inuse")) el("stat-inuse").textContent = vehicles.filter(v => v && (v.status === "in-use" || v.status === "active")).length;
    if (el("stat-maintenance")) el("stat-maintenance").textContent = vehicles.filter(v => v && v.status === "maintenance").length;
  }

  function applyFilters() {
    const status = filterSelect?.value || "all";

    const filtered = allVehicles.filter(v => {
      return status === "all" || v.status === status;
    });

    renderVehicles(filtered);
  }

  function renderVehicles(vehicles) {
    if (!vehicleList) return;
    vehicleList.innerHTML = "";

    const status = filterSelect?.value || "all";

    if (status === "all") {
      vehicleList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">Please select a category to display vehicle assets.</p>`;
      return;
    }

    if (vehicles.length === 0) {
      vehicleList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">No matching assets found.</p>`;
      return;
    }

    vehicles.forEach((v) => {
      const card = document.createElement("div");
      card.className = "vehicle-card";
      
      card.innerHTML = `
        <div class="vehicle-tag">
           <span class="badge ${getStatusBadgeClass(v.status)}">${v.status}</span>
        </div>
        <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px;">
           <div style="width: 50px; height: 50px; background: rgba(59, 130, 246, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
              <i data-lucide="truck" size="24"></i>
           </div>
           <div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">${v.vehicle_number}</h3>
              <p style="margin: 2px 0 0; font-size: 13px; color: var(--text-muted);">${v.brand} ${v.model}</p>
           </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 20px;">
           <div>
              <div style="font-size: 10px; font-weight: 800; color: var(--text-light); text-transform: uppercase;">License Plate</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">${v.plate}</div>
           </div>
           <div>
              <div style="font-size: 10px; font-weight: 800; color: var(--text-light); text-transform: uppercase;">Vehicle Type</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">${v.vehicle_type}</div>
           </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
           <div style="display: flex; gap: 6px; flex-wrap: wrap;">
             <button onclick="window._viewVehicleAssessment('${v.id}')" style="background: var(--primary-light, #eff6ff); border: 1px solid var(--border); padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; color: var(--primary, #1e40af); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="clipboard-check" size="13"></i> Safety Audit
             </button>
             <button onclick="window._viewVehicleExpenses('${v.id}')" style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; color: #166534; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="fuel" size="13"></i> Fuel & Costs
             </button>
             <button onclick="window._editVehicle('${v.id}')" style="background: var(--bg-main); border: 1px solid var(--border); padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="settings" size="13"></i> Edit
             </button>
           </div>
           <button onclick="window._deleteVehicle('${v.id}')" style="background: none; border: none; color: var(--error); cursor: pointer; padding: 6px;">
              <i data-lucide="trash-2" size="16"></i>
           </button>
        </div>
      `;
      vehicleList.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
      case 'available': return 'badge-success';
      case 'in-use': case 'active': return 'badge-info';
      case 'maintenance': return 'badge-warning';
      case 'retired': return 'badge-error';
      default: return 'badge-info';
    }
  }

  // View Vehicle Safety Assessments
  let currentAuditedVehicleId = null;
  window._viewVehicleAssessment = async function(id) {
    const v = allVehicles.find(v => v.id == id);
    if (!v) return;

    currentAuditedVehicleId = id;
    const modal = document.getElementById("assessmentModal");
    const title = document.getElementById("assessModalTitle");
    const subtitle = document.getElementById("assessModalSubtitle");
    const auditList = document.getElementById("assessmentAuditList");
    const maintSec = document.getElementById("maintenanceClearanceSection");

    title.textContent = `${v.plate} — ${v.brand} ${v.model}`;
    subtitle.textContent = `Asset ID: ${v.vehicle_number} | Current Status: ${v.status.toUpperCase()}`;
    auditList.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">Loading inspection logs...</p>`;
    
    if (v.status === "maintenance") {
      maintSec.style.display = "block";
    } else {
      maintSec.style.display = "none";
    }

    modal.style.display = "flex";

    try {
      const assessments = await window.api.getVehicleAssessments(id);
      if (!assessments || assessments.length === 0) {
        auditList.innerHTML = `
          <div style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
            <p style="font-weight: 700; color: #475569; margin-bottom: 4px;">No Inspection Records Found</p>
            <p style="font-size: 12px; color: #94a3b8;">Driver has not yet submitted a pre-trip or post-trip assessment for this vehicle.</p>
          </div>
        `;
        return;
      }

      auditList.innerHTML = "";
      assessments.forEach(a => {
        const isFailed = a.status === "failed" || a.has_critical_failure;
        const card = document.createElement("div");
        card.style.cssText = `background: ${isFailed ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${isFailed ? '#fecaca' : '#e2e8f0'}; border-radius: 12px; padding: 16px;`;

        const checkKeys = Object.keys(a.checklist || {});
        const checklistHtml = checkKeys.map(k => `
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${a.checklist[k] ? '#dcfce7' : '#fee2e2'}; color: ${a.checklist[k] ? '#166534' : '#991b1b'}; font-weight: 600;">
            ${k.replace('_', ' ').toUpperCase()}: ${a.checklist[k] ? '✓ PASS' : '✗ FAIL'}
          </span>
        `).join(" ");

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
            <div>
              <strong style="font-size: 14px; text-transform: capitalize;">${(a.assessment_type || 'pre_trip').replace('_', '-')} Inspection</strong>
              <div style="font-size: 12px; color: #64748b;">Inspector: ${a.inspectors?.full_name || 'Driver'} (${a.inspectors?.employee_id || 'N/A'})</div>
            </div>
            <span style="font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; background: ${isFailed ? '#dc2626' : '#16a34a'}; color: white;">
              ${a.status ? a.status.toUpperCase() : 'PASSED'}
            </span>
          </div>

          <div style="display: flex; gap: 16px; font-size: 12px; color: #334155; margin-bottom: 10px; padding: 6px 0; border-top: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.05);">
            <span>Odometer: <strong>${(a.odometer_reading || 0).toLocaleString()} km</strong></span>
            <span>Fuel Level: <strong>${a.fuel_level_percentage ?? 100}%</strong></span>
            <span>Date: <strong>${new Date(a.created_at).toLocaleDateString()} ${new Date(a.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong></span>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
            ${checklistHtml || '<span style="font-size:11px; color:#94a3b8;">All standard items verified</span>'}
          </div>

          ${a.damage_notes ? `<p style="font-size: 12px; color: #991b1b; font-style: italic; margin-top: 6px;">Damage / Defect Notes: "${a.damage_notes}"</p>` : ''}
        `;
        auditList.appendChild(card);
      });
    } catch (err) {
      auditList.innerHTML = `<p style="color:var(--error); text-align:center;">Failed to load inspection history.</p>`;
    }
  };

  // View Vehicle Expenses & Fuel Logs
  window._viewVehicleExpenses = async function(id) {
    const v = allVehicles.find(v => v.id == id);
    if (!v) return;

    const modal = document.getElementById("expenseModal");
    const title = document.getElementById("expenseModalTitle");
    const subtitle = document.getElementById("expenseModalSubtitle");
    const auditList = document.getElementById("expenseAuditList");
    const fuelSpentEl = document.getElementById("expFuelSpent");
    const totalLitersEl = document.getElementById("expTotalLiters");
    const tollSpentEl = document.getElementById("expTollSpent");

    title.textContent = `${v.plate} — Fuel & Operating Expenses`;
    subtitle.textContent = `Asset ID: ${v.vehicle_number} | ${v.brand} ${v.model}`;
    auditList.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">Loading expense records...</p>`;

    modal.style.display = "flex";

    try {
      const res = await window.api.expenses.getByVehicle(id);
      const records = Array.isArray(res) ? res : (res.data || []);

      if (records.length === 0) {
        fuelSpentEl.textContent = "₱0.00";
        totalLitersEl.textContent = "0 L";
        tollSpentEl.textContent = "₱0.00";
        auditList.innerHTML = `
          <div style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
            <p style="font-weight: 700; color: #475569; margin-bottom: 4px;">No Expense Records Logged</p>
            <p style="font-size: 12px; color: #94a3b8;">Driver has not yet logged fuel refills or toll fees for this asset.</p>
          </div>
        `;
        return;
      }

      let totalFuel = 0;
      let totalLiters = 0;
      let totalTolls = 0;

      auditList.innerHTML = "";
      records.forEach(e => {
        const amt = Number(e.amount || 0);
        if (e.expense_type === 'fuel') {
          totalFuel += amt;
          totalLiters += Number(e.liters || 0);
        } else {
          totalTolls += amt;
        }

        const card = document.createElement("div");
        card.style.cssText = `background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;`;
        card.innerHTML = `
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: ${e.expense_type === 'fuel' ? '#eff6ff' : '#f0fdf4'}; color: ${e.expense_type === 'fuel' ? '#1e40af' : '#166534'}; text-transform: uppercase;">
                ${e.expense_type}
              </span>
              <strong style="font-size: 14px; color: #1e293b;">₱${amt.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              ${e.liters ? `${e.liters} Liters • ` : ''}${e.odometer ? `Odo: ${Number(e.odometer).toLocaleString()} km • ` : ''}${new Date(e.created_at).toLocaleDateString()}
            </div>
            ${e.notes ? `<p style="font-size: 12px; color: #475569; font-style: italic; margin-top: 4px;">"${e.notes}"</p>` : ''}
          </div>
          ${e.receipt_photo_url ? `<a href="${e.receipt_photo_url}" target="_blank" style="font-size: 12px; color: #3b82f6; font-weight: 700;">View Receipt ↗</a>` : ''}
        `;
        auditList.appendChild(card);
      });

      fuelSpentEl.textContent = `₱${totalFuel.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      totalLitersEl.textContent = `${totalLiters.toFixed(1)} L`;
      tollSpentEl.textContent = `₱${totalTolls.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    } catch (err) {
      auditList.innerHTML = `<p style="color:var(--error); text-align:center;">Failed to load expense records.</p>`;
    }
  };

  // Close Expense Modal
  document.getElementById("closeExpenseModalBtn")?.addEventListener("click", () => {
    document.getElementById("expenseModal").style.display = "none";
  });

  // Close Assessment Modal
  document.getElementById("closeAssessModalBtn")?.addEventListener("click", () => {
    document.getElementById("assessmentModal").style.display = "none";
  });

  // Clear Maintenance Handler
  document.getElementById("clearMaintenanceBtn")?.addEventListener("click", async () => {
    if (!currentAuditedVehicleId) return;
    if (!confirm("Confirm authorization to restore this vehicle back to AVAILABLE service?")) return;

    try {
      const res = await window.api.clearVehicleMaintenance(currentAuditedVehicleId, "Admin clearance signed off.");
      if (res.success || res.ok) {
        alert("Vehicle successfully cleared and returned to Available Fleet!");
        document.getElementById("assessmentModal").style.display = "none";
        fetchVehicles();
      } else {
        alert("Error: " + (res.error || "Failed to clear maintenance."));
      }
    } catch (err) {
      alert("System Error: " + err.message);
    }
  });

  // Expose edit/delete globally for inline onclick handlers
  window._editVehicle = function(id) {
    const v = allVehicles.find(v => v.id == id);
    if (!v) return;

    editingVehicleId = id;
    document.getElementById("modalTitle").textContent = "Edit Asset";
    
    const form = vehicleForm;
    form.vehicle_number.value = v.vehicle_number;
    form.plate.value = v.plate;
    form.vehicle_type.value = v.vehicle_type;
    form.brand.value = v.brand;
    form.model.value = v.model;
    form.status.value = v.status;

    vehicleModal.style.display = "flex";
  };

  window._deleteVehicle = async function(id) {
    if (!confirm("Are you sure you want to decommission this asset?")) return;
    try {
      const result = await window.api.deleteVehicle(id);
      if (result.success) fetchVehicles();
      else alert("Error: " + (result.error || "Unknown error"));
    } catch (err) {
      console.error("❌ Deletion Error:", err);
    }
  };

  // --- CONTROLS ---
  filterSelect?.addEventListener("change", applyFilters);

  addBtn?.addEventListener("click", () => {
    editingVehicleId = null;
    vehicleForm?.reset();
    document.getElementById("modalTitle").textContent = "Add Asset";
    vehicleModal.style.display = "flex";
  });

  closeModalBtn?.addEventListener("click", () => {
    vehicleModal.style.display = "none";
  });

  // --- FORM SUBMISSION ---
  vehicleForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(vehicleForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      let result;
      if (editingVehicleId) {
        result = await window.api.updateVehicle(editingVehicleId, payload);
      } else {
        result = await window.api.addVehicle(payload);
      }

      if (result.ok) {
        vehicleModal.style.display = "none";
        fetchVehicles();
      } else {
        alert("Registration Error: " + (result.message || result.error || "Please check all fields."));
      }
    } catch (err) {
      console.error("❌ Asset Sync Error:", err);
      alert("System Error: " + err.message);
    }
  });

  // --- INITIALIZE ---
  fetchVehicles();

  // --- REALTIME (with cleanup) ---
  window._vehiclesRealtimeUnsub = window.api.onRealtime(() => {
    fetchVehicles();
  });
};

// Auto-run
if (document.readyState !== "loading") window.initVehicles_page();
else document.addEventListener("DOMContentLoaded", window.initVehicles_page);