import { setupAuthIPC } from "./auth";
import { setupEmployeeIPC } from "./employees";
import { setupRequestIPC } from "./requests";
import { setupVehicleIPC } from "./vehicles";
import { setupTripIPC } from "./trips";
import { setupPayrollIPC } from "./payroll";
import { setupNotificationIPC } from "./notifications";
import { setupTrackingIPC } from "./tracking";
import { setupEpodIPC } from "./epod";
import { setupExpensesIPC } from "./expenses";
import { setupIncidentsIPC } from "./incidents";
import { setupRentalIPC } from "./rentals";
import { setupGovernanceIPC } from "./governance";

// We'll add remaining ones here as we create them
import { ipcMain } from "electron";
import { supabase, handleSupabase } from "./utils";

export function setupAllIPC() {
  setupAuthIPC();
  setupEmployeeIPC();
  setupRequestIPC();
  setupVehicleIPC();
  setupTripIPC();
  setupPayrollIPC();
  setupNotificationIPC();
  setupTrackingIPC();
  setupEpodIPC();
  setupExpensesIPC();
  setupIncidentsIPC();
  setupRentalIPC();
  setupGovernanceIPC();
  
  // Inline remaining small ones for now, or create files for them
  setupClientIPC();
  setupDashboardIPC();
  setupBillingIPC();
}

function setupClientIPC() {
  ipcMain.handle("get-clients", async () => {
    const { data } = await supabase.from("clients").select("*").order("id");
    return data || [];
  });

  ipcMain.handle("add-client", async (_, clientData) => {
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
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("email", clientData.email.trim())
        .maybeSingle();

      if (existing) {
        return { success: false, ok: false, error: `A client with email "${clientData.email}" already exists.` };
      }
    }

    return handleSupabase(supabase.from("clients").insert([clientData]).select());
  });

  ipcMain.handle("update-client", async (_, id: string, updatedData: any) => {
    // Validate email format if provided
    if (updatedData.email && updatedData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updatedData.email.trim())) {
        return { success: false, ok: false, error: "Invalid email format." };
      }

      // Check for duplicate email (exclude self)
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("email", updatedData.email.trim())
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return { success: false, ok: false, error: `Another client with email "${updatedData.email}" already exists.` };
      }
    }

    return handleSupabase(supabase.from("clients").update(updatedData).eq("id", id).select());
  });

  ipcMain.handle("delete-client", async (_, id: string) => {
    // Cascade protection: check for invoices referencing this client
    const { data: activeInvoices } = await supabase
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
    const { data: activeTrips } = await supabase
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

    return handleSupabase(supabase.from("clients").delete().eq("id", id));
  });

  ipcMain.handle("get-client-history", async (_, options: { clientId?: string; email?: string; phone?: string }) => {
    let q = supabase.from("trips").select("*").order("pickup_time", { ascending: false });
    if (options.clientId) q = q.eq("client_id", options.clientId);
    const { data } = await q;
    return data || [];
  });
}

function setupDashboardIPC() {
  ipcMain.handle("get-dashboard-stats", async () => {
    try {
      const [{ count: employees }, { count: clients }, { count: vehicles }, { count: trips }, { count: activeRentals }, { count: availableVehicles }] =
        await Promise.all([
          supabase.from("employees").select("*", { count: "exact", head: true }),
          supabase.from("clients").select("*", { count: "exact", head: true }),
          supabase.from("vehicles").select("*", { count: "exact", head: true }),
          supabase.from("trips").select("*", { count: "exact", head: true }),
          supabase.from("rental_agreements").select("*", { count: "exact", head: true }).eq("rental_status", "Active"),
          supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
        ]);

      return {
        employeeCount: employees || 0,
        clientCount: clients || 0,
        vehicleCount: vehicles || 0,
        tripCount: trips || 0,
        activeRentalCount: activeRentals || 0,
        availableVehicleCount: availableVehicles || 0,
      };
    } catch (err: unknown) {
      return { employeeCount: 0, clientCount: 0, vehicleCount: 0, tripCount: 0, activeRentalCount: 0, availableVehicleCount: 0 };
    }
  });
}

function setupBillingIPC() {
  ipcMain.handle("billing:getAll", async () => {
    const { data } = await supabase
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

  ipcMain.handle("billing:create", async (_, invoiceData) => {
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
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("invoice_number", invoiceData.invoice_number)
      .maybeSingle();

    if (existing) {
      return { success: false, ok: false, error: `Invoice number "${invoiceData.invoice_number}" already exists.` };
    }

    return handleSupabase(supabase.from("invoices").insert([invoiceData]).select().single());
  });

  ipcMain.handle("billing:delete", async (_, id: number) => {
    return handleSupabase(supabase.from("invoices").delete().eq("id", id));
  });

  ipcMain.handle("billing:update", async (_, id: number, data: any) => {
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

    return handleSupabase(supabase.from("invoices").update(data).eq("id", id).select());
  });

  ipcMain.handle("billing:getLastNumber", async () => {
    const { data } = await supabase
      .from("invoices")
      .select("invoice_number")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.invoice_number || null;
  });

  ipcMain.handle("billing:getStats", async () => {
    const { data: invoices } = await supabase.from("invoices").select("amount, status");
    const total = invoices?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0;
    const pending = invoices?.filter(i => i.status === "Pending" || i.status === "Unpaid").length || 0;
    return { totalRevenue: total, pendingInvoices: pending };
  });
}
