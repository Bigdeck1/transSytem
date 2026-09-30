"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupExpensesIPC = setupExpensesIPC;
const electron_1 = require("electron");
const utils_1 = require("./utils");
function setupExpensesIPC() {
    // Log an expense
    electron_1.ipcMain.handle("expenses:log", async (_, payload) => {
        try {
            const { data, error } = await utils_1.supabase
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
            if (error)
                throw error;
            return { success: true, data };
        }
        catch (err) {
            console.error("[Expenses] Log failed:", err.message);
            return { success: false, error: err.message };
        }
    });
    // Get expenses for a trip
    electron_1.ipcMain.handle("expenses:getByTrip", async (_, tripId) => {
        try {
            const { data, error } = await utils_1.supabase
                .from("trip_expenses")
                .select("*")
                .eq("trip_id", tripId)
                .order("created_at", { ascending: false });
            if (error)
                throw error;
            return { success: true, data };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    // Get expenses and fuel efficiency metrics for a vehicle
    electron_1.ipcMain.handle("expenses:getByVehicle", async (_, vehicleId) => {
        try {
            const { data, error } = await utils_1.supabase
                .from("trip_expenses")
                .select("*")
                .eq("vehicle_id", vehicleId)
                .order("created_at", { ascending: false });
            if (error)
                throw error;
            return { success: true, data };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    // Get fleet-wide expense summary & analytics
    electron_1.ipcMain.handle("expenses:getFleetSummary", async () => {
        try {
            const { data, error } = await utils_1.supabase
                .from("trip_expenses")
                .select("*")
                .order("created_at", { ascending: false });
            if (error)
                throw error;
            const expenses = data || [];
            const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
            const fuelExpenses = expenses.filter((e) => e.expense_type === 'fuel');
            const totalFuelAmount = fuelExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
            const totalLiters = fuelExpenses.reduce((sum, e) => sum + Number(e.liters || 0), 0);
            const tollAmount = expenses.filter((e) => e.expense_type === 'toll').reduce((sum, e) => sum + Number(e.amount || 0), 0);
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
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
}
//# sourceMappingURL=expenses.js.map