"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const supabase_1 = require("../config/supabase");
const router = (0, express_1.Router)();
const db = supabase_1.supabaseAdmin || supabase_1.supabase;
// GET /api/public-tracking/:query — Robust JSON API
router.get("/api/public-tracking/:query", async (req, res) => {
    const { query } = req.params;
    const cleanQuery = decodeURIComponent(String(query || "")).trim();
    if (!cleanQuery) {
        return res.status(400).json({ ok: false, error: "Tracking code or trip number is required." });
    }
    try {
        // 1. Fetch trip by tracking_code, trip_number, or numeric id
        let trip = null;
        // Try tracking_code first
        const { data: byTrackCode } = await db
            .from("trips")
            .select("*")
            .ilike("tracking_code", cleanQuery)
            .maybeSingle();
        trip = byTrackCode;
        // Try trip_number if not found
        if (!trip) {
            const { data: byTripNum } = await db
                .from("trips")
                .select("*")
                .ilike("trip_number", cleanQuery)
                .maybeSingle();
            trip = byTripNum;
        }
        // Try numeric ID if still not found and query is numeric
        if (!trip && !isNaN(Number(cleanQuery))) {
            const { data: byId } = await db
                .from("trips")
                .select("*")
                .eq("id", Number(cleanQuery))
                .maybeSingle();
            trip = byId;
        }
        if (!trip) {
            return res.status(404).json({ ok: false, error: "Shipment not found. Please verify your tracking code or order number." });
        }
        // 2. Resolve Driver details
        let driver = null;
        let liveLocation = null;
        if (trip.driver_id) {
            const { data: emp } = await db
                .from("employees")
                .select("id, full_name, phone, position")
                .eq("id", trip.driver_id)
                .maybeSingle();
            driver = emp;
            // 3. Resolve live GPS location from driver_locations table
            const { data: loc } = await db
                .from("driver_locations")
                .select("latitude, longitude, speed, heading, accuracy, updated_at")
                .eq("driver_id", trip.driver_id)
                .maybeSingle();
            liveLocation = loc;
        }
        // 4. Resolve Vehicle details
        let vehicle = null;
        if (trip.vehicle_id) {
            const { data: veh } = await db
                .from("vehicles")
                .select("id, vehicle_number, plate, brand, model, vehicle_type")
                .eq("id", trip.vehicle_id)
                .maybeSingle();
            vehicle = veh;
        }
        // 5. Resolve Client details
        let client = null;
        if (trip.client_id) {
            const { data: cli } = await db
                .from("clients")
                .select("id, name, phone, email, company_name")
                .eq("id", trip.client_id)
                .maybeSingle();
            client = cli;
        }
        // Attach resolved relations
        trip.driver = driver;
        trip.vehicle = vehicle;
        trip.client = client;
        return res.json({
            ok: true,
            trip,
            liveLocation,
            serverTime: new Date().toISOString(),
        });
    }
    catch (err) {
        console.error("[PUBLIC_TRACKING] Query error:", err);
        return res.status(500).json({ ok: false, error: err.message || "Failed to retrieve tracking information." });
    }
});
// GET /track, /track/:trackingCode, /tracking, /tracking.html — Standalone Tracking Web App
router.get(["/track", "/track/:trackingCode", "/tracking", "/tracking.html"], (_req, res) => {
    const filePath = path_1.default.join(__dirname, "../../renderer/html/tracking.html");
    res.sendFile(filePath);
});
exports.default = router;
//# sourceMappingURL=public_tracking.routes.js.map