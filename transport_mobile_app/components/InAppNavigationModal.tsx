import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  X,
  Navigation,
  Fuel,
  PenTool,
  QrCode,
  ShieldAlert,
  ExternalLink,
  MapPin,
  Camera,
  Eye,
  Minimize2,
  Maximize2,
  Sliders,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react-native';
import {
  FatigueLevel,
  FATIGUE_LEVEL_LABELS,
  FATIGUE_LEVEL_COLORS,
} from '../types/safety';

interface InAppNavigationModalProps {
  visible: boolean;
  onClose: () => void;
  trip: any;
  driverLocation?: { latitude: number; longitude: number; speed?: number };
  driverName?: string;
  fatigueLevel?: FatigueLevel;
  fatigueScore?: number;
  dominantSignal?: string;
  eventCount?: number;
  onSimulate?: (signal: 'eye_closure' | 'yawn' | 'head_drop' | 'reset' | 'level_1' | 'level_2' | 'level_3') => void;
  onOpenEpod?: () => void;
  onOpenScanner?: () => void;
  onOpenExpense?: () => void;
  onTriggerSos?: () => void;
}

export function InAppNavigationModal({
  visible,
  onClose,
  trip,
  driverLocation,
  driverName = 'Driver',
  fatigueLevel = 0,
  fatigueScore = 0,
  dominantSignal = 'none',
  eventCount = 0,
  onSimulate,
  onOpenEpod,
  onOpenScanner,
  onOpenExpense,
  onTriggerSos,
}: InAppNavigationModalProps) {
  if (!trip) return null;

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);
  const [showTestBench, setShowTestBench] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission?.granted]);

  const levelColor = FATIGUE_LEVEL_COLORS[fatigueLevel] || '#22c55e';

  const hqLat = 14.546827;
  const hqLng = 121.229383;
  const driverLat = driverLocation?.latitude || hqLat;
  const driverLng = driverLocation?.longitude || hqLng;
  const speed = driverLocation?.speed || 38;

  const pickup = trip.pickup_location || 'Pickup Point';
  const delivery = trip.delivery_location || 'Delivery Destination';
  const distanceEst = trip.leg2_distance_km ? `${trip.leg2_distance_km} km` : '~32 km';
  const durationEst = trip.leg2_duration_mins ? `${trip.leg2_duration_mins} mins` : '~45 mins';

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, sans-serif; }
        .truck-icon {
          background: #1e40af;
          color: white;
          border-radius: 50%;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(30,64,175,0.6);
          border: 2px solid white;
        }
        .hq-icon {
          background: #0f172a;
          color: white;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border: 2px solid white;
        }
        .dest-icon {
          background: #16a34a;
          color: white;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border: 2px solid white;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false }).setView([${driverLat}, ${driverLng}], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(map);

        // HQ Marker
        const hqIcon = L.divIcon({ className: 'custom-hq', html: '<div class="hq-icon">🏢</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
        L.marker([${hqLat}, ${hqLng}], { icon: hqIcon }).addTo(map).bindPopup('<strong>HQ Depot</strong><br>Morong, Rizal');

        // Driver Truck Marker
        const truckIcon = L.divIcon({ className: 'custom-truck', html: '<div class="truck-icon">🚚</div>', iconSize: [38, 38], iconAnchor: [19, 19] });
        const truckMarker = L.marker([${driverLat}, ${driverLng}], { icon: truckIcon }).addTo(map).bindPopup('<strong>Current Position</strong><br>Speed: ${speed} km/h');

        // Approximate route polyline
        const routeCoords = [
          [${hqLat}, ${hqLng}],
          [${driverLat}, ${driverLng}],
          [${driverLat + 0.04}, ${driverLng - 0.05}],
          [${driverLat + 0.08}, ${driverLng - 0.09}]
        ];
        L.polyline(routeCoords, { color: '#2563eb', weight: 5, opacity: 0.8, dashArray: '8, 8' }).addTo(map);

        // Destination Marker
        const destIcon = L.divIcon({ className: 'custom-dest', html: '<div class="dest-icon">🎯</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
        L.marker(routeCoords[routeCoords.length - 1], { icon: destIcon }).addTo(map).bindPopup('<strong>Destination</strong><br>${delivery}');

        map.fitBounds(L.latLngBounds(routeCoords), { padding: [40, 40] });
      </script>
    </body>
    </html>
  `;

  const handleExternalMaps = () => {
    const encoded = encodeURIComponent(delivery);
    const url = Platform.select({
      android: `google.navigation:q=${encoded}`,
      ios: `http://maps.apple.com/?daddr=${encoded}&dirflg=d`,
    }) || `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Top HUD Bar */}
        <View style={styles.topHud}>
          <View style={styles.hudLeft}>
            <View style={[styles.pulseDot, { backgroundColor: levelColor }]} />
            <View>
              <Text style={styles.hudTitle}>Live In-App Navigation</Text>
              <Text style={styles.hudSub}>
                Order #{trip.trip_number} • {driverName}
              </Text>
            </View>
          </View>
          <View style={styles.hudRightActions}>
            <TouchableOpacity
              onPress={() => setShowTestBench(prev => !prev)}
              style={styles.testBenchIconBtn}
            >
              <Sliders size={18} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Map View */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={mapHtml}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Live Navigation"
            />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
            />
          )}

          {/* Speedometer & Metric HUD Overlay */}
          <View style={styles.metricsOverlay}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{speed}</Text>
              <Text style={styles.metricUnit}>KM/H</Text>
            </View>
            <View style={styles.routeMetricCard}>
              <Text style={styles.routeMetricLabel}>REMAINING</Text>
              <Text style={styles.routeMetricValue}>{distanceEst}</Text>
              <Text style={styles.routeMetricSub}>ETA: ~{durationEst}</Text>
            </View>
          </View>

          {/* ─────────────────────────────────────────────────────────────
              DRIVER SAFETY FRONT CAMERA PiP (Picture-in-Picture)
              Runs simultaneously with the in-app map without closing HERMES
              ───────────────────────────────────────────────────────────── */}
          <View style={[styles.cameraPipContainer, isCameraMinimized && styles.cameraPipMinimized]}>
            <View style={styles.cameraHeader}>
              <View style={styles.cameraTitleRow}>
                <View style={[styles.camLiveDot, { backgroundColor: levelColor }]} />
                <Eye size={12} color={levelColor} />
                <Text style={styles.cameraTitleText}>
                  {isCameraMinimized ? 'AI MONITOR' : 'DRIVER SAFETY CAM'}
                </Text>
              </View>
              <View style={styles.cameraActionsRow}>
                <View style={[styles.pipScoreBadge, { backgroundColor: levelColor }]}>
                  <Text style={styles.pipScoreText}>{fatigueScore}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsCameraMinimized(prev => !prev)}
                  style={styles.minimizeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isCameraMinimized ? (
                    <Maximize2 size={13} color="#cbd5e1" />
                  ) : (
                    <Minimize2 size={13} color="#cbd5e1" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {!isCameraMinimized && (
              <View style={styles.cameraFrame}>
                {permission?.granted ? (
                  <CameraView
                    style={styles.cameraView}
                    facing="front"
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.camPermPrompt}
                    onPress={requestPermission}
                  >
                    <Camera size={22} color="#94a3b8" />
                    <Text style={styles.camPermText}>Tap to Enable Front Camera</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.camStatusOverlay}>
                  <Text style={[styles.camStatusText, { color: levelColor }]}>
                    {FATIGUE_LEVEL_LABELS[fatigueLevel]}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ─────────────────────────────────────────────────────────────
              PROGRESSIVE DROWSINESS / FATIGUE ALERTS ON THE MAP
              ───────────────────────────────────────────────────────────── */}
          {fatigueLevel === 1 && (
            <View style={[styles.mapAlertBanner, styles.mapBannerLevel1]}>
              <AlertTriangle size={24} color="#f59e0b" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapBannerTitle}>⚠️ PLEASE STAY ALERT</Text>
                <Text style={styles.mapBannerDesc}>
                  Early signs of driver fatigue detected ({dominantSignal.replace('_', ' ')}).
                </Text>
              </View>
            </View>
          )}

          {fatigueLevel === 2 && (
            <View style={[styles.mapAlertBanner, styles.mapBannerLevel2]}>
              <ShieldAlert size={28} color="#f97316" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapBannerTitle}>🚨 DROWSINESS DETECTED</Text>
                <Text style={styles.mapBannerDesc}>
                  Eyes closing / yawning detected! Please safely pull over and take a short break.
                </Text>
              </View>
            </View>
          )}

          {fatigueLevel === 3 && (
            <View style={[styles.mapAlertBanner, styles.mapBannerLevel3]}>
              <ShieldAlert size={32} color="#ffffff" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.mapBannerTitle, { color: '#ffffff' }]}>
                  🛑 CRITICAL SAFETY ALERT
                </Text>
                <Text style={[styles.mapBannerDesc, { color: '#fee2e2' }]}>
                  Severe fatigue! Pull over immediately in a safe spot. Dispatch notified.
                </Text>
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              DEV TEST BENCH ON NAVIGATION SCREEN
              ───────────────────────────────────────────────────────────── */}
          {showTestBench && (
            <View style={styles.testBenchNavCard}>
              <View style={styles.testBenchNavHeader}>
                <Text style={styles.testBenchNavTitle}>🧪 Fatigue Test Bench (In-App Map)</Text>
                <TouchableOpacity onPress={() => setShowTestBench(false)}>
                  <X size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={styles.testBtnGrid}>
                <TouchableOpacity
                  style={[styles.simNavBtn, { backgroundColor: '#f1f5f9' }]}
                  onPress={() => onSimulate?.('eye_closure')}
                >
                  <Text style={styles.simNavText}>👁 Eyes Closed</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simNavBtn, { backgroundColor: '#f1f5f9' }]}
                  onPress={() => onSimulate?.('yawn')}
                >
                  <Text style={styles.simNavText}>🥱 Yawn</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simNavBtn, { backgroundColor: '#fef3c7' }]}
                  onPress={() => onSimulate?.('level_1')}
                >
                  <Text style={[styles.simNavText, { color: '#b45309' }]}>🟡 Level 1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simNavBtn, { backgroundColor: '#ffedd5' }]}
                  onPress={() => onSimulate?.('level_2')}
                >
                  <Text style={[styles.simNavText, { color: '#c2410c' }]}>🟠 Level 2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simNavBtn, { backgroundColor: '#fee2e2' }]}
                  onPress={() => onSimulate?.('level_3')}
                >
                  <Text style={[styles.simNavText, { color: '#b91c1c' }]}>🔴 Level 3</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simNavBtn, { backgroundColor: '#e2e8f0' }]}
                  onPress={() => onSimulate?.('reset')}
                >
                  <Text style={styles.simNavText}>↺ Normal (0)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Floating Quick Action Bar */}
        <View style={styles.floatingControls}>
          <View style={styles.stopCard}>
            <MapPin size={16} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.stopLabel}>NEXT DESTINATION</Text>
              <Text style={styles.stopAddress} numberOfLines={1}>
                {delivery}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.extNavBtn}
              onPress={handleExternalMaps}
              accessibilityLabel="Open in external Google Maps if needed"
            >
              <ExternalLink size={16} color="#2563eb" />
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            {onOpenScanner && (
              <TouchableOpacity style={[styles.miniBtn, { backgroundColor: '#1e40af' }]} onPress={onOpenScanner}>
                <QrCode size={18} color="#fff" />
                <Text style={styles.miniBtnText}>Scan QR</Text>
              </TouchableOpacity>
            )}

            {onOpenEpod && (
              <TouchableOpacity style={[styles.miniBtn, { backgroundColor: '#16a34a' }]} onPress={onOpenEpod}>
                <PenTool size={18} color="#fff" />
                <Text style={styles.miniBtnText}>Sign e-POD</Text>
              </TouchableOpacity>
            )}

            {onOpenExpense && (
              <TouchableOpacity style={[styles.miniBtn, { backgroundColor: '#0284c7' }]} onPress={onOpenExpense}>
                <Fuel size={18} color="#fff" />
                <Text style={styles.miniBtnText}>Expense</Text>
              </TouchableOpacity>
            )}

            {onTriggerSos && (
              <TouchableOpacity style={[styles.miniBtn, { backgroundColor: '#dc2626' }]} onPress={onTriggerSos}>
                <ShieldAlert size={18} color="#fff" />
                <Text style={styles.miniBtnText}>SOS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  hudTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  hudSub: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  metricsOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#38bdf8',
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },
  routeMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  routeMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  routeMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  routeMetricSub: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: '600',
    marginTop: 2,
  },
  floatingControls: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    gap: 12,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  stopAddress: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  extNavBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  miniBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  hudRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  testBenchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Camera PiP ──
  cameraPipContainer: {
    position: 'absolute',
    top: 76,
    right: 14,
    width: 140,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  cameraPipMinimized: {
    width: 130,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
  },
  cameraTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  camLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cameraTitleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  cameraActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pipScoreBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  pipScoreText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  minimizeBtn: {
    padding: 2,
  },
  cameraFrame: {
    width: '100%',
    height: 100,
    backgroundColor: '#020617',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraView: {
    width: '100%',
    height: '100%',
  },
  camPermPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  camPermText: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  camStatusOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  camStatusText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Progressive Map Alerts ──
  mapAlertBanner: {
    position: 'absolute',
    top: 76,
    left: 14,
    right: 160,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 99,
  },
  mapBannerLevel1: {
    backgroundColor: '#fffbeb',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  mapBannerLevel2: {
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#f97316',
  },
  mapBannerLevel3: {
    backgroundColor: '#dc2626',
    borderWidth: 2.5,
    borderColor: '#b91c1c',
  },
  mapBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  mapBannerDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 14,
  },

  // ── Test Bench ──
  testBenchNavCard: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 110,
  },
  testBenchNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testBenchNavTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  testBtnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  simNavBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    minWidth: '30%',
    flexGrow: 1,
    alignItems: 'center',
  },
  simNavText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
});
