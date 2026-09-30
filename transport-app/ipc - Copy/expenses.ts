import { ipcMain } from "electron";
import { supabase } from "./utils";

export interface ExpensePayload {
  tripId?: number | string | null;
  driverId?: string | null;
  vehicleId?: number | string | null;
  expenseType: 'fuel' | 'toll' | 'parking' | 'maintenance' | 'other';
  amount: number;
  liters?: number | null;
  odometer?: number | null;
  receiptPhotoUrl?: string | null;
  notes?: string | null;
}

export function setupExpensesIPC() {
  // Log an expense
  ipcMain.handle("expenses:log", async (_, payload: ExpensePayload) => {
    try {
      const { data, error } = await supabase
        .from("trip_expenses")
        .insert([{
          trip_id: payload.tripId ? Number(payload.tripId) : null,
          driver_id: payload.driverId || null,
          vehicle_id: payload.vehicleId ? Number(payload.vehicleId) : null,
          expense_type: payload.expenseType,
          amount: payload.amount,
          liters: payload.liters || null,
          odometer: payload.odometer || null,
          receipt_photo_url: payload.receiptPhotoUrl || null,
          notes: payload.notes || null,
        }])
        .select("*")
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("[Expenses] Log failed:", err.message);
      return { success: false, error: err.message };
    }
  });

  // Get expenses for a trip
  ipcMain.handle("expenses:getByTrip", async (_, tripId: number | string) => {
    try {
      const { data, error } = await supabase
        .from("trip_expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Get expenses and fuel efficiency metrics for a vehicle
  ipcMain.handle("expenses:getByVehicle", async (_, vehicleId: number | string) => {
    try {
      const { data, error } = await supabase
        .from("trip_expenses")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Get fleet-wide expense summary & analytics
  ipcMain.handle("expenses:getFleetSummary", async () => {
    try {
      const { data, error } = await supabase
        .from("trip_expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const expenses: any[] = data || [];
      const totalAmount = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      const fuelExpenses = expenses.filter((e: any) => e.expense_type === 'fuel');
      const totalFuelAmount = fuelExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      const totalLiters = fuelExpenses.reduce((sum: number, e: any) => sum + Number(e.liters || 0), 0);
      const tollAmount = expenses.filter((e: any) => e.expense_type === 'toll').reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      const otherAmount = totalAmount - totalFuelAmount - tollAmount;

      return {
        success: true,
        summary: {
          totalAmount,
          totalFuelAmount,
          totalLiters,
          tollAmount,
          otherAmount,
          avgPricePerLiter: totalLiters > 0 ? Number((totalFuelAmount / totalLiters).toFixed(2)) : 0,
          count: expenses.length,
        },
        records: expenses,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
