/**
 * HERMES Driver Safety Monitor — Supabase Event Logger
 *
 * Handles all safety event persistence. Only structured event data is sent
 * to Supabase — no camera video, no raw image frames.
 *
 * Privacy contract:
 *   ✅  Fatigue score (number)
 *   ✅  Event type / severity / duration
 *   ✅  Timestamp, employee_id, trip_id
 *   ❌  Camera frames / screenshots
 *   ❌  Continuous video or audio
 */

import { supabase } from './supabase';
import {
  SafetyEvent,
  SafetyEventType,
  SafetyEventSeverity,
  FatigueLevel,
  FatigueScore,
  FATIGUE_LEVEL_EVENT,
  FATIGUE_LEVEL_SEVERITY,
} from '../types/safety';

// ─────────────────────────────────────────────
// TABLE NAME
// ─────────────────────────────────────────────
const SAFETY_EVENTS_TABLE = 'safety_events';

// ─────────────────────────────────────────────
// CORE LOG FUNCTION
// ─────────────────────────────────────────────

/**
 * Logs a safety event to Supabase.
 * Fire-and-forget — does not throw; errors are logged to console.
 */
export async function logSafetyEvent(event: SafetyEvent): Promise<void> {
  try {
    const { error } = await supabase
      .from(SAFETY_EVENTS_TABLE)
      .insert({
        employee_id: event.employee_id,
        trip_id: event.trip_id,
        event_type: event.event_type,
        severity: event.severity,
        fatigue_score: event.fatigue_score,
        duration_seconds: event.duration_seconds,
        timestamp: event.timestamp,
        metadata: event.metadata ?? null,
      });

    if (error) {
      console.warn('[SafetyMonitor] Failed to log event:', error.message, event.event_type);
    } else {
      console.log(`[SafetyMonitor] Event logged: ${event.event_type} (score: ${event.fatigue_score})`);
    }
  } catch (err) {
    // Non-critical — monitoring should never crash due to logging failures
    console.warn('[SafetyMonitor] Unexpected error logging event:', err);
  }
}

// ─────────────────────────────────────────────
// CONVENIENCE HELPERS
// ─────────────────────────────────────────────

/**
 * Logs a fatigue level change event.
 * Called by useDriverSafetyMonitor when level transitions occur.
 */
export async function logFatigueEvent(
  employeeId: string,
  tripId: string,
  newLevel: FatigueLevel,
  score: FatigueScore,
  durationSeconds: number
): Promise<void> {
  const event: SafetyEvent = {
    employee_id: employeeId,
    trip_id: tripId,
    event_type: FATIGUE_LEVEL_EVENT[newLevel],
    severity: FATIGUE_LEVEL_SEVERITY[newLevel],
    fatigue_score: score.score,
    duration_seconds: durationSeconds,
    timestamp: new Date().toISOString(),
    metadata: {
      dominant_signal: score.dominantSignal,
      reasoning: score.reasoning,
      alert_level: newLevel,
    },
  };
  await logSafetyEvent(event);
}

/**
 * Logs that safety monitoring started for a trip.
 */
export async function logMonitoringStarted(
  employeeId: string,
  tripId: string
): Promise<void> {
  await logSafetyEvent({
    employee_id: employeeId,
    trip_id: tripId,
    event_type: 'monitoring_started',
    severity: 'info',
    fatigue_score: 0,
    duration_seconds: 0,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logs that safety monitoring ended (trip completed or app backgrounded).
 */
export async function logMonitoringEnded(
  employeeId: string,
  tripId: string,
  totalTripDurationSeconds: number,
  totalEventCount: number
): Promise<void> {
  await logSafetyEvent({
    employee_id: employeeId,
    trip_id: tripId,
    event_type: 'monitoring_ended',
    severity: 'info',
    fatigue_score: 0,
    duration_seconds: totalTripDurationSeconds,
    timestamp: new Date().toISOString(),
    metadata: {
      reasoning: `Trip ended. Total safety events: ${totalEventCount}`,
    },
  });
}

/**
 * Logs the result of the pre-trip alertness check.
 */
export async function logPreTripCheck(
  employeeId: string,
  tripId: string,
  passed: boolean,
  detectedFrames: number,
  totalFrames: number
): Promise<void> {
  await logSafetyEvent({
    employee_id: employeeId,
    trip_id: tripId,
    event_type: passed ? 'pre_trip_check_passed' : 'pre_trip_check_failed',
    severity: passed ? 'info' : 'medium',
    fatigue_score: 0,
    duration_seconds: 0,
    timestamp: new Date().toISOString(),
    metadata: {
      reasoning: `${detectedFrames}/${totalFrames} frames with face detected`,
    },
  });
}

/**
 * Logs a face-absent event (distinct from drowsiness — camera issue or
 * driver looking away, not classified as sleep).
 */
export async function logFaceAbsent(
  employeeId: string,
  tripId: string,
  durationSeconds: number
): Promise<void> {
  await logSafetyEvent({
    employee_id: employeeId,
    trip_id: tripId,
    event_type: 'face_absent',
    severity: 'low',
    fatigue_score: 0,
    duration_seconds: durationSeconds,
    timestamp: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────
// QUERY HELPERS (for admin dashboard or trip summary)
// ─────────────────────────────────────────────

/**
 * Fetches all safety events for a specific trip.
 * Returns events sorted by timestamp ascending.
 */
export async function getSafetyEventsForTrip(
  tripId: string
): Promise<SafetyEvent[]> {
  const { data, error } = await supabase
    .from(SAFETY_EVENTS_TABLE)
    .select('*')
    .eq('trip_id', tripId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.warn('[SafetyMonitor] Failed to fetch trip events:', error.message);
    return [];
  }
  return data as SafetyEvent[];
}

/**
 * Fetches safety events for an employee across a date range.
 * Useful for admin safety reports.
 */
export async function getSafetyEventsForEmployee(
  employeeId: string,
  fromDate: string,  // ISO date string e.g. '2026-09-27'
  toDate: string
): Promise<SafetyEvent[]> {
  const { data, error } = await supabase
    .from(SAFETY_EVENTS_TABLE)
    .select('*')
    .eq('employee_id', employeeId)
    .gte('timestamp', fromDate)
    .lte('timestamp', toDate + 'T23:59:59Z')
    .order('timestamp', { ascending: false });

  if (error) {
    console.warn('[SafetyMonitor] Failed to fetch employee events:', error.message);
    return [];
  }
  return data as SafetyEvent[];
}

/**
 * Counts warning/critical events for today across all drivers.
 * Used by the admin safety dashboard.
 */
export async function getTodaySafetySummary(): Promise<{
  totalWarnings: number;
  totalCritical: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from(SAFETY_EVENTS_TABLE)
    .select('event_type, severity')
    .gte('timestamp', todayStart.toISOString())
    .in('event_type', ['drowsiness_level_1', 'drowsiness_level_2', 'drowsiness_level_3']);

  if (error || !data) return { totalWarnings: 0, totalCritical: 0 };

  return {
    totalWarnings: data.filter(e => e.severity === 'low' || e.severity === 'medium' || e.severity === 'high').length,
    totalCritical: data.filter(e => e.severity === 'critical').length,
  };
}
