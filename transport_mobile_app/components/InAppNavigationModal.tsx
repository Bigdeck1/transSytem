import React from 'react';
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
import { X, Navigation, Fuel, PenTool, QrCode, ShieldAlert, ExternalLink, MapPin } from 'lucide-react-native';

interface InAppNavigationModalProps {
  visible: boolean;
  onClose: () => void;
  trip: any;
  driverLocation?: { latitude: number; longitude: number; speed?: number };
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
  onOpenEpod,
  onOpenScanner,
  onOpenExpense,
  onTriggerSos,
}: InAppNavigationModalProps) {
  if (!trip) return null;

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
            <View style={styles.pulseDot} />
            <View>
              <Text style={styles.hudTitle}>Live In-App Navigation</Text>
              <Text style={styles.hudSub}>Order #{trip.trip_number}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
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
            <TouchableOpacity style={styles.extNavBtn} onPress={handleExternalMaps}>
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
});
