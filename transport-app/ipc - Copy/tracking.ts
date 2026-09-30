import { ipcMain } from "electron";
import { supabase, supabaseAdmin, handleSupabase } from "./utils";
import { calculatePackageEstimate, PackageInput } from "./packageEstimator";

// Fallback haversine distance calculator if network is offline
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export async function fetchOSRMRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data: any = await res.json();
    if (data && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distanceKm: Number((route.distance / 1000).toFixed(2)),
        durationMins: Math.max(1, Math.round(route.duration / 60)),
        geometry: route.geometry,
      };
    }
  } catch (err) {
    console.warn("[Tracking] OSRM routing failed or timed out, using fallback calculation:", err);
  }

  // Fallback if offline or API unreachable
  const straightDist = haversineDistanceKm(startLat, startLng, endLat, endLng);
  const roadDist = Number((straightDist * 1.35).toFixed(2)); // estimated road tortuosity
  const durationMins = Math.max(2, Math.round((roadDist / 35) * 60)); // assuming 35km/h avg urban speed

  return {
    distanceKm: roadDist,
    durationMins,
    geometry: {
      type: "LineString",
      coordinates: [
        [startLng, startLat],
        [endLng, endLat],
      ],
    },
  };
}

export function setupTrackingIPC() {
  // 1. Dual-Leg Route & ETA Estimation (HQ -> Origin -> Destination)
  ipcMain.handle(
    "tracking:getDualLegEstimate",
    async (
      _,
      payload: {
        hq: { lat: number; lng: number; address?: string };
        pickup: { lat: number; lng: number; address?: string };
        delivery: { lat: number; lng: number; address?: string };
      }
    ) => {
      try {
        const hq = payload.hq || {
          lat: 14.546827,
          lng: 121.229383,
          address: "Malalim St, Sitio Malalim, Morong, 1960 Rizal",
        };
        const pickup = payload.pickup;
        const delivery = payload.delivery;

        if (!pickup?.lat || !pickup?.lng || !delivery?.lat || !delivery?.lng) {
          return { success: false, ok: false, error: "Pickup and delivery coordinates are required." };
        }

        // Leg 1: Dispatch (HQ -> Origin)
        const leg1 = await fetchOSRMRoute(hq.lat, hq.lng, pickup.lat, pickup.lng);
        // Leg 2: Transit (Origin -> Destination)
        const leg2 = await fetchOSRMRoute(pickup.lat, pickup.lng, delivery.lat, delivery.lng);

        const totalDistanceKm = Number((leg1.distanceKm + leg2.distanceKm).toFixed(2));
        const totalDurationMins = leg1.durationMins + leg2.durationMins;

        return {
          success: true,
          ok: true,
          data: {
            dispatchLeg: {
              title: "Leg 1: Dispatch (HQ to Origin)",
              from: hq.address || "Company Depot",
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
        };
      } catch (err: any) {
        return { success: false, ok: false, error: err.message || "Failed to calculate tracking estimate." };
      }
    }
  );

  // 2. Package Estimation Helper
  ipcMain.handle("tracking:estimatePackage", async (_, input: PackageInput) => {
    try {
      const estimate = calculatePackageEstimate(input);
      return { success: true, ok: true, data: estimate };
    } catch (err: any) {
      return { success: false, ok: false, error: err.message || "Failed to calculate package estimate." };
    }
  });

  // 3. Live Driver GPS Location Tracking
  ipcMain.handle(
    "tracking:updateDriverLocation",
    async (
      _,
      payload: {
        driver_id: string;
        vehicle_id?: number;
        trip_id?: number;
        latitude: number;
        longitude: number;
        speed?: number;
        heading?: number;
      }
    ) => {
      return handleSupabase(
        supabaseAdmin
          .from("driver_locations")
          .upsert({
            driver_id: payload.driver_id,
            vehicle_id: payload.vehicle_id || null,
            trip_id: payload.trip_id || null,
            latitude: payload.latitude,
            longitude: payload.longitude,
            speed: payload.speed || 0,
            heading: payload.heading || 0,
            updated_at: new Date().toISOString(),
          })
          .select()
      );
    }
  );

  // 4. Get all active fleet locations
  ipcMain.handle("tracking:getLiveFleetLocations", async () => {
    const { data, error } = await supabaseAdmin.from("driver_locations").select(`
      *,
      employees:driver_id ( full_name, employee_id, phone ),
      vehicles:vehicle_id ( plate, brand, model, vehicle_type ),
      trips:trip_id ( trip_number, status, pickup_location, delivery_location )
    `);

    if (error) return { success: false, ok: false, error: error.message };
    return { success: true, ok: true, data: data || [] };
  });
}
