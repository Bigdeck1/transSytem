"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAllIPC = setupAllIPC;
const auth_1 = require("./auth");
const employees_1 = require("./employees");
const requests_1 = require("./requests");
const vehicles_1 = require("./vehicles");
const trips_1 = require("./trips");
const payroll_1 = require("./payroll");
const notifications_1 = require("./notifications");
const tracking_1 = require("./tracking");
const epod_1 = require("./epod");
const expenses_1 = require("./expenses");
const incidents_1 = require("./incidents");
// We'll add remaining ones here as we create them
const electron_1 = require("electron");
const utils_1 = require("./utils");
function setupAllIPC() {
    (0, auth_1.setupAuthIPC)();
    (0, employees_1.setupEmployeeIPC)();
    (0, requests_1.setupRequestIPC)();
    (0, vehicles_1.setupVehicleIPC)();
    (0, trips_1.setupTripIPC)();
    (0, payroll_1.setupPayrollIPC)();
    (0, notifications_1.setupNotificationIPC)();
    (0, tracking_1.setupTrackingIPC)();
    (0, epod_1.setupEpodIPC)();
    (0, expenses_1.setupExpensesIPC)();
    (0, incidents_1.setupIncidentsIPC)();
    // Inline remaining small ones for now, or create files for them
    setupClientIPC();
    setupDashboardIPC();
    setupBillingIPC();
}
function setupClientIPC() {
    electron_1.ipcMain.handle("get-clients", async () => {
        const { data } = await utils_1.supabase.from("clients").select("*").order("id");
        return data || [];
    });
    electron_1.ipcMain.handle("add-client", async (_, clientData) => {
        // Validate required fields
        if (!clientData.name || !clientData.name.trim()) {
            return { success: false, ok: false, error: "Client name is required." };
        }
        // Validate email format if provided
        if (clientData.email && clientData.email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(clientData.email.trim())) {
                return { success: false, ok: false, error: "Invalid email format." };
            }
        }
        // Check for duplicate client (same name + same email)
        if (clientData.email && clientData.email.trim()) {
            const { data: existing } = await utils_1.supabase
                .from("clients")
                .select("id")
                .eq("email", clientData.email.trim())
                .maybeSingle();
            if (existing) {
                return { success: false, ok: false, error: `A client with email "${clientData.email}" already exists.` };
            }
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("clients").insert([clientData]).select());
    });
    electron_1.ipcMain.handle("update-client", async (_, id, updatedData) => {
        // Validate email format if provided
        if (updatedData.email && updatedData.email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updatedData.email.trim())) {
                return { success: false, ok: false, error: "Invalid email format." };
            }
            // Check for duplicate email (exclude self)
            const { data: existing } = await utils_1.supabase
                .from("clients")
                .select("id")
                .eq("email", updatedData.email.trim())
                .neq("id", id)
                .maybeSingle();
            if (existing) {
                return { success: false, ok: false, error: `Another client with email "${updatedData.email}" already exists.` };
            }
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("clients").update(updatedData).eq("id", id).select());
    });
    electron_1.ipcMain.handle("delete-client", async (_, id) => {
        // Cascade protection: check for invoices referencing this client
        const { data: activeInvoices } = await utils_1.supabase
            .from("invoices")
            .select("id, invoice_number")
            .eq("client_id", id)
            .in("status", ["Pending", "Unpaid"]);
        if (activeInvoices && activeInvoices.length > 0) {
            return {
                success: false, ok: false,
                error: `Cannot delete: client has ${activeInvoices.length} unpaid invoice(s). Resolve them first.`
            };
        }
        // Also check for active trips
        const { data: activeTrips } = await utils_1.supabase
            .from("trips")
            .select("id, trip_number")
            .eq("client_id", id)
            .in("status", ["pending", "scheduled", "in transit", "in-transit"]);
        if (activeTrips && activeTrips.length > 0) {
            return {
                success: false, ok: false,
                error: `Cannot delete: client has ${activeTrips.length} active trip(s). Complete or cancel them first.`
            };
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("clients").delete().eq("id", id));
    });
    electron_1.ipcMain.handle("get-client-history", async (_, options) => {
        let q = utils_1.supabase.from("trips").select("*").order("pickup_time", { ascending: false });
        if (options.clientId)
            q = q.eq("client_id", options.clientId);
        const { data } = await q;
        return data || [];
    });
}
function setupDashboardIPC() {
    electron_1.ipcMain.handle("get-dashboard-stats", async () => {
        try {
            const [{ count: employees }, { count: clients }, { count: vehicles }, { count: trips }] = await Promise.all([
                utils_1.supabase.from("employees").select("*", { count: "exact", head: true }),
                utils_1.supabase.from("clients").select("*", { count: "exact", head: true }),
                utils_1.supabase.from("vehicles").select("*", { count: "exact", head: true }),
                utils_1.supabase.from("trips").select("*", { count: "exact", head: true })
                    .gte("pickup_time", new Date().toISOString().split("T")[0]),
            ]);
            return {
                employeeCount: employees || 0,
                clientCount: clients || 0,
                vehicleCount: vehicles || 0,
                tripCount: trips || 0,
            };
        }
        catch (err) {
            return { employeeCount: 0, clientCount: 0, vehicleCount: 0, tripCount: 0 };
        }
    });
}
function setupBillingIPC() {
    electron_1.ipcMain.handle("billing:getAll", async () => {
        const { data } = await utils_1.supabase
            .from("invoices")
            .select(`
        *,
        clients:client_id ( name ),
        employees:driver_id ( full_name ),
        vehicles:vehicle_id ( plate )
      `)
            .order("id", { ascending: false });
        return data || [];
    });
    electron_1.ipcMain.handle("billing:create", async (_, invoiceData) => {
        // Validate required fields
        if (!invoiceData.invoice_number) {
            return { success: false, ok: false, error: "Invoice number is required." };
        }
        // Validate amount
        if (invoiceData.amount !== undefined && Number(invoiceData.amount) < 0) {
            return { success: false, ok: false, error: "Invoice amount cannot be negative." };
        }
        // Validate date logic
        if (invoiceData.issue_date && invoiceData.due_date) {
            if (new Date(invoiceData.due_date) < new Date(invoiceData.issue_date)) {
                return { success: false, ok: false, error: "Due date cannot be before issue date." };
            }
        }
        // Check for duplicate invoice number
        const { data: existing } = await utils_1.supabase
            .from("invoices")
            .select("id")
            .eq("invoice_number", invoiceData.invoice_number)
            .maybeSingle();
        if (existing) {
            return { success: false, ok: false, error: `Invoice number "${invoiceData.invoice_number}" already exists.` };
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("invoices").insert([invoiceData]).select().single());
    });
    electron_1.ipcMain.handle("billing:delete", async (_, id) => {
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("invoices").delete().eq("id", id));
    });
    electron_1.ipcMain.handle("billing:update", async (_, id, data) => {
        // Validate amount on update
        if (data.amount !== undefined && Number(data.amount) < 0) {
            return { success: false, ok: false, error: "Invoice amount cannot be negative." };
        }
        // Validate date logic on update
        if (data.issue_date && data.due_date) {
            if (new Date(data.due_date) < new Date(data.issue_date)) {
                return { success: false, ok: false, error: "Due date cannot be before issue date." };
            }
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("invoices").update(data).eq("id", id).select());
    });
    electron_1.ipcMain.handle("billing:getLastNumber", async () => {
        const { data } = await utils_1.supabase
            .from("invoices")
            .select("invoice_number")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();
        return data?.invoice_number || null;
    });
    electron_1.ipcMain.handle("billing:getStats", async () => {
        const { data: invoices } = await utils_1.supabase.from("invoices").select("amount, status");
        const total = invoices?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0;
        const pending = invoices?.filter(i => i.status === "Pending" || i.status === "Unpaid").length || 0;
        return { totalRevenue: total, pendingInvoices: pending };
    });
}
//# sourceMappingURL=index.js.map