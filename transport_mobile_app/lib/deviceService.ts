import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

const DEVICE_ID_KEY = "@jrr_transport_driver_device_id";
const DEVICE_MODEL_KEY = "@jrr_transport_driver_device_model";

/**
 * Generate a RFC4122 v4 UUID without external crypto dependency
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieve or generate a persistent unique Device ID for this installation
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      const osPrefix = Platform.OS === "ios" ? "IOS" : "AND";
      const randomHex = generateUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
      deviceId = `DEV-${osPrefix}-${randomHex}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (err) {
    console.warn("[DeviceService] Failed to read/store device ID:", err);
    return `DEV-${Platform.OS.toUpperCase()}-TEMP`;
  }
}

/**
 * Get a friendly device model string (e.g., "Pixel 7 Pro (Android v34)")
 */
export function getDeviceModel(): string {
  const osName = Platform.OS === "ios" ? "Apple iOS" : "Android";
  const osVer = Platform.Version ? `v${Platform.Version}` : "";
  const deviceName =
    Constants.deviceName ||
    (Platform.OS === "android" ? "Android Phone" : "Apple iPhone");
  return `${deviceName} (${osName} ${osVer})`.trim();
}

export type DeviceLockStatus = {
  isLocked: boolean;
  boundDeviceId: string | null;
  boundDeviceModel: string | null;
  currentDeviceId: string;
  currentDeviceModel: string;
  pendingRequest: any | null;
};

/**
 * Check if the driver is bound to this device or if device lock is active
 */
export async function checkDeviceLockStatus(
  employeeId: string,
  boundDeviceId?: string | null,
  boundDeviceModel?: string | null,
  deviceLockEnabled: boolean = true
): Promise<DeviceLockStatus> {
  const currentDeviceId = await getOrCreateDeviceId();
  const currentDeviceModel = getDeviceModel();

  // If device lock policy is disabled by Super Admin, allow through
  if (deviceLockEnabled === false) {
    return {
      isLocked: false,
      boundDeviceId: boundDeviceId || null,
      boundDeviceModel: boundDeviceModel || null,
      currentDeviceId,
      currentDeviceModel,
      pendingRequest: null,
    };
  }

  // First time: No device bound yet
  if (!boundDeviceId) {
    return {
      isLocked: false,
      boundDeviceId: null,
      boundDeviceModel: null,
      currentDeviceId,
      currentDeviceModel,
      pendingRequest: null,
    };
  }

  // Device matches bound hardware
  if (boundDeviceId === currentDeviceId) {
    return {
      isLocked: false,
      boundDeviceId,
      boundDeviceModel: boundDeviceModel || null,
      currentDeviceId,
      currentDeviceModel,
      pendingRequest: null,
    };
  }

  // Device mismatch — check for pending transfer request
  let pendingRequest = null;
  try {
    const { data } = await supabase
      .from("driver_device_requests")
      .select("*")
      .eq("driver_id", employeeId)
      .eq("new_device_id", currentDeviceId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    pendingRequest = data;
  } catch (err) {
    console.warn("[DeviceService] Error querying device transfer requests:", err);
  }

  return {
    isLocked: true,
    boundDeviceId,
    boundDeviceModel: boundDeviceModel || null,
    currentDeviceId,
    currentDeviceModel,
    pendingRequest,
  };
}

/**
 * Submit a request to admin to transfer/bind a new mobile device
 */
export async function submitDeviceTransferRequest(
  driverId: string,
  currentDeviceId: string,
  newDeviceId: string,
  newDeviceModel: string,
  reason: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // Check if identical pending request exists
    const { data: existing } = await supabase
      .from("driver_device_requests")
      .select("id, status")
      .eq("driver_id", driverId)
      .eq("new_device_id", newDeviceId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        data: existing,
      };
    }

    const { data, error } = await supabase
      .from("driver_device_requests")
      .insert({
        driver_id: driverId,
        current_device_id: currentDeviceId,
        new_device_id: newDeviceId,
        new_device_model: newDeviceModel,
        reason: reason || "Driver switched mobile hardware",
        status: "pending",
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("[DeviceService] submitDeviceTransferRequest error:", err);
    return {
      success: false,
      error: err.message || "Failed to submit device transfer request",
    };
  }
}

/**
 * Check if a driver's pending transfer request has been approved by admin
 */
export async function checkTransferRequestApproval(
  driverId: string,
  newDeviceId: string
): Promise<{ isApproved: boolean; status: string; record?: any }> {
  try {
    const { data, error } = await supabase
      .from("driver_device_requests")
      .select("*")
      .eq("driver_id", driverId)
      .eq("new_device_id", newDeviceId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { isApproved: false, status: "none" };
    }

    return {
      isApproved: data.status === "approved",
      status: data.status,
      record: data,
    };
  } catch {
    return { isApproved: false, status: "error" };
  }
}
