"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIncidentsIPC = setupIncidentsIPC;
const electron_1 = require("electron");
const utils_1 = require("./utils");
function setupIncidentsIPC() {
    // Report an incident or trigger SOS
    electron_1.ipcMain.handle("incidents:report", async (_, payload) => {
        try {
            // 1. Insert incident record
            const { data: incident, error: incError } = await utils_1.supabase
                .from("incident_reports")
                .insert([{
                    trip_id: payload.tripId ? Number(payload.tripId) : null,
                    driver_id: payload.driverId,
                    vehicle_id: payload.vehicleId ? Number(payload.vehicleId) : null,
                    severity: payload.severity || 'moderate',
                    incident_type: payload.incidentType,
                    description: payload.description,
                    latitude: payload.latitude || null,
                    longitude: payload.longitude || null,
                    photos: payload.photos || [],
                    police_report_no: payload.policeReportNo || null,
                    status: 'reported',
                }])
                .select("*")
                .single();
            if (incError)
                throw incError;
            // 2. Automatically broadcast an urgent alarm notification to all admins
            const isSos = payload.severity === 'sos' || payload.incidentType === 'sos_panic';
            await utils_1.supabase.from("notifications").insert([{
                    employee_id: payload.driverId,
                    title: isSos ? "🚨 SOS EMERGENCY ALERT" : `⚠️ Road Incident Reported (${payload.severity.toUpperCase()})`,
                    message: `${payload.description}\nLocation: ${payload.latitude || 'N/A'}, ${payload.longitude || 'N/A'}`,
                    type: "alert",
                    urgency: isSos ? "alarm" : (payload.severity === 'critical' ? 'urgent' : 'normal'),
                    target_role: "admin",
                    metadata: {
                        incident_id: incident.id,
                        trip_id: payload.tripId,
                        latitude: payload.latitude,
                        longitude: payload.longitude,
                        severity: payload.severity,
                    },
                }]);
            return { success: true, data: incident };
        }
        catch (err) {
            console.error("[Incidents] Report failed:", err.message);
            return { success: false, error: err.message };
        }
    });
    // Get all incident reports
    electron_1.ipcMain.handle("incidents:getAll", async () => {
        try {
            const { data, error } = await utils_1.supabase
                .from("incident_reports")
                .select(`
          *,
          employees:driver_id (full_name, employee_id, phone),
          vehicles:vehicle_id (vehicle_number, plate, brand, model)
        `)
                .order("created_at", { ascending: false });
            if (error)
                throw error;
            return { success: true, data };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    // Update status (e.g. mark resolved)
    electron_1.ipcMain.handle("incidents:updateStatus", async (_, { incidentId, status }) => {
        try {
            const { data, error } = await utils_1.supabase
                .from("incident_reports")
                .update({
                status,
                resolved_at: status === 'resolved' ? new Date().toISOString() : null,
            })
                .eq("id", incidentId)
                .select("*")
                .single();
            if (error)
                throw error;
            return { success: true, data };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
}
//# sourceMappingURL=incidents.js.map