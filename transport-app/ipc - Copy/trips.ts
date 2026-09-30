import { ipcMain } from "electron";
import { supabase, handleSupabase } from "./utils";
import { createNotificationForEmployee } from "./notifications";
import { sendMilestoneNotification } from "../server/services/notificationWebhook";

export function setupTripIPC() {
  ipcMain.handle("get-trips", async () => {
    const { data } = await supabase.from("trips").select("*").order("id");
    return data || [];
  });

  ipcMain.handle("add-trip", async (_, tripData) => {
    // ============================
    // SERVER-SIDE VALIDATION
    // ============================

    // Validate required fields
    if (!tripData.pickup_location || !tripData.delivery_location) {
      return { success: false, ok: false, error: "Pickup and delivery locations are required." };
    }

    // Validate date logic
    if (tripData.pickup_time && tripData.delivery_time) {
      const pickup = new Date(tripData.pickup_time);
      const delivery = new Date(tripData.delivery_time);
      if (delivery <= pickup) {
        return { success: false, ok: false, error: "Delivery time must be after pickup time." };
      }
    }

    // Check driver availability (prevent double-booking)
    if (tripData.driver_id) {
      const { data: activeTrips } = await supabase
        .from("trips")
        .select("id, trip_number")
        .eq("driver_id", tripData.driver_id)
        .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

      if (activeTrips && activeTrips.length > 0) {
        return { success: false, ok: false, error: `Driver is already assigned to active trip(s): ${activeTrips.map(t => t.trip_number).join(", ")}. Complete or cancel existing trips first.` };
      }
    }

    // Check vehicle availability (prevent double-booking)
    if (tripData.vehicle_id) {
      const { data: activeTrips } = await supabase
        .from("trips")
        .select("id, trip_number")
        .eq("vehicle_id", tripData.vehicle_id)
        .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

      if (activeTrips && activeTrips.length > 0) {
        return { success: false, ok: false, error: `Vehicle is already assigned to active trip(s): ${activeTrips.map(t => t.trip_number).join(", ")}. Complete or cancel existing trips first.` };
      }
    }

    if (!tripData.tracking_code) {
      tripData.tracking_code = `TRK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    }

    let res = await handleSupabase(
      supabase.from("trips").insert([tripData]).select().single()
    );

    // If failed because an optional column is not yet in the DB schema, retry with core fields
    if (!res.success && res.error && (res.error.includes("column") || res.error.includes("schema cache"))) {
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
      res = await handleSupabase(
        supabase.from("trips").insert([corePayload]).select().single()
      );
    }

    if (res.success && res.data) {
      try {
        if (tripData.driver_id) {
          await supabase.from("employees").update({ status: "in-use" }).eq("id", tripData.driver_id);
        }
        if (tripData.vehicle_id) {
          await supabase.from("vehicles").update({ status: "in-use" }).eq("id", tripData.vehicle_id);
        }
        // Auto-notify the assigned driver
        if (tripData.driver_id) {
          await createNotificationForEmployee(
            tripData.driver_id,
            "New Trip Assigned",
            `You have been assigned trip ${tripData.trip_number || ''} from ${tripData.pickup_location || 'N/A'} to ${tripData.delivery_location || 'N/A'}.`,
            "alert"
          );
        }
      } catch (sideEffectErr) {
        console.warn("[IPC][add-trip] Trip created but side-effect failed:", sideEffectErr);
      }
    }

    return res;
  });

  ipcMain.handle("update-trip-status", async (_, tripId: number | string, newStatus: string) => {
    const { data: trip, error: fetchErr } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (fetchErr) return { success: false, error: fetchErr.message };

    const res = await handleSupabase(
      supabase.from("trips").update({ status: newStatus }).eq("id", tripId).select()
    );

    if (res.success) {
      const normalizedStatus = String(newStatus).toLowerCase();

      // Trigger Automated Customer Milestone Notification (Email)
      try {
        let recipientEmail = "";
        let recipientName = trip.pod_recipient_name || "Valued Customer";
        let driverName = "";

        // Resolve client email from the clients table (trips only has client_id FK)
        if (trip.client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("name, email, phone")
            .eq("id", trip.client_id)
            .single();
          if (client) {
            recipientEmail = client.email || "";
            recipientName = client.name || recipientName;
          }
        }

        // Resolve driver name and live location
        let driverLocation = null;
        if (trip.driver_id) {
          const { data: driver } = await supabase
            .from("employees")
            .select("full_name")
            .eq("id", trip.driver_id)
            .single();
          if (driver) driverName = driver.full_name || "";

          const { data: loc } = await supabase
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
          sendMilestoneNotification({
            tripId,
            tripNumber: trip.trip_number || String(tripId),
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
          }).catch((err) => console.warn("[Milestone Notif] Async error:", err));
        } else if (notifStatus && !recipientEmail) {
          console.log(`[Milestone Notif] Skipped: No client email for trip #${trip.trip_number} (client_id: ${trip.client_id})`);
        }
      } catch (notifErr) {
        console.warn("[Milestone Notif] Trigger failed:", notifErr);
      }

      if (normalizedStatus === "completed" || normalizedStatus === "delivered") {
        try {
          // Only release driver if they have NO other active trips
          if (trip.driver_id) {
            const { data: otherTrips } = await supabase
              .from("trips")
              .select("id")
              .eq("driver_id", trip.driver_id)
              .neq("id", tripId)
              .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

            if (!otherTrips || otherTrips.length === 0) {
              await supabase.from("employees").update({ status: "available" }).eq("id", trip.driver_id);
            }
          }
          // Only release vehicle if it has NO other active trips
          if (trip.vehicle_id) {
            const { data: otherTrips } = await supabase
              .from("trips")
              .select("id")
              .eq("vehicle_id", trip.vehicle_id)
              .neq("id", tripId)
              .in("status", ["pending", "scheduled", "in transit", "in-transit"]);

            if (!otherTrips || otherTrips.length === 0) {
              await supabase.from("vehicles").update({ status: "available" }).eq("id", trip.vehicle_id);
            }
          }
        } catch (sideEffectErr) {
          console.warn("[IPC][update-trip-status] Status updated but resource release failed:", sideEffectErr);
        }
      }
    }

    return res;
  });

  ipcMain.handle("get-recent-trips", async () => {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .order("pickup_time", { ascending: false })
      .limit(5);
    return data || [];
  });

  // Delete a trip and release its driver/vehicle
  ipcMain.handle("delete-trip", async (_, tripId: number | string) => {
    try {
      const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single();

      const res = await handleSupabase(
        supabase.from("trips").delete().eq("id", tripId)
      );

      if (res.success && trip) {
        const activeStatuses = ["pending", "scheduled", "in transit", "in-transit"];
        if (activeStatuses.includes((trip.status || "").toLowerCase())) {
          // Only release if no other active trips for the same driver/vehicle
          if (trip.driver_id) {
            const { data: otherTrips } = await supabase
              .from("trips")
              .select("id")
              .eq("driver_id", trip.driver_id)
              .neq("id", tripId)
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
              .neq("id", tripId)
              .in("status", activeStatuses);

            if (!otherTrips || otherTrips.length === 0) {
              await supabase.from("vehicles").update({ status: "available" }).eq("id", trip.vehicle_id);
            }
          }
        }
      }
      return res;
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to delete trip" };
    }
  });

  // Full update of trip details
  ipcMain.handle("update-trip", async (_, tripId: number | string, updates: any) => {
    // Validate date logic on update too
    if (updates.pickup_time && updates.delivery_time) {
      const pickup = new Date(updates.pickup_time);
      const delivery = new Date(updates.delivery_time);
      if (delivery <= pickup) {
        return { success: false, ok: false, error: "Delivery time must be after pickup time." };
      }
    }

    return handleSupabase(
      supabase.from("trips").update(updates).eq("id", tripId).select().single()
    );
  });

  // -------------------------
  // MULTI-STOP TRIP HANDLERS
  // -------------------------
  ipcMain.handle("trips:getStops", async (_, tripId: number | string) => {
    const { data, error } = await supabase
      .from("trip_stops")
      .select("*")
      .eq("trip_id", tripId)
      .order("stop_sequence", { ascending: true });

    if (error) return { success: false, ok: false, error: error.message };
    return { success: true, ok: true, data: data || [] };
  });

  ipcMain.handle("trips:addStops", async (_, tripId: number | string, stops: any[]) => {
    if (!Array.isArray(stops) || stops.length === 0) {
      return { success: false, error: "Stops array is required." };
    }

    const payload = stops.map((s, idx) => ({
      trip_id: Number(tripId),
      stop_sequence: s.stop_sequence || idx + 1,
      stop_type: s.stop_type || "dropoff",
      location_name: s.location_name || s.address || `Stop #${idx + 1}`,
      address: s.address,
      latitude: s.latitude || null,
      longitude: s.longitude || null,
      contact_person: s.contact_person || null,
      contact_phone: s.contact_phone || null,
      cargo_description: s.cargo_description || null,
      package_weight_kg: s.package_weight_kg || null,
      tracking_code: s.tracking_code || `STP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      status: "pending",
    }));

    return handleSupabase(
      supabase.from("trip_stops").insert(payload).select()
    );
  });

  ipcMain.handle("trips:updateStop", async (_, stopId: number | string, updates: any) => {
    return handleSupabase(
      supabase.from("trip_stops").update(updates).eq("id", stopId).select().single()
    );
  });
}
