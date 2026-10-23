import { Router, Request, Response } from "express";
import { supabaseAdmin, supabase, handleSupabase } from "../config/supabase";
import { calculatePackageEstimate } from "../../ipc/packageEstimator";
import { fetchOSRMRoute } from "../../ipc/tracking";

export const trackingRouter = Router();
const db = supabaseAdmin || supabase;

// 1. Dual-Leg Route & ETA Estimation (HQ -> Origin -> Destination)
trackingRouter.post("/estimate-route", async (req: Request, res: Response) => {
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

    const leg1 = await fetchOSRMRoute(hqCoord.lat, hqCoord.lng, pickup.lat, pickup.lng);
    const leg2 = await fetchOSRMRoute(pickup.lat, pickup.lng, delivery.lat, delivery.lng);

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
  } catch (err: any) {
    return res.status(500).json({ success: false, ok: false, error: err.message || "Route calculation error" });
  }
});

// 2. Package Estimate
trackingRouter.post("/estimate-package", async (req: Request, res: Response) => {
  try {
    const estimate = calculatePackageEstimate(req.body);
    return res.json({ success: true, ok: true, data: estimate });
  } catch (err: any) {
    return res.status(500).json({ success: false, ok: false, error: err.message });
  }
});

// 3. Update driver location (from mobile or test ping)
trackingRouter.post("/driver-location", async (req: Request, res: Response) => {
  const { driver_id, vehicle_id, trip_id, latitude, longitude, speed, heading } = req.body;
  if (!driver_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, ok: false, error: "driver_id, latitude, and longitude are required." });
  }

  const result = await handleSupabase(
    db.from("driver_locations").upsert({
      driver_id,
      vehicle_id: vehicle_id || null,
      trip_id: trip_id || null,
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      updated_at: new Date().toISOString(),
    }).select()
  );

  return res.json(result);
});

// 4. Get active fleet locations
trackingRouter.get("/fleet-locations", async (_req: Request, res: Response) => {
  const { data, error } = await db.from("driver_locations").select(`
    *,
    employees:driver_id ( full_name, employee_id, phone ),
    vehicles:vehicle_id ( plate, brand, model, vehicle_type ),
    trips:trip_id ( trip_number, status, pickup_location, delivery_location )
  `);

  if (error) return res.status(500).json({ success: false, ok: false, error: error.message });
  return res.json({ success: true, ok: true, data: data || [] });
});

// 5. Ingest ESP32 IoT Microcontroller Telemetry
trackingRouter.post("/iot/telemetry", async (req: Request, res: Response) => {
  try {
    const {
      device_id,
      vehicle_plate,
      latitude,
      longitude,
      speed,
      satellites,
      cargo_temp,
      cargo_humidity,
      cargo_door_closed,
      battery_voltage,
    } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, ok: false, error: "device_id is required" });
    }

    let vehicle_id = null;
    if (vehicle_plate) {
      const { data: v } = await db.from("vehicles").select("id").eq("plate", vehicle_plate).maybeSingle();
      if (v) vehicle_id = v.id;
    }

    // If valid GPS coordinates are broadcasted, update live fleet radar table
    if (latitude !== undefined && longitude !== undefined && vehicle_id) {
      await db.from("driver_locations").upsert({
        vehicle_id,
        latitude,
        longitude,
        speed: speed || 0,
        updated_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      ok: true,
      message: "ESP32 IoT telemetry ingested successfully",
      device_id,
      vehicle_plate: vehicle_plate || null,
      telemetry: {
        satellites: satellites || 0,
        cargo_temp: cargo_temp ?? null,
        cargo_humidity: cargo_humidity ?? null,
        cargo_door_closed: cargo_door_closed ?? true,
        battery_voltage: battery_voltage ?? null,
      },
      received_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, ok: false, error: err.message });
  }
});
