import { Router, Request, Response } from "express";
import { supabaseAdmin, supabase, handleSupabase } from "../config/supabase";
import { createNotificationForEmployee } from "./notifications.routes";

const db = supabaseAdmin || supabase;

export const tripsRouter = Router();

// GET all trips
tripsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await db.from("trips").select("*").order("id");
    if (error) {
      console.error("[TRIPS] Error fetching trips:", error.message);
      return res.json([]);
    }
    return res.json(data || []);
  } catch (err) {
    console.error("[TRIPS] Unexpected error fetching trips:", err);
    return res.json([]);
  }
});

// GET recent trips (last 5)
tripsRouter.get("/recent", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await db
      .from("trips")
      .select("*")
      .order("pickup_time", { ascending: false })
      .limit(5);
    if (error) {
      console.error("[TRIPS] Error fetching recent trips:", error.message);
      return res.json([]);
    }
    return res.json(data || []);
  } catch (err) {
    console.error("[TRIPS] Unexpected error fetching recent trips:", err);
    return res.json([]);
  }
});

// ADD trip
tripsRouter.post("/", async (req: Request, res: Response) => {
  const tripData = req.body;

  // Validation
  if (!tripData.pickup_location || !tripData.delivery_location) {
    return res.status(400).json({ success: false, ok: false, error: "Pickup and delivery locations are required." });
  }

  if (tripData.pickup_time && tripData.delivery_time) {
    const pickup = new Date(tripData.pickup_time);
    const delivery = new Date(tripData.delivery_time);
    if (delivery <= pickup) {
      return res.status(400).json({ success: false, ok: false, error: "Delivery time must be after pickup time." });
    }
  }

  // Driver availability check
  if (tripData.driver_id) {
    const { data: activeTrips } = await supabase
      .from("trips")
      .select("id, trip_number")
      .eq("driver_id", tripData.driver_id)
      .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

    if (activeTrips && activeTrips.length > 0) {
      return res.status(400).json({
        success: false,
        ok: false,
        error: `Driver is already assigned to active trip(s): ${activeTrips.map(t => t.trip_number).join(", ")}.`
      });
    }
  }

  // Vehicle availability check
  if (tripData.vehicle_id) {
    const { data: activeTrips } = await supabase
      .from("trips")
      .select("id, trip_number")
      .eq("vehicle_id", tripData.vehicle_id)
      .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

    if (activeTrips && activeTrips.length > 0) {
      return res.status(400).json({
        success: false,
        ok: false,
        error: `Vehicle is already assigned to active trip(s): ${activeTrips.map(t => t.trip_number).join(", ")}.`
      });
    }
  }

  if (!tripData.tracking_code) {
    tripData.tracking_code = `TRK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }

  let result = await handleSupabase(
    supabase.from("trips").insert([tripData]).select().single()
  );

  // If failed because an optional column is not yet in the DB schema, retry with core fields
  if (!result.success && result.error && (result.error.includes("column") || result.error.includes("schema cache"))) {
    const corePayload = {
      trip_number: tripData.trip_number,
      tracking_code: tripData.tracking_code,
      driver_id: tripData.driver_id,
      vehicle_id: tripData.vehicle_id,
      client_id: tripData.client_id,
      customer_number: tripData.customer_number,
      pickup_location: tripData.pickup_location,
      delivery_location: tripData.delivery_location,
      pickup_time: tripData.pickup_time,
      delivery_time: tripData.delivery_time,
      cargo: tripData.cargo,
      status: tripData.status || "Pending",
    };
    result = await handleSupabase(
      supabase.from("trips").insert([corePayload]).select().single()
    );
  }

  if (result.success && result.data) {
    try {
      if (tripData.driver_id) {
        await supabase.from("employees").update({ status: "in-use" }).eq("id", tripData.driver_id);
      }
      if (tripData.vehicle_id) {
        await supabase.from("vehicles").update({ status: "in-use" }).eq("id", tripData.vehicle_id);
      }
      if (tripData.driver_id) {
        await createNotificationForEmployee(
          tripData.driver_id,
          "New Trip Assigned",
          `You have been assigned trip ${tripData.trip_number || ""} from ${tripData.pickup_location || "N/A"} to ${tripData.delivery_location || "N/A"}.`,
          "alert"
        );
      }
    } catch (sideEffectErr) {
      console.warn("[SERVER][add-trip] Side effect warning:", sideEffectErr);
    }
  }

  return res.json(result);
});

// UPDATE trip status
tripsRouter.patch("/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const { data: trip, error: fetchErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !trip) {
    return res.status(404).json({ success: false, error: fetchErr?.message || "Trip not found" });
  }

  const result = await handleSupabase(
    supabase.from("trips").update({ status }).eq("id", id).select()
  );

  if (result.success) {
    const normalizedStatus = String(status).toLowerCase();

    // ============================================================
    // Trigger Customer Milestone Email Notification
    // ============================================================
    try {
      // Resolve client email from the clients table (trips only has client_id FK)
      let recipientEmail = "";
      let recipientName = "Valued Customer";
      let recipientPhone = "";

      if (trip.client_id) {
        const { data: client } = await db
          .from("clients")
          .select("name, email, phone")
          .eq("id", trip.client_id)
          .single();

        if (client) {
          recipientEmail = client.email || "";
          recipientName = client.name || "Valued Customer";
          recipientPhone = client.phone || "";
        }
      }

      // Resolve driver name and live location for the email body
      let driverName = "";
      let driverLocation = null;
      if (trip.driver_id) {
        const { data: driver } = await db
          .from("employees")
          .select("full_name")
          .eq("id", trip.driver_id)
          .single();
        if (driver) driverName = driver.full_name || "";

        const { data: loc } = await db
          .from("driver_locations")
          .select("latitude, longitude, speed, heading, updated_at")
          .eq("driver_id", trip.driver_id)
          .maybeSingle();
        driverLocation = loc;
      }

      let notifStatus: "booked" | "in-transit" | "approaching" | "delivered" | "failed" | null = null;
      if (normalizedStatus === "in-transit" || normalizedStatus === "in transit" || normalizedStatus === "active") {
        notifStatus = "in-transit";
      } else if (normalizedStatus === "delivered" || normalizedStatus === "completed") {
        notifStatus = "delivered";
      } else if (normalizedStatus === "failed") {
        notifStatus = "failed";
      }

      if (notifStatus && recipientEmail) {
        const { sendCustomerMilestoneEmail } = await import("../services/notificationWebhook");
        sendCustomerMilestoneEmail({
          tripId: String(id),
          tripNumber: trip.trip_number || String(id),
          trackingCode: trip.tracking_code,
          recipientName,
          recipientEmail,
          status: notifStatus,
          deliveryLocation: trip.delivery_location,
          pickupLocation: trip.pickup_location,
          driverName,
          driverLocation,
          podRecipientName: trip.pod_recipient_name,
          failureReason: trip.pod_notes,
        }).then((r) => {
          console.log(`[EMAIL] Milestone email result for trip #${trip.trip_number}:`, r.message);
        }).catch((err) => {
          console.warn("[EMAIL] Async send error:", err.message || err);
        });
      } else if (notifStatus && !recipientEmail) {
        console.log(`[EMAIL] Skipped: No client email found for trip #${trip.trip_number} (client_id: ${trip.client_id})`);
      }
    } catch (notifErr: any) {
      console.warn("[EMAIL] Trigger failed:", notifErr.message || notifErr);
    }

    // ============================================================
    // Release driver/vehicle on completion
    // ============================================================
    if (normalizedStatus === "completed" || normalizedStatus === "delivered") {
      try {
        if (trip.driver_id) {
          const { data: otherTrips } = await supabase
            .from("trips")
            .select("id")
            .eq("driver_id", trip.driver_id)
            .neq("id", id)
            .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

          if (!otherTrips || otherTrips.length === 0) {
            await supabase.from("employees").update({ status: "available" }).eq("id", trip.driver_id);
          }
        }

        if (trip.vehicle_id) {
          const { data: otherTrips } = await supabase
            .from("trips")
            .select("id")
            .eq("vehicle_id", trip.vehicle_id)
            .neq("id", id)
            .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

          if (!otherTrips || otherTrips.length === 0) {
            await supabase.from("vehicles").update({ status: "available" }).eq("id", trip.vehicle_id);
          }
        }
      } catch (sideEffectErr) {
        console.warn("[SERVER][update-trip-status] Resource release warning:", sideEffectErr);
      }
    }
  }

  return res.json(result);
});

// UPDATE trip details
tripsRouter.put("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  if (updates.pickup_time && updates.delivery_time) {
    const pickup = new Date(updates.pickup_time);
    const delivery = new Date(updates.delivery_time);
    if (delivery <= pickup) {
      return res.status(400).json({ success: false, ok: false, error: "Delivery time must be after pickup time." });
    }
  }

  const result = await handleSupabase(
    supabase.from("trips").update(updates).eq("id", id).select().single()
  );
  return res.json(result);
});

// DELETE trip
tripsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();

    const result = await handleSupabase(
      supabase.from("trips").delete().eq("id", id)
    );

    if (result.success && trip) {
      const activeStatuses = ["pending", "scheduled", "in transit", "in-transit"];
      if (activeStatuses.includes((trip.status || "").toLowerCase())) {
        if (trip.driver_id) {
          const { data: otherTrips } = await supabase
            .from("trips")
            .select("id")
            .eq("driver_id", trip.driver_id)
            .neq("id", id)
            .in("status", activeStatuses);

          if (!otherTrips || otherTrips.length === 0) {
            await supabase.from("employees").update({ status: "available" }).eq("id", trip.driver_id);
          }
        }
        if (trip.vehicle_id) {
          const { data: otherTrips } = await supabase
            .from("trips")
            .select("id")
            .eq("vehicle_id", trip.vehicle_id)
            .neq("id", id)
            .in("status", activeStatuses);

          if (!otherTrips || otherTrips.length === 0) {
            await supabase.from("vehicles").update({ status: "available" }).eq("id", trip.vehicle_id);
          }
        }
      }
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to delete trip" });
  }
});
