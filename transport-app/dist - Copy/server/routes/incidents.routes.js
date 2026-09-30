"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const router = (0, express_1.Router)();
const db = supabase_1.supabaseAdmin || supabase_1.supabase;
// POST /api/incidents/report
router.post("/report", async (req, res) => {
    const { tripId, driverId, vehicleId, severity, incidentType, description, latitude, longitude, photos, policeReportNo } = req.body;
    if (!driverId || !description || !incidentType) {
        return res.status(400).json({ ok: false, error: "Missing required incident fields" });
    }
    try {
        const { data: incident, error: incError } = await db
            .from("incident_reports")
            .insert([{
                trip_id: tripId ? Number(tripId) : null,
                driver_id: driverId,
                vehicle_id: vehicleId ? Number(vehicleId) : null,
                severity: severity || 'moderate',
                incident_type: incidentType,
                description,
                latitude: latitude || null,
                longitude: longitude || null,
                photos: photos || [],
                police_report_no: policeReportNo || null,
                status: 'reported',
            }])
            .select("*")
            .single();
        if (incError)
            throw incError;
        // Send admin alarm notification
        const isSos = severity === 'sos' || incidentType === 'sos_panic';
        await db.from("notifications").insert([{
                employee_id: driverId,
                title: isSos ? "🚨 SOS EMERGENCY ALERT" : `⚠️ Incident: ${incidentType.toUpperCase()}`,
                message: `${description}\nCoords: ${latitude || 'N/A'}, ${longitude || 'N/A'}`,
                type: "alert",
                urgency: isSos ? "alarm" : (severity === 'critical' ? 'urgent' : 'normal'),
                target_role: "admin",
                metadata: {
                    incident_id: incident.id,
                    trip_id: tripId,
                    latitude,
                    longitude,
                },
            }]);
        res.json({ ok: true, success: true, data: incident });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});
// GET /api/incidents/all
router.get("/all", async (req, res) => {
    try {
        const { data, error } = await db
            .from("incident_reports")
            .select(`
        *,
        employees:driver_id (full_name, employee_id, phone),
        vehicles:vehicle_id (vehicle_number, plate, brand, model)
      `)
            .order("created_at", { ascending: false });
        if (error)
            throw error;
        res.json({ ok: true, success: true, data });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=incidents.routes.js.map