/**
 * HERMES Driver Safety Monitor — Core Fatigue Detection Hook
 *
 * Runs locally on the driver's device:
 * 1. Accumulates face/eye/head data into rolling fatigue indicators
 * 2. Computes real-time 0–100 fatigue score
 * 3. Drives progressive 4-level alerts (Level 0: Normal, 1: Caution, 2: Drowsy, 3: Critical)
 * 4. Triggers progressive haptics (expo-haptics)
 * 5. Automatically logs safety events to Supabase on state transitions
 * 6. Includes a built-in simulation engine for immediate testing on physical phones or simulators
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import {
  FatigueLevel,
  FatigueScore,
  FatigueIndicators,
  DEFAULT_FATIGUE_INDICATORS,
  FaceFrameData,
  SCORE_THRESHOLDS,
  SafetyMonitorState,
  DEFAULT_MONITOR_STATE,
} from '../types/safety';
import {
  logFatigueEvent,
  logMonitoringStarted,
  logMonitoringEnded,
  logFaceAbsent,
} from '../lib/safetyEvents';

interface UseDriverSafetyMonitorProps {
  tripId?: string | number | null;
  employeeId?: string | null;
  driverName?: string;
  isActive?: boolean;
}

export function useDriverSafetyMonitor({
  tripId,
  employeeId,
  driverName,
  isActive = false,
}: UseDriverSafetyMonitorProps) {
  const [monitorState, setMonitorState] = useState<SafetyMonitorState>(DEFAULT_MONITOR_STATE);
  const [indicators, setIndicators] = useState<FatigueIndicators>(DEFAULT_FATIGUE_INDICATORS);

  // Internal tracking refs to avoid stale closures in frame loops
  const indicatorsRef = useRef<FatigueIndicators>(DEFAULT_FATIGUE_INDICATORS);
  const currentLevelRef = useRef<FatigueLevel>(0);
  const alertStartTimeRef = useRef<number | null>(null);
  const tripStartTimeRef = useRef<number>(Date.now());
  const eventCounterRef = useRef<number>(0);
  const lastFaceSeenRef = useRef<number>(Date.now());

  // ─────────────────────────────────────────────
  // FATIGUE SCORE CALCULATION
  // ─────────────────────────────────────────────
  const computeFatigueScore = useCallback((ind: FatigueIndicators): FatigueScore => {
    let score = 0;
    let dominantSignal: FatigueScore['dominantSignal'] = 'none';
    const reasons: string[] = [];

    // 1. Eye Closure (Most critical signal)
    if (ind.eyeClosureDurationMs >= SCORE_THRESHOLDS.EYE_CLOSURE_CRITICAL_MS) {
      score += 70;
      dominantSignal = 'eye_closure';
      reasons.push(`Eyes closed for ${(ind.eyeClosureDurationMs / 1000).toFixed(1)}s`);
    } else if (ind.eyeClosureDurationMs >= SCORE_THRESHOLDS.EYE_CLOSURE_WARNING_MS) {
      score += 45;
      if (dominantSignal === 'none') dominantSignal = 'eye_closure';
      reasons.push(`Eyes closed for ${(ind.eyeClosureDurationMs / 1000).toFixed(1)}s`);
    }

    // 2. Yawning / Mouth Opening (Rolling count)
    if (ind.yawnCountLast5Min >= 3) {
      score += 30;
      if (dominantSignal === 'none') dominantSignal = 'yawning';
      reasons.push(`Frequent yawns (${ind.yawnCountLast5Min} in 5m)`);
    } else if (ind.yawnCountLast5Min >= 1) {
      score += 15;
      if (dominantSignal === 'none') dominantSignal = 'yawning';
      reasons.push(`Yawn detected`);
    }

    // 3. Head Dropping Forward / Severe Tilting
    if (ind.headDropDegrees >= SCORE_THRESHOLDS.HEAD_DROP_DEGREES) {
      score += 25;
      if (dominantSignal === 'none') dominantSignal = 'head_drop';
      reasons.push(`Head dropped forward (${ind.headDropDegrees.toFixed(0)}°)`);
    }

    // 4. Excessive Blinking / Flutter
    if (ind.blinkCountLastMinute > 30) {
      score += 15;
      reasons.push(`High blink rate (${ind.blinkCountLastMinute}/min)`);
    }

    // Clamp score 0 - 100
    score = Math.min(100, Math.max(0, score));

    // Determine progressive fatigue level
    let level: FatigueLevel = 0;
    if (score >= SCORE_THRESHOLDS.LEVEL_3_MIN) {
      level = 3; // Critical
    } else if (score >= SCORE_THRESHOLDS.LEVEL_2_MIN) {
      level = 2; // Warning
    } else if (score >= SCORE_THRESHOLDS.LEVEL_1_MIN) {
      level = 1; // Caution
    } else {
      level = 0; // Normal
    }

    return {
      score,
      level,
      dominantSignal,
      reasoning: reasons.length > 0 ? reasons.join('; ') : 'Driver alert and responsive',
    };
  }, []);

  // ─────────────────────────────────────────────
  // TRIGGER PROGRESSIVE ALERTS & HAPTICS
  // ─────────────────────────────────────────────
  const triggerHapticsForLevel = useCallback(async (level: FatigueLevel) => {
    try {
      if (level === 1) {
        // Level 1: Gentle vibration
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (level === 2) {
        // Level 2: Strong sustained vibration
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 300);
      } else if (level === 3) {
        // Level 3: Urgent repetitive vibration
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }, 250);
        setTimeout(async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 500);
      }
    } catch (e) {
      // Haptics may be unsupported in web preview
    }
  }, []);

  // ─────────────────────────────────────────────
  // PROCESS INCOMING FACE FRAME
  // ─────────────────────────────────────────────
  const processFrame = useCallback((frame: FaceFrameData) => {
    const now = frame.timestamp || Date.now();
    const ind = { ...indicatorsRef.current };

    if (!frame.faceDetected) {
      ind.faceAbsentDurationMs = now - lastFaceSeenRef.current;
      // If face has been missing for over 5s, log face absent event once
      if (ind.faceAbsentDurationMs > SCORE_THRESHOLDS.FACE_ABSENT_WARNING_MS && ind.faceAbsentDurationMs < 6000) {
        if (employeeId && tripId) {
          logFaceAbsent(String(employeeId), String(tripId), Math.round(ind.faceAbsentDurationMs / 1000));
        }
      }
    } else {
      lastFaceSeenRef.current = now;
      ind.faceAbsentDurationMs = 0;

      // Check Eye Openness
      const leftOpen = frame.leftEyeOpenProbability ?? 1.0;
      const rightOpen = frame.rightEyeOpenProbability ?? 1.0;
      const eyesClosed = leftOpen < SCORE_THRESHOLDS.EYE_CLOSED_THRESHOLD && rightOpen < SCORE_THRESHOLDS.EYE_CLOSED_THRESHOLD;

      if (eyesClosed) {
        ind.eyeClosureDurationMs += 250; // incremented per detection interval
      } else {
        // Reset or decay
        ind.eyeClosureDurationMs = Math.max(0, ind.eyeClosureDurationMs - 500);
      }

      // Check Head Drop
      if (frame.headEulerAngleX !== null && frame.headEulerAngleX > 15) {
        ind.headDropDegrees = frame.headEulerAngleX;
      } else {
        ind.headDropDegrees = 0;
      }

      // Check Yawn proxy
      if (frame.smilingProbability !== null && frame.smilingProbability > SCORE_THRESHOLDS.YAWN_PROBABILITY_THRESHOLD) {
        ind.yawnCountLast5Min = Math.min(5, ind.yawnCountLast5Min + 1);
      }
    }

    ind.lastDetectionTimestamp = now;
    indicatorsRef.current = ind;
    setIndicators({ ...ind });

    // Compute score & update levels
    const evaluated = computeFatigueScore(ind);
    const prevLevel = currentLevelRef.current;

    if (evaluated.level !== prevLevel) {
      currentLevelRef.current = evaluated.level;
      const durationSec = alertStartTimeRef.current ? Math.round((now - alertStartTimeRef.current) / 1000) : 0;
      alertStartTimeRef.current = now;

      // Trigger progressive haptics
      if (evaluated.level > 0) {
        triggerHapticsForLevel(evaluated.level);
      }

      // Persist safety event to Supabase
      if (employeeId && tripId) {
        eventCounterRef.current += 1;
        logFatigueEvent(
          String(employeeId),
          String(tripId),
          evaluated.level,
          evaluated,
          durationSec
        );
      }
    }

    setMonitorState({
      isActive: true,
      fatigueLevel: evaluated.level,
      fatigueScore: evaluated.score,
      dominantSignal: evaluated.dominantSignal,
      faceDetected: frame.faceDetected,
      cameraObstructed: false,
      currentAlertStartedAt: alertStartTimeRef.current,
      eventCount: eventCounterRef.current,
    });
  }, [computeFatigueScore, employeeId, tripId, triggerHapticsForLevel]);

  // ─────────────────────────────────────────────
  // SIMULATION CONTROLS FOR TESTING
  // Allows testing on real devices without MLKit camera setup
  // ─────────────────────────────────────────────
  const simulateSignal = useCallback((signal: 'eye_closure' | 'yawn' | 'head_drop' | 'reset' | 'level_1' | 'level_2' | 'level_3') => {
    const now = Date.now();
    const ind = { ...indicatorsRef.current };

    if (signal === 'eye_closure') {
      ind.eyeClosureDurationMs = 2000;
    } else if (signal === 'yawn') {
      ind.yawnCountLast5Min += 1;
    } else if (signal === 'head_drop') {
      ind.headDropDegrees = 25;
    } else if (signal === 'level_1') {
      ind.eyeClosureDurationMs = 1600;
    } else if (signal === 'level_2') {
      ind.eyeClosureDurationMs = 3200;
      ind.yawnCountLast5Min = 2;
    } else if (signal === 'level_3') {
      ind.eyeClosureDurationMs = 4000;
      ind.yawnCountLast5Min = 4;
      ind.headDropDegrees = 30;
    } else if (signal === 'reset') {
      ind.eyeClosureDurationMs = 0;
      ind.yawnCountLast5Min = 0;
      ind.headDropDegrees = 0;
      ind.faceAbsentDurationMs = 0;
    }

    indicatorsRef.current = ind;
    setIndicators({ ...ind });

    const evaluated = computeFatigueScore(ind);
    currentLevelRef.current = evaluated.level;

    if (evaluated.level > 0) {
      triggerHapticsForLevel(evaluated.level);
    }

    if (employeeId && tripId && signal !== 'reset') {
      eventCounterRef.current += 1;
      logFatigueEvent(
        String(employeeId),
        String(tripId),
        evaluated.level,
        evaluated,
        3
      );
    }

    setMonitorState(prev => ({
      ...prev,
      fatigueLevel: evaluated.level,
      fatigueScore: evaluated.score,
      dominantSignal: evaluated.dominantSignal,
      faceDetected: true,
      eventCount: eventCounterRef.current,
    }));
  }, [computeFatigueScore, employeeId, tripId, triggerHapticsForLevel]);

  // ─────────────────────────────────────────────
  // TRIP LIFECYCLE: START & END LOGGING
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !tripId || !employeeId) return;

    tripStartTimeRef.current = Date.now();
    currentLevelRef.current = 0;
    eventCounterRef.current = 0;
    logMonitoringStarted(String(employeeId), String(tripId));

    setMonitorState(prev => ({
      ...prev,
      isActive: true,
      fatigueLevel: 0,
      fatigueScore: 0,
      dominantSignal: 'none',
      faceDetected: true,
    }));

    return () => {
      const tripDurationSec = Math.round((Date.now() - tripStartTimeRef.current) / 1000);
      logMonitoringEnded(
        String(employeeId),
        String(tripId),
        tripDurationSec,
        eventCounterRef.current
      );
      setMonitorState(DEFAULT_MONITOR_STATE);
    };
  }, [isActive, tripId, employeeId]);

  return {
    monitorState,
    indicators,
    processFrame,
    simulateSignal,
  };
}
