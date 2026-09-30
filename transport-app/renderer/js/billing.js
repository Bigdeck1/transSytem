// =========================
// DOM ELEMENTS
// =========================
const modal = document.getElementById("invoiceModal");
const createBtn = document.getElementById("createBtn");
const closeModal = document.getElementById("closeModal");
const cancelModal = document.getElementById("cancelModal");
const invoiceTable = document.getElementById("invoiceTableBody");
const form = document.getElementById("invoiceForm");
const searchInput = document.getElementById("searchInput");

const invoiceNumber = document.getElementById("invoiceNumber");
const clientName = document.getElementById("clientName");
const driverName = document.getElementById("driverName");
const vehicleName = document.getElementById("vehicleName");
const program = document.getElementById("program");
const area = document.getElementById("area");
const hours = document.getElementById("hours");
const sro = document.getElementById("sro");
const vtt = document.getElementById("vtt");
const amount = document.getElementById("amount");
const status = document.getElementById("status");
const issueDate = document.getElementById("issueDate");
const dueDate = document.getElementById("dueDate");
const description = document.getElementById("description");

const totalInvoicesEl = document.getElementById("totalInvoices");
const totalAmountEl = document.getElementById("totalAmount");

// =========================
// GLOBAL STATE
// =========================
let invoices = [];
let clients = [];
let drivers = [];
let vehicles = [];
let editingId = null;

// =========================
// LOAD DATA
// =========================
async function loadInvoices() {
    const result = await window.api.billing.getAll();
    invoices = Array.isArray(result) ? result : (result?.data || []);
    renderInvoices();
}

async function loadDropdownData() {
    clients = (await window.api.getClients()) || [];
    drivers = ((await window.api.getEmployees()) || []).filter(e => e.position === "Driver");
    vehicles = (await window.api.getVehicles()) || [];

    populateSelect(clientName, clients, "id", "name");
    populateSelect(driverName, drivers, "id", "full_name");
    populateSelect(vehicleName, vehicles, "id", "plate");
}

function populateSelect(select, list, valueField, labelField) {
    if (!select) return;
    select.innerHTML = "<option value=''>Select...</option>";
    list.forEach(item => {
        const option = document.createElement("option");
        option.value = item[valueField];
        option.textContent = item[labelField];
        select.appendChild(option);
    });
}

// =========================
// RENDER TABLE & STATS
// =========================
function renderInvoices(data = invoices) {
    if (!invoiceTable) return;

    const filterText = searchInput?.value?.trim().toLowerCase() || "";

    if (!filterText) {
        invoiceTable.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: var(--text-muted);">Please use the search bar to display invoice records.</td></tr>`;
        updateStats();
        return;
    }

    if (data.length === 0) {
        invoiceTable.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: var(--text-muted);">No invoice records found.</td></tr>`;
        updateStats();
        return;
    }

    invoiceTable.innerHTML = "";

    data.forEach((inv) => {
        const tr = document.createElement("tr");
        const statusClass = inv.status ? inv.status.toLowerCase() : 'pending';
        
        tr.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${inv.invoice_number}</td>
      <td>
        <div style="font-weight: 600;">${inv.clients?.name || "N/A"}</div>
        <div style="font-size: 11px; color: var(--text-muted);">ID: ${inv.client_id || "-"}</div>
      </td>
      <td>
        <div style="font-weight: 500;">${inv.employees?.full_name || "N/A"}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${inv.vehicles?.plate || "No Vehicle"}</div>
      </td>
      <td>
        <div>${inv.program || "Standard"}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${inv.area || "-"}</div>
      </td>
      <td>
        <div style="font-weight: 600;">${inv.due_date || "-"}</div>
        <div style="font-size: 11px; color: var(--text-muted);">Issued: ${inv.issue_date || "-"}</div>
      </td>
      <td style="font-weight: 800; color: var(--text-main);">$${Number(inv.amount || 0).toLocaleString()}</td>
      <td><span class="status-badge ${statusClass}">${inv.status || "Pending"}</span></td>
      <td style="text-align: right;">
        <button class="btn-icon edit-btn" data-id="${inv.id}" title="Edit"><i data-lucide="edit-3"></i></button>
        <button class="btn-icon delete-btn" data-id="${inv.id}" title="Delete" style="color: #ef4444;"><i data-lucide="trash-2"></i></button>
      </td>
    `;
        invoiceTable.appendChild(tr);
    });

    bindButtons();
    updateStats();
    if (window.lucide) lucide.createIcons();
}

// =========================
// UPDATE STATS CARDS
// =========================
function updateStats() {
    if (!invoices) return;

    // Total invoices
    if (totalInvoicesEl) totalInvoicesEl.textContent = invoices.length;

    // Total revenue
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    if (totalAmountEl) totalAmountEl.textContent = `$${totalRevenue.toLocaleString()}`;

    // Paid invoices
    const paidInvoices = invoices.filter(inv => inv.status === "Paid");
    const paidTotal = paidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const paidAmountEl = document.getElementById("paidAmount");
    const paidCountEl = document.getElementById("paidCount");
    if (paidAmountEl) paidAmountEl.textContent = `$${paidTotal.toLocaleString()}`;
    if (paidCountEl) paidCountEl.textContent = `${paidInvoices.length} invoices`;

    // Pending invoices
    const pendingInvoices = invoices.filter(inv => inv.status === "Pending");
    const pendingTotal = pendingInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const pendingAmountEl = document.getElementById("pendingAmount");
    const pendingCountEl = document.getElementById("pendingCount");
    if (pendingAmountEl) pendingAmountEl.textContent = `$${pendingTotal.toLocaleString()}`;
    if (pendingCountEl) pendingCountEl.textContent = `${pendingInvoices.length} invoices`;
}

// =========================
// BUTTONS & MODAL HANDLERS
// =========================
function bindButtons() {
    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.onclick = async () => {
            if (!confirm("Delete invoice?")) return;
            await window.api.billing.delete(Number(btn.dataset.id));
            await loadInvoices();
            updateStats();
        };
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.onclick = () => openEditModal(btn.dataset.id);
    });
}

form.onsubmit = async e => {
    e.preventDefault();

    // Frontend validation
    if (!invoiceNumber.value) return alert("Invoice number is required.");
    if (Number(amount.value || 0) < 0) return alert("Amount cannot be negative.");
    if (issueDate.value && dueDate.value && new Date(dueDate.value) < new Date(issueDate.value)) {
        return alert("Due date cannot be before issue date.");
    }

    const data = {
        invoice_number: invoiceNumber.value,
        client_id: clientName.value || null,
        driver_id: driverName.value || null,
        vehicle_id: vehicleName.value || null,
        issue_date: issueDate.value,
        due_date: dueDate.value,
        program: program.value,
        area: area.value,
        hours: Number(hours.value || 0),
        sro: sro.value,
        vtt: vtt.value,
        amount: Number(amount.value || 0),
        status: status.value,
        description: description.value
    };

    let result;
    if (editingId) {
        result = await window.api.billing.update(editingId, data);
    } else {
        result = await window.api.billing.create(data);
    }

    if (!result.success) {
        alert("Failed: " + result.error);
        return;
    }

    modal.style.display = "none";
    await loadInvoices();
    updateStats();
};

function openEditModal(id) {
    const invoice = invoices.find(i => i.id == id);
    if (!invoice) return;

    editingId = id;

    invoiceNumber.value = invoice.invoice_number;
    clientName.value = invoice.client_id;
    driverName.value = invoice.driver_id;
    vehicleName.value = invoice.vehicle_id;

    program.value = invoice.program;
    area.value = invoice.area;
    hours.value = invoice.hours;
    sro.value = invoice.sro;
    vtt.value = invoice.vtt;

    amount.value = invoice.amount;
    status.value = invoice.status;
    issueDate.value = invoice.issue_date;
    dueDate.value = invoice.due_date;
    description.value = invoice.description;

    modal.style.display = "flex";
}

// =========================
// INVOICE NUMBER AUTO-GEN
// =========================
async function generateInvoiceNumber() {
    const last = await window.api.billing.getLastNumber();
    const num = last ? Number(last.replace("INV-", "")) : 0;
    const next = num + 1;
    return `INV-${String(next).padStart(4, "0")}`;
}

// =========================
// SEARCH
// =========================
searchInput.oninput = () => {
    const term = searchInput.value.toLowerCase();
    const filtered = invoices.filter(i =>
        i.invoice_number?.toLowerCase().includes(term) ||
        i.clients?.name?.toLowerCase().includes(term) ||
        i.status?.toLowerCase().includes(term)
    );
    renderInvoices(filtered);
};

// =========================
// CREATE NEW INVOICE
// =========================
createBtn.onclick = async () => {
    editingId = null;
    invoiceNumber.value = await generateInvoiceNumber();
    await loadDropdownData();
    modal.style.display = "flex";

    // Default values for new invoice
    status.value = "Pending";
    amount.value = 0;
    program.value = "";
    area.value = "";
    hours.value = 0;
    sro.value = "";
    vtt.value = "";
    description.value = "";
};

// =========================
// CLOSE MODAL
// =========================
[closeModal, cancelModal].forEach(el => {
    if (!el) return;
    el.onclick = () => modal.style.display = "none";
});

// =========================
// INITIAL LOAD
// =========================
document.addEventListener("DOMContentLoaded", async () => {
    const loader = document.getElementById("loading-overlay");
    loader?.classList.add("visible");

    const startTime = Date.now();

    try {
        // Load dropdowns and invoices
        await loadDropdownData();
        await loadInvoices();
    } catch (err) {
        console.error("Error loading billing data:", err);
    } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 500 - elapsed); // ensure loader shows at least 500ms
        setTimeout(() => loader?.classList.remove("visible"), remaining);
    }
});
