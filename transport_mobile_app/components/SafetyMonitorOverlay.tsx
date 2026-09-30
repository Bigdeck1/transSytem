/**
 * HERMES Driver Safety Monitor — Floating HUD Overlay
 *
 * Designed specifically for safety during active driving:
 * - Minimal, non-distracting presence during normal driving (Level 0)
 * - Automatic progressive visual banners (Level 1 Caution, Level 2 Drowsy, Level 3 Critical)
 * - Zero mandatory touch interactions while vehicle is moving
 * - Includes a developer/driver test bench to simulate events and verify Supabase logging
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Eye,
  RotateCcw,
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import {
  FatigueLevel,
  FATIGUE_LEVEL_LABELS,
  FATIGUE_LEVEL_COLORS,
} from '../types/safety';

interface SafetyMonitorOverlayProps {
  driverName?: string;
  tripNumber?: string;
  fatigueLevel: FatigueLevel;
  fatigueScore: number;
  dominantSignal: string;
  eventCount: number;
  onSimulate?: (signal: 'eye_closure' | 'yawn' | 'head_drop' | 'reset' | 'level_1' | 'level_2' | 'level_3') => void;
}

export function SafetyMonitorOverlay({
  driverName = 'Driver',
  tripNumber = 'ACTIVE-TRIP',
  fatigueLevel,
  fatigueScore,
  dominantSignal,
  eventCount,
  onSimulate,
}: SafetyMonitorOverlayProps) {
  const [showTestBench, setShowTestBench] = useState(false);

  // Background and border styling based on progressive level
  const levelColor = FATIGUE_LEVEL_COLORS[fatigueLevel] || '#22c55e';

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP FLOATING HUD PILL
          ───────────────────────────────────────────────────────────── */}
      <View style={[styles.hudPill, { borderColor: levelColor }]}>
        <View style={styles.hudLeft}>
          <View style={[styles.statusDot, { backgroundColor: levelColor }]} />
          <View>
            <View style={styles.row}>
              <Eye size={13} color={levelColor} style={{ marginRight: 4 }} />
              <Text style={styles.hudTitle}>
                {fatigueLevel === 0 ? 'HERMES SAFETY MONITOR' : FATIGUE_LEVEL_LABELS[fatigueLevel].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.hudSubtitle}>
              {driverName} • Trip #{tripNumber}
            </Text>
          </View>
        </View>

        <View style={styles.hudRight}>
          <View style={[styles.scoreBadge, { backgroundColor: levelColor }]}>
            <Text style={styles.scoreText}>{fatigueScore}</Text>
          </View>
          <TouchableOpacity
            style={styles.testBenchToggle}
            onPress={() => setShowTestBench(prev => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showTestBench ? (
              <ChevronUp size={16} color="#94a3b8" />
            ) : (
              <Sliders size={16} color="#94a3b8" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. PROGRESSIVE WARNING BANNERS (Level 1, 2, 3)
          Automatic alerts — no driver interaction required
          ───────────────────────────────────────────────────────────── */}
      {fatigueLevel === 1 && (
        <View style={[styles.alertBanner, styles.bannerLevel1]}>
          <AlertTriangle size={24} color="#f59e0b" style={styles.bannerIcon} />
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>⚠️ PLEASE STAY ALERT</Text>
            <Text style={styles.bannerDesc}>
              Signs of early fatigue detected ({dominantSignal.replace('_', ' ')}). Ensure fresh air in the cabin.
            </Text>
          </View>
        </View>
      )}

      {fatigueLevel === 2 && (
        <View style={[styles.alertBanner, styles.bannerLevel2]}>
          <ShieldAlert size={28} color="#f97316" style={styles.bannerIcon} />
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>🚨 DROWSINESS DETECTED</Text>
            <Text style={styles.bannerDesc}>
              Prolonged signs of fatigue observed. Please safely pull over and take a short rest break.
            </Text>
          </View>
        </View>
      )}

      {fatigueLevel === 3 && (
        <View style={[styles.alertBanner, styles.bannerLevel3]}>
          <ShieldAlert size={32} color="#ffffff" style={styles.bannerIcon} />
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerTitle, { color: '#ffffff' }]}>
              🛑 CRITICAL SAFETY ALERT
            </Text>
            <Text style={[styles.bannerDesc, { color: '#fef2f2' }]}>
              High risk of falling asleep! Pull vehicle over to a safe area immediately. Dispatch has been notified.
            </Text>
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. DEVELOPER / TEST SIMULATION BENCH
          Allows instant evaluation on devices & Supabase event checks
          ───────────────────────────────────────────────────────────── */}
      {showTestBench && (
        <View style={styles.testBenchCard}>
          <View style={styles.testBenchHeader}>
            <View style={styles.row}>
              <Zap size={15} color="#3b82f6" style={{ marginRight: 6 }} />
              <Text style={styles.testBenchTitle}>Safety Test Bench (Dev Mode)</Text>
            </View>
            <Text style={styles.eventCountText}>{eventCount} events logged</Text>
          </View>

          <Text style={styles.testBenchHint}>
            Simulate signals locally to trigger haptics and verify Supabase safety_events logging:
          </Text>

          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#f1f5f9' }]}
              onPress={() => onSimulate?.('eye_closure')}
            >
              <Text style={styles.simButtonText}>👁 Eyes Closed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#f1f5f9' }]}
              onPress={() => onSimulate?.('yawn')}
            >
              <Text style={styles.simButtonText}>🥱 Yawn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#f1f5f9' }]}
              onPress={() => onSimulate?.('head_drop')}
            >
              <Text style={styles.simButtonText}>🙇 Head Drop</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#fef3c7' }]}
              onPress={() => onSimulate?.('level_1')}
            >
              <Text style={[styles.simButtonText, { color: '#b45309' }]}>🟡 Level 1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#ffedd5' }]}
              onPress={() => onSimulate?.('level_2')}
            >
              <Text style={[styles.simButtonText, { color: '#c2410c' }]}>🟠 Level 2</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#fee2e2' }]}
              onPress={() => onSimulate?.('level_3')}
            >
              <Text style={[styles.simButtonText, { color: '#b91c1c' }]}>🔴 Level 3</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => onSimulate?.('reset')}
          >
            <RotateCcw size={14} color="#64748b" style={{ marginRight: 6 }} />
            <Text style={styles.resetButtonText}>Reset to Normal (Score: 0)</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 10,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  hudTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hudSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  scoreText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  testBenchToggle: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },

  // Alert Banners
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  bannerLevel1: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  bannerLevel2: {
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#f97316',
  },
  bannerLevel3: {
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#b91c1c',
  },
  bannerIcon: {
    marginRight: 12,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 2,
  },
  bannerDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },

  // Test Bench Card
  testBenchCard: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  testBenchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  testBenchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  eventCountText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  testBenchHint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 15,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  simButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: '31%',
    flexGrow: 1,
  },
  simButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
});
