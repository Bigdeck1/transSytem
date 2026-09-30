import { ipcMain } from "electron";
import { supabase } from "./utils";

export interface EpodSubmissionPayload {
  tripId: number | string;
  recipientName: string;
  signatureData: string; // Base64 or SVG
  photoUrl?: string;
  notes?: string;
}

export function setupEpodIPC() {
  // Submit digital Proof of Delivery
  ipcMain.handle("epod:submit", async (_, payload: EpodSubmissionPayload) => {
    try {
      const deliveredAt = new Date().toISOString();

      const { data, error } = await supabase
        .from("trips")
        .update({
          status: "delivered",
          pod_recipient_name: payload.recipientName,
          pod_signature_data: payload.signatureData,
          pod_photo_url: payload.photoUrl || null,
          pod_delivered_at: deliveredAt,
          pod_notes: payload.notes || null,
          delivery_time: deliveredAt,
        })
        .eq("id", payload.tripId)
        .select("*")
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (err: any) {
      console.error("[e-POD] Submit failed:", err.message);
      return { success: false, error: err.message };
    }
  });

  // Get e-POD details for a trip
  ipcMain.handle("epod:get", async (_, tripId: number | string) => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("id, trip_number, tracking_code, status, pod_recipient_name, pod_signature_data, pod_photo_url, pod_delivered_at, pod_notes, pickup_location, delivery_location, driver_id, vehicle_id, cargo")
        .eq("id", tripId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("[e-POD] Fetch failed:", err.message);
      return { success: false, error: err.message };
    }
  });
}
