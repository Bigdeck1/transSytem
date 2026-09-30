import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

// Calculate Haversine distance in meters
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function useGeofenceTracker(
  currentLat?: number | null,
  currentLng?: number | null,
  activeTrip?: any,
  onStatusUpdated?: () => void
) {
  const hasTriggeredDepartedHqRef = useRef<boolean>(false);
  const hasTriggeredArrivedDestRef = useRef<boolean>(false);

  const hqLat = 14.546827;
  const hqLng = 121.229383;

  useEffect(() => {
    if (!currentLat || !currentLng || !activeTrip?.id) return;

    const distFromHq = getDistanceMeters(currentLat, currentLng, hqLat, hqLng);

    // 1. Geofence: Morong HQ Departure (> 250m away from depot)
    if (distFromHq > 250 && !hasTriggeredDepartedHqRef.current && (activeTrip.status === 'scheduled' || activeTrip.status === 'active')) {
      hasTriggeredDepartedHqRef.current = true;
      console.log(`[Geofence] Vehicle departed Morong HQ Depot (${distFromHq}m). Setting in-transit.`);

      supabase
        .from('trips')
        .update({ status: 'in-transit' })
        .eq('id', activeTrip.id)
        .then(({ error }) => {
          if (!error) {
            onStatusUpdated?.();
          }
        });
    }

    // 2. Geofence: Destination Arrival (< 150m from delivery coordinates)
    if (activeTrip.delivery_lat && activeTrip.delivery_lng) {
      const distFromDest = getDistanceMeters(
        currentLat,
        currentLng,
        Number(activeTrip.delivery_lat),
        Number(activeTrip.delivery_lng)
      );

      if (distFromDest <= 150 && !hasTriggeredArrivedDestRef.current && activeTrip.status === 'in-transit') {
        hasTriggeredArrivedDestRef.current = true;
        console.log(`[Geofence] Arrived near destination (${distFromDest}m).`);

        Alert.alert(
          '📍 Arrived at Delivery Destination',
          `You have arrived at ${activeTrip.delivery_location || 'the dropoff point'}. Tap below to scan cargo QR or collect recipient e-POD signature.`,
          [{ text: 'Got It', style: 'default' }]
        );
      }
    }
  }, [currentLat, currentLng, activeTrip?.id, activeTrip?.status, activeTrip?.delivery_lat, activeTrip?.delivery_lng, onStatusUpdated]);
}
