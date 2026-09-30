import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// HQ Coordinates: Malalim St, Sitio Malalim, Morong, 1960 Rizal
export const HQ_COORDINATES = {
  address: "Malalim St, Sitio Malalim, Morong, 1960 Rizal",
  latitude: 14.546827,
  longitude: 121.229383,
};

export function useDriverLocationBroadcaster(overrideTripId?: string | number | null, overrideVehicleId?: string | number | null) {
  const { employee } = useAuth();
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isBroadcastingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!employee?.id) {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const sendLocationPing = async (lat: number, lng: number, speed: number = 0, heading: number = 0) => {
      try {
        if (!employee?.id) return;

        // If tripId is not provided, look up active trip for this driver
        let tripId = overrideTripId ? Number(overrideTripId) : null;
        let vehicleId = overrideVehicleId ? Number(overrideVehicleId) : null;

        if (!tripId) {
          const { data: activeTrip } = await supabase
            .from('trips')
            .select('id, vehicle_id')
            .eq('driver_id', employee.id)
            .in('status', ['active', 'in-transit', 'in transit'])
            .order('pickup_time', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeTrip) {
            tripId = Number(activeTrip.id);
            vehicleId = activeTrip.vehicle_id ? Number(activeTrip.vehicle_id) : vehicleId;
          }
        }

        const { error } = await supabase.from('driver_locations').upsert({
          driver_id: employee.id,
          vehicle_id: vehicleId,
          trip_id: tripId,
          latitude: lat,
          longitude: lng,
          speed: Math.round(speed || 0),
          heading: Math.round(heading || 0),
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.warn('[DriverGPS] Error upserting driver location:', error.message);
        } else {
          console.log(`[DriverGPS] Location broadcasted: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Driver: ${employee.full_name})`);
        }
      } catch (err) {
        console.warn('[DriverGPS] Exception during location ping:', err);
      }
    };

    const startBroadcasting = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[DriverGPS] Location permission denied. Broadcasting default Morong HQ coordinates.');
          // Broadcast Morong HQ coordinates if GPS is disabled
          sendLocationPing(HQ_COORDINATES.latitude, HQ_COORDINATES.longitude, 0, 0);
          return;
        }

        // 1. Immediate position ping
        const initialPos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);

        if (initialPos && isMounted) {
          sendLocationPing(
            initialPos.coords.latitude,
            initialPos.coords.longitude,
            initialPos.coords.speed ? initialPos.coords.speed * 3.6 : 0,
            initialPos.coords.heading || 0
          );
        } else if (isMounted) {
          // Fallback initial ping
          sendLocationPing(HQ_COORDINATES.latitude, HQ_COORDINATES.longitude, 0, 0);
        }

        // 2. Start continuous watch subscription
        if (locationSubscriptionRef.current) {
          locationSubscriptionRef.current.remove();
        }

        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000, // Every 10 seconds
            distanceInterval: 10, // Or every 10 meters
          },
          (loc) => {
            if (!isMounted) return;
            sendLocationPing(
              loc.coords.latitude,
              loc.coords.longitude,
              loc.coords.speed ? loc.coords.speed * 3.6 : 0,
              loc.coords.heading || 0
            );
          }
        );
      } catch (err: any) {
        console.warn('[DriverGPS] Watch start failed, using fallback:', err.message);
        sendLocationPing(HQ_COORDINATES.latitude, HQ_COORDINATES.longitude, 0, 0);
      }
    };

    startBroadcasting();

    // Periodic safety heartbeat ping every 30 seconds
    const interval = setInterval(() => {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((pos) => {
          if (isMounted) {
            sendLocationPing(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.speed ? pos.coords.speed * 3.6 : 0,
              pos.coords.heading || 0
            );
          }
        })
        .catch(() => {});
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, [employee?.id, overrideTripId, overrideVehicleId]);
}
