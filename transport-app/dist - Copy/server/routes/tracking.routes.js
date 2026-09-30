"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const packageEstimator_1 = require("../../ipc/packageEstimator");
const tracking_1 = require("../../ipc/tracking");
exports.trackingRouter = (0, express_1.Router)();
const db = supabase_1.supabaseAdmin || supabase_1.supabase;
// 1. Dual-Leg Route & ETA Estimation (HQ -> Origin -> Destination)
exports.trackingRouter.post("/estimate-route", async (req, res) => {
    try {
        const { hq, pickup, delivery } = req.body;
        const hqCoord = hq || {
            lat: 14.546827,
            lng: 121.229383,
            address: "Malalim St, Sitio Malalim, Morong, 1960 Rizal",
        };
        if (!pickup?.lat || !pickup?.lng || !delivery?.lat || !delivery?.lng) {
            return res.status(400).json({ success: false, ok: false, error: "Pickup and delivery coordinates are required." });
        }
        const leg1 = await (0, tracking_1.fetchOSRMRoute)(hqCoord.lat, hqCoord.lng, pickup.lat, pickup.lng);
        const leg2 = await (0, tracking_1.fetchOSRMRoute)(pickup.lat, pickup.lng, delivery.lat, delivery.lng);
        const totalDistanceKm = Number((leg1.distanceKm + leg2.distanceKm).toFixed(2));
        const totalDurationMins = leg1.durationMins + leg2.durationMins;
        return res.json({
            success: true,
            ok: true,
            data: {
                dispatchLeg: {
                    title: "Leg 1: Dispatch (HQ to Origin)",
                    from: hqCoord.address || "Company Depot",
                    to: pickup.address || "Pickup Point",
                    distanceKm: leg1.distanceKm,
                    durationMins: leg1.durationMins,
                    geometry: leg1.geometry,
                },
                transitLeg: {
                    title: "Leg 2: In-Transit (Origin to Destination)",
                    from: pickup.address || "Pickup Point",
                    to: delivery.address || "Delivery Destination",
                    distanceKm: leg2.distanceKm,
                    durationMins: leg2.durationMins,
                    geometry: leg2.geometry,
                },
                totalDistanceKm,
                totalDurationMins,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, ok: false, error: err.message || "Route calculation error" });
    }
});
// 2. Package Estimate
exports.trackingRouter.post("/estimate-package", async (req, res) => {
    try {
        const estimate = (0, packageEstimator_1.calculatePackageEstimate)(req.body);
        return res.json({ success: true, ok: true, data: estimate });
    }
    catch (err) {
        return res.status(500).json({ success: false, ok: false, error: err.message });
    }
});
// 3. Update driver location (from mobile or test ping)
exports.trackingRouter.post("/driver-location", async (req, res) => {
    const { driver_id, vehicle_id, trip_id, latitude, longitude, speed, heading } = req.body;
    if (!driver_id || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, ok: false, error: "driver_id, latitude, and longitude are required." });
    }
    const result = await (0, supabase_1.handleSupabase)(db.from("driver_locations").upsert({
        driver_id,
        vehicle_id: vehicle_id || null,
        trip_id: trip_id || null,
        latitude,
        longitude,
        speed: speed || 0,
        heading: heading || 0,
        updated_at: new Date().toISOString(),
    }).select());
    return res.json(result);
});
// 4. Get active fleet locations
exports.trackingRouter.get("/fleet-locations", async (_req, res) => {
    const { data, error } = await db.from("driver_locations").select(`
    *,
    employees:driver_id ( full_name, employee_id, phone ),
    vehicles:vehicle_id ( plate, brand, model, vehicle_type ),
    trips:trip_id ( trip_number, status, pickup_location, delivery_location )
  `);
    if (error)
        return res.status(500).json({ success: false, ok: false, error: error.message });
    return res.json({ success: true, ok: true, data: data || [] });
});
//# sourceMappingURL=tracking.routes.js.map