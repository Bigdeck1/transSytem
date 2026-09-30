// client_history_page.js (optimized + client_id FIXED)

document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM Refs ----------
  const clientList = document.getElementById("clientList");
  const searchInput = document.getElementById("searchInput");
  const filterStatus = document.getElementById("filterStatus");
  const filterType = document.getElementById("filterType");
  const loadingOverlay = document.getElementById("loading-overlay");
  const filterSection = document.querySelector(".filter-section");
  const addBtn = document.getElementById("addClientBtn");
  const addModal = document.getElementById("addClientModal");
  const addForm = document.getElementById("addClientForm");
  const editModal = document.getElementById("editClientModal");
  const editForm = document.getElementById("editClientForm");
  const editCloseBtn = document.getElementById("editCloseBtn");

  // fallback history modal
  let historyModal = document.getElementById("historyModal");
  let historyCloseBtn, historyLoading, historyContent;
  if (!historyModal) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="modal" id="historyModal" style="display:none;position:fixed;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:1250">
        <div class="modal-content" style="width:900px;max-height:80vh;overflow:auto;background:#fff;border-radius:10px;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h2>Client History</h2>
            <button id="historyCloseBtn">✕</button>
          </div>
          <div id="historyLoading" style="display:none;">Loading...</div>
          <div id="historyContent" style="margin-top:12px;"></div>
        </div>
      </div>`
    );
    historyModal = document.getElementById("historyModal");
  }
  historyCloseBtn = document.getElementById("historyCloseBtn");
  historyLoading = document.getElementById("historyLoading");
  historyContent = document.getElementById("historyContent");

  // ---------- State ----------
  let clients = [];
  let expandedId = null;
  let currentPage = 1;
  let pageSize = 10;
  let sortBy = "name_asc";
  let lastFiltered = [];

  // ---------- Utility helpers ----------
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(unsafe) {
    if (!unsafe && unsafe !== 0) return "";
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function showOverlay(show = true) {
    if (!loadingOverlay) return;
    if (show) loadingOverlay.classList.add("visible");
    else loadingOverlay.classList.remove("visible");
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("show");
    if (getComputedStyle(modalEl).display === "none") modalEl.style.display = "flex";
  }
  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("show");
    if (modalEl.style.display) modalEl.style.display = "none";
  }

  function debounce(fn, wait = 220) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ---------- Controls injection (sort/pagination) ----------
  function injectControls() {
    if (!filterSection || filterSection.querySelector(".extra-controls")) return;

    const controls = document.createElement("div");
    controls.className = "extra-controls";
    controls.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:0.8rem;color:#94a3b8;margin-right:6px;">Sort</label>
        <select id="sortSelect">
          <option value="name_asc">Name A → Z</option>
          <option value="name_desc">Name Z → A</option>
          <option value="active_first">Active first</option>
          <option value="business_first">Business first</option>
          <option value="recent">Most recent</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-left:12px;">
        <label style="font-size:0.8rem;color:#94a3b8;margin-right:6px;">Page</label>
        <select id="pageSizeSelect">
          <option value="5">5</option>
          <option value="10" selected>10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
        <button id="prevPageBtn" class="pagination-btn">Prev</button>
        <span id="paginationInfo" style="font-size:0.9rem;color:#94a3b8;"></span>
        <button id="nextPageBtn" class="pagination-btn">Next</button>
      </div>
    `;
    filterSection.appendChild(controls);

    controls.querySelector("#sortSelect").addEventListener("change", (e) => {
      sortBy = e.target.value;
      currentPage = 1;
      renderClients();
    });

    controls.querySelector("#pageSizeSelect").addEventListener("change", (e) => {
      pageSize = Number(e.target.value) || 10;
      currentPage = 1;
      renderClients();
    });

    controls.querySelector("#prevPageBtn").addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderClients();
      }
    });

    controls.querySelector("#nextPageBtn").addEventListener("click", () => {
      const totalPages = Math.ceil(lastFiltered.length / pageSize) || 1;
      if (currentPage < totalPages) {
        currentPage++;
        renderClients();
      }
    });
  }

  // ---------- Load clients ----------
  async function loadClients() {
    try {
      const resp = await window.api.getClients();
      clients = Array.isArray(resp) ? resp : (resp?.data || []);
      clients = clients.map((c) => ({ ...c, created_at: c.created_at ?? c.created_at }));
    } catch (err) {
      console.error("Error loading clients:", err);
      clients = [];
    }
    renderClients();
  }

  // ---------- Render ----------
  function renderClients() {
    const search = (searchInput?.value || "").trim().toLowerCase();
    const status = (filterStatus?.value) || "all";
    const type = (filterType?.value) || "all";

    if (!search && status === "all" && type === "all") {
      clientList.innerHTML = `<div class="empty"><i data-lucide="search"></i><br>Please use the search bar or filters to display clients</div>`;
      lucide.createIcons();
      updatePaginationInfo(0, 0, 0);
      return;
    }

    lastFiltered = clients.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const company = (c.company_name || "").toLowerCase();

      const matchesSearch = !search || name.includes(search) || email.includes(search) || company.includes(search);
      const matchesStatus = status === "all" || c.status === status;
      const matchesType = type === "all" || c.client_type === type;

      return matchesSearch && matchesStatus && matchesType;
    });

    lastFiltered.sort((a, b) => {
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "active_first") return (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1);
      if (sortBy === "business_first") return (a.client_type === "business" ? -1 : 1) - (b.client_type === "business" ? -1 : 1);
      if (sortBy === "recent") return new Date(b.created_at) - new Date(a.created_at);
      return 0;
    });

    const total = lastFiltered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = lastFiltered.slice(start, start + pageSize);

    clientList.innerHTML = "";
    if (pageItems.length === 0) {
      clientList.innerHTML = `<div class="empty"><i data-lucide="user"></i><br>No clients found</div>`;
      lucide.createIcons();
      updatePaginationInfo(total, start, 0);
      return;
    }

    const frag = document.createDocumentFragment();
    pageItems.forEach((client) => {
      const div = document.createElement("div");
      div.className = "client-card";

      // Use the database primary key 'id' (not 'client_id' which doesn't exist in schema)
      div.dataset.clientId = client.id;

      div.innerHTML = `
        <div class="client-header" style="display:flex;justify-content:space-between;">
          <div class="client-info" style="display:flex;gap:12px;">
            <div class="client-icon" style="width:48px;height:48px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <i data-lucide="${client.client_type === "business" ? "building-2" : "user"}"></i>
            </div>
            <div>
              <h3>${escapeHtml(client.name)}</h3>
              ${client.company_name ? `<p>${escapeHtml(client.company_name)}</p>` : ""}
              <p style="color:#94a3b8;font-size:0.9rem;">
                <i data-lucide="mail"></i> ${escapeHtml(client.email)} |
                <i data-lucide="phone"></i> ${escapeHtml(client.phone)}
              </p>
            </div>
          </div>
          
          <div style="text-align:right;">
            <span class="badge">${escapeHtml(client.status)}</span>
            <span class="badge">${escapeHtml(client.client_type)}</span>
            <small style="color:#94a3b8;"><i data-lucide="calendar"></i> ${formatDate(client.created_at)}</small>
          </div>
        </div>
        ${expandedId == client.id ? `
          <div class="client-details" style="margin-top:12px;border-top:1px solid #e6edf3;padding-top:12px;">
            <h4>Client Details</h4>
            <div class="actions" style="display:flex;gap:8px;margin-top:12px;">
              <button class="btn-history" data-id="${client.id}"><i data-lucide="clock"></i> History</button>
              <button class="btn-edit" data-id="${client.id}"><i data-lucide="edit-2"></i> Edit</button>
              <button class="btn-delete" data-id="${client.id}" style="background:#fee2e2;color:#b91c1c;">
                <i data-lucide="trash-2"></i> Delete
              </button>
            </div>
          </div>` : ""}
      `;
      frag.appendChild(div);
    });

    clientList.appendChild(frag);
    lucide.createIcons();
    updatePaginationInfo(total, start, pageItems.length);
  }

  function updatePaginationInfo(total, start, shown) {
    const info = document.getElementById("paginationInfo");
    if (!info) return;
    const from = total === 0 ? 0 : start + 1;
    const to = start + shown;
    info.textContent = `Showing ${from}–${to} of ${total}`;
  }

  // ---------- Click Delegation ----------
  clientList.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    const card = ev.target.closest(".client-card");
    if (!card) return;

    const clientId = card.dataset.clientId;

    if (!btn) {
      expandedId = expandedId === clientId ? null : clientId;
      renderClients();
      return;
    }

    ev.stopPropagation();

    if (btn.classList.contains("btn-delete")) {
      if (!confirm("Delete this client?")) return;
      try {
        const res = await window.api.deleteClient(clientId);
        if (res?.success) {
          clients = clients.filter(c => String(c.id) !== String(clientId)); // Use 'id' column
          renderClients();
        } else alert("Delete failed");
      } catch (err) {
        console.error(err);
        alert("Server error");
      }
      return;
    }

    if (btn.classList.contains("btn-edit")) {
      openEditModal(clientId);
      return;
    }

    if (btn.classList.contains("btn-history")) {
      openHistoryModal(clientId);
      return;
    }
  });

  // ---------- Edit modal ----------
  function openEditModal(id) {
    const client = clients.find((c) => String(c.id) === String(id)); // Use 'id' column
    if (!client) return;

    q("#editClientId", editForm).value = client.id;
    q("#editClientName", editForm).value = client.name ?? "";
    q("#editClientEmail", editForm).value = client.email ?? "";
    q("#editClientPhone", editForm).value = client.phone ?? "";
    q("#editClientType", editForm).value = client.client_type ?? "individual";
    q("#editClientStatus", editForm).value = client.status ?? "active";

    openModal(editModal);
  }

  editCloseBtn?.addEventListener("click", () => closeModal(editModal));

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = q("#editClientId", editForm).value;

    const updated = {
      name: q("#editClientName", editForm).value,
      email: q("#editClientEmail", editForm).value,
      phone: q("#editClientPhone", editForm).value,
      client_type: q("#editClientType", editForm).value,
      status: q("#editClientStatus", editForm).value,
    };

    try {
      const res = await window.api.updateClient(id, updated);
      if (res?.success) {
        const idx = clients.findIndex(c => String(c.id) === String(id)); // Use 'id' column
        if (idx >= 0) clients[idx] = { ...clients[idx], ...updated };
        closeModal(editModal);
        renderClients();
      } else alert("Update failed");
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  });

  // ---------- Add client ----------
  if (addBtn && addModal && addForm) {
    addBtn.addEventListener("click", () => openModal(addModal));
    const addCloseBtn = q("#closeModalBtn", addModal);
    addCloseBtn?.addEventListener("click", () => closeModal(addModal));

    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newClient = {
        name: q("#clientName", addForm).value,
        email: q("#clientEmail", addForm).value,
        phone: q("#clientPhone", addForm).value,
        client_type: q("#clientType", addForm).value,
        status: q("#clientStatus", addForm).value,
      };

      try {
        const res = await window.api.addClient(newClient);
        if (res?.success) {
          const created = res.data ?? res.client ?? newClient;
          clients.push(created);
          addForm.reset();
          closeModal(addModal);
          renderClients();
        } else alert("Failed to create client");
      } catch (err) {
        console.error(err);
        alert("Server error");
      }
    });
  }

  // ---------- History Modal ----------
  historyCloseBtn?.addEventListener("click", () => closeModal(historyModal));

  async function openHistoryModal(clientId) {
    historyContent.innerHTML = "";
    historyLoading.style.display = "block";
    openModal(historyModal);

    const client = clients.find((c) => String(c.id) === String(clientId)); // Use 'id' column
    if (!client) {
      historyContent.innerHTML = `<p>Client not found.</p>`;
      historyLoading.style.display = "none";
      return;
    }

    try {
      const trips = (await window.api.getClientHistory({
        clientId: client.id, // Use 'id' column from DB schema
        email: client.email,
        phone: client.phone,
      })) || [];

      historyContent.innerHTML = `
        <h3>${escapeHtml(client.name)}</h3>
        <p>${escapeHtml(client.email)} • ${escapeHtml(client.phone)}</p>
        <hr>
      `;

      if (!Array.isArray(trips) || trips.length === 0) {
        historyContent.innerHTML += `<p>No trips found.</p>`;
      } else {
        const rows = trips
          .map(
            (t) => `
            <tr>
              <td>${escapeHtml(t.trip_number)}</td>
              <td>${formatDate(t.pickup_time || t.created_at)}</td>
              <td>${escapeHtml(t.pickup_location || "")}</td>
              <td>${escapeHtml(t.delivery_location || "")}</td>
              <td>${escapeHtml(t.cargo || "")}</td>
              <td>${t.amount ? "₱" + Number(t.amount).toLocaleString() : ""}</td>
              <td>${escapeHtml(t.status || "")}</td>
            </tr>`
          )
          .join("");

        historyContent.innerHTML += `
          <div style="overflow:auto">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th>Trip #</th>
                  <th>Date</th>
                  <th>Pickup</th>
                  <th>Delivery</th>
                  <th>Cargo</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      historyContent.innerHTML += `<p>Error loading history.</p>`;
    } finally {
      historyLoading.style.display = "none";
      lucide.createIcons();
    }
  }

  // ---------- Filters & search ----------
  const debouncedRender = debounce(() => {
    currentPage = 1;
    renderClients();
  }, 220);

  searchInput?.addEventListener("input", debouncedRender);
  filterStatus?.addEventListener("change", () => {
    currentPage = 1;
    renderClients();
  });
  filterType?.addEventListener("change", () => {
    currentPage = 1;
    renderClients();
  });

  // ---------- Initial load ----------
  (async () => {
    showOverlay(true);
    const start = Date.now();
    try {
      injectControls();
      await loadClients();
      lucide.createIcons();
    } finally {
      const delay = Math.max(0, 500 - (Date.now() - start));
      setTimeout(() => showOverlay(false), delay);
    }
  })();

  window.__openClientHistoryModal = openHistoryModal;
});
