import { Router, Request, Response } from "express";
import { supabaseAdmin, supabase, handleSupabase } from "../config/supabase";

const db = supabaseAdmin || supabase;

export const vehiclesRouter = Router();

// GET all vehicles
vehiclesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await db.from("vehicles").select("*").order("id");
    if (error) {
      console.error("[VEHICLES] Error fetching vehicles:", error.message);
      return res.json([]);
    }
    return res.json(data || []);
  } catch (err) {
    console.error("[VEHICLES] Unexpected error fetching vehicles:", err);
    return res.json([]);
  }
});

// ADD vehicle
vehiclesRouter.post("/", async (req: Request, res: Response) => {
  const vehicleData = req.body;

  if (!vehicleData.plate || !vehicleData.vehicle_type) {
    return res.status(400).json({ success: false, ok: false, error: "License plate and vehicle type are required." });
  }

  const { data: existing } = await supabase
    .from("vehicles")
    .select("id")
    .eq("plate", vehicleData.plate.trim())
    .maybeSingle();

  if (existing) {
    return res.status(400).json({
      success: false,
      ok: false,
      error: `A vehicle with plate "${vehicleData.plate}" already exists.`,
      message: `A vehicle with plate "${vehicleData.plate}" already exists.`
    });
  }

  const result = await handleSupabase(
    supabase.from("vehicles").insert([vehicleData]).select()
  );
  return res.json(result);
});

// UPDATE vehicle
vehiclesRouter.put("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedData = req.body;

  if (updatedData.plate) {
    const { data: existing } = await supabase
      .from("vehicles")
      .select("id")
      .eq("plate", updatedData.plate.trim())
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        success: false,
        ok: false,
        error: `Another vehicle with plate "${updatedData.plate}" already exists.`,
        message: `Another vehicle with plate "${updatedData.plate}" already exists.`
      });
    }
  }

  const result = await handleSupabase(
    supabase.from("vehicles").update(updatedData).eq("id", id).select()
  );
  return res.json(result);
});

// DELETE vehicle with cascade protection
vehiclesRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data: activeTrips } = await supabase
    .from("trips")
    .select("id, trip_number")
    .eq("vehicle_id", id)
    .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

  if (activeTrips && activeTrips.length > 0) {
    return res.status(400).json({
      success: false,
      ok: false,
      error: `Cannot delete: vehicle has ${activeTrips.length} active trip(s). Complete or cancel them first.`
    });
  }

  const result = await handleSupabase(
    supabase.from("vehicles").delete().eq("id", id)
  );
  return res.json(result);
});

// SET vehicle status
vehiclesRouter.patch("/:id/status", async (req: Request, res: Response) => {
  const { status } = req.body;
  const result = await handleSupabase(
    supabase.from("vehicles").update({ status }).eq("id", req.params.id).select()
  );
  return res.json(result);
});

// SUBMIT vehicle assessment
vehiclesRouter.post("/assessments", async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await handleSupabase(
    db.from("vehicle_assessments").insert([{
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
    }]).select().single()
  );

  // If inspection failed, lock in maintenance status
  if (result.success && (payload.has_critical_failure || payload.status === "failed")) {
    await db.from("vehicles").update({ status: "maintenance" }).eq("id", payload.vehicle_id);
  }

  return res.json(result);
});

// GET assessments (all or by vehicle)
vehiclesRouter.get("/assessments/all", async (req: Request, res: Response) => {
  const vehicleId = req.query.vehicle_id;
  let query = db
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
  if (error) return res.status(500).json({ success: false, ok: false, error: error.message });
  return res.json({ success: true, ok: true, data: data || [] });
});

// CLEAR maintenance status back to available (Admin Sign-off)
vehiclesRouter.post("/:id/clear-maintenance", async (req: Request, res: Response) => {
  const result = await handleSupabase(
    db.from("vehicles").update({ status: "available" }).eq("id", req.params.id).select()
  );
  return res.json(result);
});

