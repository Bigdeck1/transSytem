import { Router } from "express";
import { supabaseAdmin, supabase } from "../config/supabase";

const router = Router();
const db = supabaseAdmin || supabase;

// POST /api/epod/submit
router.post("/submit", async (req, res) => {
  const { tripId, recipientName, signatureData, photoUrl, notes } = req.body;

  if (!tripId || !recipientName || !signatureData) {
    return res.status(400).json({ ok: false, error: "Missing required e-POD fields" });
  }

  try {
    const deliveredAt = new Date().toISOString();
    const { data, error } = await db
      .from("trips")
      .update({
        status: "delivered",
        pod_recipient_name: recipientName,
        pod_signature_data: signatureData,
        pod_photo_url: photoUrl || null,
        pod_delivered_at: deliveredAt,
        pod_notes: notes || null,
        delivery_time: deliveredAt,
      })
      .eq("id", tripId)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ ok: true, success: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/epod/:tripId
router.get("/:tripId", async (req, res) => {
  try {
    const { data, error } = await db
      .from("trips")
      .select("id, trip_number, tracking_code, status, pod_recipient_name, pod_signature_data, pod_photo_url, pod_delivered_at, pod_notes, pickup_location, delivery_location, driver_id, vehicle_id, cargo")
      .eq("id", req.params.tripId)
      .single();

    if (error) throw error;
    res.json({ ok: true, success: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
