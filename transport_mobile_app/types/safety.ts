/**
 * HERMES Driver Safety Monitor — Type Definitions
 * 
 * Shared TypeScript types for the drowsiness detection and safety event
 * logging subsystem. No camera video is stored — only derived safety events.
 */

// ─────────────────────────────────────────────
// FATIGUE LEVELS
// ─────────────────────────────────────────────

/** 0 = Normal, 1 = Caution, 2 = Warning, 3 = Critical */
export type FatigueLevel = 0 | 1 | 2 | 3;

export const FATIGUE_LEVEL_LABELS: Record<FatigueLevel, string> = {
  0: 'Normal',
  1: 'Possible Fatigue',
  2: 'Drowsiness Detected',
  3: 'Critical — Stop Safely',
};

export const FATIGUE_LEVEL_COLORS: Record<FatigueLevel, string> = {
  0: '#22c55e',   // green
  1: '#f59e0b',   // amber
  2: '#f97316',   // orange
  3: '#ef4444',   // red
};

// ─────────────────────────────────────────────
// FACE DETECTION FRAME DATA
// Raw output from the VisionCamera face detector per frame
// ─────────────────────────────────────────────

export interface FaceFrameData {
  /** Whether a face was detected in this frame */
  faceDetected: boolean;
  /** Left eye openness: 0.0 (fully closed) – 1.0 (fully open) */
  leftEyeOpenProbability: number | null;
  /** Right eye openness: 0.0 (fully closed) – 1.0 (fully open) */
  rightEyeOpenProbability: number | null;
  /** Whether a smile/mouth open was detected (yawn proxy) */
  smilingProbability: number | null;
  /** Head rotation around X axis (nodding forward/back), degrees */
  headEulerAngleX: number | null;
  /** Head rotation around Y axis (turning left/right), degrees */
  headEulerAngleY: number | null;
  /** Head rotation around Z axis (tilting side to side), degrees */
  headEulerAngleZ: number | null;
  /** Timestamp of this frame in ms since epoch */
  timestamp: number;
}

// ─────────────────────────────────────────────
// FATIGUE INDICATORS
// Rolling-window aggregate state computed from frames
// ─────────────────────────────────────────────

export interface FatigueIndicators {
  /** Continuous duration (ms) that eyes have been measurably closed */
  eyeClosureDurationMs: number;
  /** Blink events counted in the last 60 seconds */
  blinkCountLastMinute: number;
  /** Yawn events (mouth open > threshold) in rolling 5-minute window */
  yawnCountLast5Min: number;
  /** Current head drop angle in degrees (positive = forward tilt) */
  headDropDegrees: number;
  /** Continuous duration (ms) that no face has been detected */
  faceAbsentDurationMs: number;
  /** Whether the camera appears to be physically obstructed */
  cameraObstructed: boolean;
  /** Whether lighting appears too poor for reliable detection */
  poorLighting: boolean;
  /** Timestamp of last detection (for timeouts) */
  lastDetectionTimestamp: number;
}

export const DEFAULT_FATIGUE_INDICATORS: FatigueIndicators = {
  eyeClosureDurationMs: 0,
  blinkCountLastMinute: 0,
  yawnCountLast5Min: 0,
  headDropDegrees: 0,
  faceAbsentDurationMs: 0,
  cameraObstructed: false,
  poorLighting: false,
  lastDetectionTimestamp: 0,
};

// ─────────────────────────────────────────────
// FATIGUE SCORE
// Computed from indicators; drives the alert level
// ─────────────────────────────────────────────

export interface FatigueScore {
  /** Raw score 0–100 */
  score: number;
  /** Derived alert level */
  level: FatigueLevel;
  /** Which signal contributed most to the score */
  dominantSignal: 'eye_closure' | 'yawning' | 'head_drop' | 'face_absent' | 'none';
  /** Human-readable explanation for logging/debugging */
  reasoning: string;
}

// ─────────────────────────────────────────────
// SCORING THRESHOLDS (tunable)
// ─────────────────────────────────────────────

export const SCORE_THRESHOLDS = {
  /** Eye openness probability below this = "closed" */
  EYE_CLOSED_THRESHOLD: 0.3,
  /** Eye closed for this many ms triggers Level 1 scoring */
  EYE_CLOSURE_WARNING_MS: 1500,
  /** Eye closed for this many ms triggers Level 2 scoring */
  EYE_CLOSURE_CRITICAL_MS: 3000,
  /** Head forward tilt beyond this angle (degrees) = head drop */
  HEAD_DROP_DEGREES: 20,
  /** Head turned beyond this angle = face turning away */
  HEAD_TURN_DEGREES: 45,
  /** Mouth open probability above this = possible yawn */
  YAWN_PROBABILITY_THRESHOLD: 0.7,
  /** Face absent for longer than this → face_absent event (not drowsy) */
  FACE_ABSENT_WARNING_MS: 5000,
  /** Score range → Level 1 */
  LEVEL_1_MIN: 31,
  /** Score range → Level 2 */
  LEVEL_2_MIN: 61,
  /** Score range → Level 3 */
  LEVEL_3_MIN: 81,
} as const;

// ─────────────────────────────────────────────
// SAFETY EVENTS (logged to Supabase)
// Only these structured events reach the server — never raw video
// ─────────────────────────────────────────────

export type SafetyEventType =
  | 'monitoring_started'
  | 'monitoring_ended'
  | 'pre_trip_check_passed'
  | 'pre_trip_check_failed'
  | 'drowsiness_level_1'
  | 'drowsiness_level_2'
  | 'drowsiness_level_3'
  | 'drowsiness_resolved'
  | 'face_absent'
  | 'face_returned'
  | 'camera_obstructed'
  | 'camera_cleared';

export type SafetyEventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SafetyEvent {
  employee_id: string;
  trip_id: string;
  event_type: SafetyEventType;
  severity: SafetyEventSeverity;
  fatigue_score: number;
  /** How many seconds the condition lasted before this event was logged */
  duration_seconds: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Optional extra context — never contains image/video data */
  metadata?: {
    dominant_signal?: string;
    reasoning?: string;
    score_breakdown?: Record<string, number>;
    alert_level?: FatigueLevel;
  };
}

/** Mapping from fatigue level to its primary event type */
export const FATIGUE_LEVEL_EVENT: Record<FatigueLevel, SafetyEventType> = {
  0: 'drowsiness_resolved',
  1: 'drowsiness_level_1',
  2: 'drowsiness_level_2',
  3: 'drowsiness_level_3',
};

/** Mapping from fatigue level to severity */
export const FATIGUE_LEVEL_SEVERITY: Record<FatigueLevel, SafetyEventSeverity> = {
  0: 'info',
  1: 'low',
  2: 'high',
  3: 'critical',
};

// ─────────────────────────────────────────────
// MONITOR STATE (used by the hook)
// ─────────────────────────────────────────────

export interface SafetyMonitorState {
  isActive: boolean;
  fatigueLevel: FatigueLevel;
  fatigueScore: number;
  dominantSignal: FatigueScore['dominantSignal'];
  faceDetected: boolean;
  cameraObstructed: boolean;
  /** Unix timestamp when the current alert level started */
  currentAlertStartedAt: number | null;
  /** Total safety events logged this trip */
  eventCount: number;
}

export const DEFAULT_MONITOR_STATE: SafetyMonitorState = {
  isActive: false,
  fatigueLevel: 0,
  fatigueScore: 0,
  dominantSignal: 'none',
  faceDetected: false,
  cameraObstructed: false,
  currentAlertStartedAt: null,
  eventCount: 0,
};

// ─────────────────────────────────────────────
// PRE-TRIP CHECK
// ─────────────────────────────────────────────

export type PreTripCheckResult = 'passed' | 'failed' | 'skipped';

export interface PreTripCheckState {
  status: 'idle' | 'running' | 'done';
  result: PreTripCheckResult | null;
  /** Frames with face detected during check */
  detectedFrames: number;
  /** Total frames captured during check */
  totalFrames: number;
  /** Whether eyes were consistently open */
  eyesOpenConsistently: boolean;
}
