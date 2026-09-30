"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupVehicleIPC = setupVehicleIPC;
const electron_1 = require("electron");
const utils_1 = require("./utils");
function setupVehicleIPC() {
    electron_1.ipcMain.handle("get-vehicles", async () => {
        const { data } = await utils_1.supabase.from("vehicles").select("*").order("id");
        return data || [];
    });
    electron_1.ipcMain.handle("add-vehicle", async (_, vehicleData) => {
        // Validate required fields
        if (!vehicleData.plate || !vehicleData.vehicle_type) {
            return { success: false, ok: false, error: "License plate and vehicle type are required." };
        }
        // Check for duplicate plate number
        const { data: existing } = await utils_1.supabase
            .from("vehicles")
            .select("id")
            .eq("plate", vehicleData.plate.trim())
            .maybeSingle();
        if (existing) {
            return { success: false, ok: false, error: `A vehicle with plate "${vehicleData.plate}" already exists.`, message: `A vehicle with plate "${vehicleData.plate}" already exists.` };
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("vehicles").insert([vehicleData]).select());
    });
    electron_1.ipcMain.handle("update-vehicle", async (_, id, updatedData) => {
        // Check for duplicate plate on update (exclude self)
        if (updatedData.plate) {
            const { data: existing } = await utils_1.supabase
                .from("vehicles")
                .select("id")
                .eq("plate", updatedData.plate.trim())
                .neq("id", id)
                .maybeSingle();
            if (existing) {
                return { success: false, ok: false, error: `Another vehicle with plate "${updatedData.plate}" already exists.`, message: `Another vehicle with plate "${updatedData.plate}" already exists.` };
            }
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("vehicles").update(updatedData).eq("id", id).select());
    });
    electron_1.ipcMain.handle("delete-vehicle", async (_, id) => {
        // Cascade protection: check for active trips referencing this vehicle
        const { data: activeTrips } = await utils_1.supabase
            .from("trips")
            .select("id, trip_number")
            .eq("vehicle_id", id)
            .in("status", ["pending", "scheduled", "in transit", "in-transit"]);
        if (activeTrips && activeTrips.length > 0) {
            return {
                success: false, ok: false,
                error: `Cannot delete: vehicle has ${activeTrips.length} active trip(s) (${activeTrips.map(t => t.trip_number).join(", ")}). Complete or cancel them first.`
            };
        }
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("vehicles").delete().eq("id", id));
    });
    electron_1.ipcMain.handle("set-vehicle-status", async (_, vehicle_id, status) => {
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("vehicles").update({ status }).eq("id", vehicle_id).select());
    });
    // Submit Vehicle Assessment (Pre-Trip / Post-Trip / Periodic Audit)
    electron_1.ipcMain.handle("vehicles:submitAssessment", async (_, payload) => {
        const res = await (0, utils_1.handleSupabase)(utils_1.supabase.from("vehicle_assessments").insert([{
                vehicle_id: Number(payload.vehicle_id),
                inspector_id: payload.inspector_id,
                trip_id: payload.trip_id ? Number(payload.trip_id) : null,
                assessment_type: payload.assessment_type || "pre_trip",
                odometer_reading: Number(payload.odometer_reading) || 0,
                fuel_level_percentage: payload.fuel_level_percentage ?? 100,
                checklist: payload.checklist || {},
                has_critical_failure: Boolean(payload.has_critical_failure),
                status: payload.status || "passed",
                damage_notes: payload.damage_notes || "",
                photo_urls: payload.photo_urls || [],
                inspector_signature: payload.inspector_signature || null,
            }]).select().single());
        // If inspection failed, ensure vehicle is locked in maintenance status
        if (res.success && (payload.has_critical_failure || payload.status === "failed")) {
            await utils_1.supabase.from("vehicles").update({ status: "maintenance" }).eq("id", payload.vehicle_id);
        }
        return res;
    });
    // Get Assessments for a vehicle or all assessments
    electron_1.ipcMain.handle("vehicles:getAssessments", async (_, vehicleId) => {
        let query = utils_1.supabase
            .from("vehicle_assessments")
            .select(`
        *,
        vehicles:vehicle_id ( plate, brand, model, vehicle_type, status ),
        inspectors:inspector_id ( full_name, employee_id, position )
      `)
            .order("created_at", { ascending: false });
        if (vehicleId) {
            query = query.eq("vehicle_id", vehicleId);
        }
        const { data, error } = await query;
        if (error)
            return { success: false, ok: false, error: error.message };
        return { success: true, ok: true, data: data || [] };
    });
    // Clear Maintenance status back to available (Admin Sign-off)
    electron_1.ipcMain.handle("vehicles:clearMaintenance", async (_, vehicleId, notes) => {
        return (0, utils_1.handleSupabase)(utils_1.supabase.from("vehicles").update({ status: "available" }).eq("id", vehicleId).select());
    });
    // Get Preventive Maintenance Schedules
    electron_1.ipcMain.handle("vehicles:getMaintenanceSchedules", async (_, vehicleId) => {
        let query = utils_1.supabase
            .from("maintenance_schedules")
            .select(`
        *,
        vehicles:vehicle_id ( plate, brand, model, vehicle_type, status )
      `)
            .order("next_due_odo", { ascending: true });
        if (vehicleId) {
            query = query.eq("vehicle_id", vehicleId);
        }
        const { data, error } = await query;
        if (error)
            return { success: false, ok: false, error: error.message };
        return { success: true, ok: true, data: data || [] };
    });
    // Log Maintenance Service Done (Updates next due odometer)
    electron_1.ipcMain.handle("vehicles:logMaintenanceService", async (_, payload) => {
        const interval = Number(payload.interval_km) || 5000;
        const currentOdo = Number(payload.current_odometer) || 0;
        const nextDue = currentOdo + interval;
        if (payload.schedule_id) {
            return (0, utils_1.handleSupabase)(utils_1.supabase.from("maintenance_schedules").update({
                last_service_odo: currentOdo,
                next_due_odo: nextDue,
                last_service_date: new Date().toISOString().split("T")[0],
                status: "healthy",
                notes: payload.notes || "Service completed",
            }).eq("id", payload.schedule_id).select());
        }
        else {
            return (0, utils_1.handleSupabase)(utils_1.supabase.from("maintenance_schedules").insert([{
                    vehicle_id: Number(payload.vehicle_id),
                    service_type: payload.service_type || "engine_oil",
                    interval_km: interval,
                    last_service_odo: currentOdo,
                    next_due_odo: nextDue,
                    last_service_date: new Date().toISOString().split("T")[0],
                    status: "healthy",
                    notes: payload.notes || "Initial service log",
                }]).select());
        }
    });
    // Calculate Fuel Economy (km/L) from trip_expenses
    electron_1.ipcMain.handle("vehicles:getFuelEconomy", async (_, vehicleId) => {
        let query = utils_1.supabase
            .from("trip_expenses")
            .select("vehicle_id, amount, liters, odometer, created_at")
            .eq("expense_type", "fuel")
            .not("liters", "is", null)
            .order("created_at", { ascending: true });
        if (vehicleId)
            query = query.eq("vehicle_id", vehicleId);
        const { data, error } = await query;
        if (error)
            return { success: false, ok: false, error: error.message };
        // Group expenses by vehicle and compute total liters & distance delta
        const vehicleStats = {};
        (data || []).forEach((row) => {
            const vId = String(row.vehicle_id);
            if (!vehicleStats[vId]) {
                vehicleStats[vId] = { totalLiters: 0, minOdo: row.odometer || 0, maxOdo: row.odometer || 0, count: 0 };
            }
            vehicleStats[vId].totalLiters += Number(row.liters) || 0;
            if (row.odometer) {
                if (row.odometer < vehicleStats[vId].minOdo || vehicleStats[vId].minOdo === 0)
                    vehicleStats[vId].minOdo = row.odometer;
                if (row.odometer > vehicleStats[vId].maxOdo)
                    vehicleStats[vId].maxOdo = row.odometer;
            }
            vehicleStats[vId].count++;
        });
        const result = Object.entries(vehicleStats).map(([vId, s]) => {
            const distanceTraveled = Math.max(0, s.maxOdo - s.minOdo);
            const kmPerLiter = s.totalLiters > 0 && distanceTraveled > 0 ? Number((distanceTraveled / s.totalLiters).toFixed(2)) : 0;
            return {
                vehicle_id: vId,
                total_fuel_liters: Number(s.totalLiters.toFixed(1)),
                distance_traveled_km: distanceTraveled,
                km_per_liter: kmPerLiter,
                efficiency_status: kmPerLiter >= 10 ? "excellent" : kmPerLiter >= 7 ? "normal" : kmPerLiter > 0 ? "low" : "insufficient_data",
            };
        });
        return { success: true, ok: true, data: result };
    });
}
//# sourceMappingURL=vehicles.js.map