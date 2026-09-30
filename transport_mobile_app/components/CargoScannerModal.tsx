import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, QrCode, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface CargoScannerModalProps {
  visible: boolean;
  onClose: () => void;
  expectedTrackingCode?: string;
  expectedTripNumber?: string;
  onVerified: (scannedCode: string) => void;
}

export function CargoScannerModal({
  visible,
  onClose,
  expectedTrackingCode,
  expectedTripNumber,
  onVerified,
}: CargoScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isMatch, setIsMatch] = useState<boolean | null>(null);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setScannedResult(null);
      setIsMatch(null);
      setManualCode('');
      if (!permission?.granted) {
        requestPermission();
      }
    }
  }, [visible, permission?.granted]);

  const verifyCode = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    const expTrack = (expectedTrackingCode || '').trim().toUpperCase();
    const expTrip = (expectedTripNumber || '').trim().toUpperCase();

    const matches = (expTrack && trimmed === expTrack) || (expTrip && trimmed === expTrip) || trimmed.startsWith('TRK-');

    setScanned(true);
    setScannedResult(trimmed);
    setIsMatch(matches);

    if (matches) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    verifyCode(data);
  };

  const handleConfirmVerified = () => {
    if (scannedResult) {
      onVerified(scannedResult);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrapper}>
              <QrCode size={20} color="#1e40af" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.title}>Cargo Barcode / QR Scanner</Text>
              <Text style={styles.subtitle}>
                Expected: {expectedTrackingCode || expectedTripNumber || 'Any Package QR'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Camera Viewfinder */}
          {permission?.granted && Platform.OS !== 'web' ? (
            <View style={styles.cameraWrapper}>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'upc_a'],
                }}
              >
                <View style={styles.scannerTarget}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
              </CameraView>
            </View>
          ) : (
            <View style={styles.permissionPlaceholder}>
              <QrCode size={48} color="#94a3b8" />
              <Text style={styles.permissionText}>
                {permission?.granted
                  ? 'Camera scanning active'
                  : 'Camera permission required for QR barcode scanning.'}
              </Text>
              {!permission?.granted && (
                <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                  <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Verification Result Banner */}
          {scanned && (
            <View
              style={[
                styles.resultBanner,
                { backgroundColor: isMatch ? '#dcfce7' : '#fee2e2', borderColor: isMatch ? '#86efac' : '#fca5a5' },
              ]}
            >
              {isMatch ? (
                <CheckCircle2 size={22} color="#15803d" />
              ) : (
                <AlertCircle size={22} color="#b91c1c" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultTitle, { color: isMatch ? '#15803d' : '#b91c1c' }]}>
                  {isMatch ? 'Cargo Verified Match ✓' : 'Code Mismatch Warning'}
                </Text>
                <Text style={[styles.resultSub, { color: isMatch ? '#166534' : '#991b1b' }]}>
                  Scanned: {scannedResult}
                </Text>
              </View>
              <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
                <RefreshCw size={16} color="#475569" />
              </TouchableOpacity>
            </View>
          )}

          {/* Manual Code Input Fallback */}
          <View style={styles.manualSection}>
            <Text style={styles.manualLabel}>Manual Code Entry</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="e.g. TRK-A1B2C3D4"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.manualVerifyBtn}
                onPress={() => {
                  if (manualCode.trim()) verifyCode(manualCode);
                }}
              >
                <Text style={styles.manualVerifyText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, (!scanned || !isMatch) && styles.confirmBtnDisabled]}
              disabled={!scanned || !isMatch}
              onPress={handleConfirmVerified}
            >
              <CheckCircle2 size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>Accept & Verify Cargo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraWrapper: {
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerTarget: {
    width: 150,
    height: 150,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#38bdf8',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  permissionPlaceholder: {
    height: 180,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 20,
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  grantBtn: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 6,
  },
  grantBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  resultSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  rescanBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualSection: {
    marginBottom: 16,
  },
  manualLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  manualVerifyBtn: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualVerifyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  footer: {
    gap: 10,
  },
  confirmBtn: {
    backgroundColor: '#16a34a',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
