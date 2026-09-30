import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Wrench, Camera, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface VehicleDefectReportModalProps {
  visible: boolean;
  onClose: () => void;
  vehicleId?: number | string | null;
  tripId?: number | string | null;
  onSubmitted?: () => void;
}

const DEFECT_CATEGORIES = [
  'Brakes & Steering',
  'Tires & Wheels',
  'Engine & Transmission',
  'Electrical & Lights',
  'Cooling & Fluid Leaks',
  'Body & Exterior',
  'Other Defect',
];

export function VehicleDefectReportModal({
  visible,
  onClose,
  vehicleId,
  tripId,
  onSubmitted,
}: VehicleDefectReportModalProps) {
  const { employee } = useAuth();
  const [category, setCategory] = useState('Brakes & Steering');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'critical'>('moderate');
  const [description, setDescription] = useState('');
  const [odometer, setOdometer] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickDamagePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the mechanical defect or observation.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        driver_id: employee?.id || null,
        vehicle_id: vehicleId ? Number(vehicleId) : null,
        trip_id: tripId ? Number(tripId) : null,
        incident_type: 'breakdown',
        severity: severity === 'critical' ? 'critical' : 'moderate',
        description: `[DEFECT: ${category.toUpperCase()}] ${description.trim()}${odometer ? ` | Odometer: ${odometer}km` : ''}`,
        photos: photoUri ? [photoUri] : [],
        status: 'reported',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('incident_reports').insert([payload]);
      if (error) throw error;

      // If critical severity, mark vehicle under maintenance
      if (severity === 'critical' && vehicleId) {
        await supabase
          .from('vehicles')
          .update({ status: 'maintenance' })
          .eq('id', Number(vehicleId));
      }

      Alert.alert(
        severity === 'critical' ? '🚨 CRITICAL TICKET LOGGED' : 'Maintenance Ticket Sent',
        severity === 'critical'
          ? 'Fleet maintenance team alerted. Vehicle has been set to MAINTENANCE status for safety.'
          : 'Your vehicle defect report has been sent to the maintenance dispatcher.'
      );

      setDescription('');
      setOdometer('');
      setPhotoUri(null);
      setSeverity('moderate');
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to submit report: ' + (err?.message || 'Network error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Wrench size={20} color="#b91c1c" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.title}>Report Vehicle Defect</Text>
              <Text style={styles.subtitle}>Fleet Maintenance & Safety Request</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
            {/* Severity Selector */}
            <Text style={styles.label}>Defect Severity Level</Text>
            <View style={styles.severityRow}>
              {[
                { key: 'minor', label: 'Minor', color: '#16a34a', bg: '#dcfce7' },
                { key: 'moderate', label: 'Moderate', color: '#d97706', bg: '#fef3c7' },
                { key: 'critical', label: 'Critical / Grounded', color: '#dc2626', bg: '#fee2e2' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.severityChip,
                    severity === s.key && { backgroundColor: s.bg, borderColor: s.color, borderWidth: 2 },
                  ]}
                  onPress={() => setSeverity(s.key as any)}
                >
                  <Text style={[styles.severityText, { color: s.color }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category Selector */}
            <Text style={[styles.label, { marginTop: 14 }]}>Defect Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {DEFECT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Description */}
            <Text style={[styles.label, { marginTop: 14 }]}>Defect Description *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the issue, abnormal sound, leak, or mechanical fault..."
              multiline
              value={description}
              onChangeText={setDescription}
            />

            {/* Current Odometer */}
            <Text style={[styles.label, { marginTop: 14 }]}>Current Odometer (km)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 48350"
              keyboardType="numeric"
              value={odometer}
              onChangeText={setOdometer}
            />

            {/* Photo Attachment */}
            <Text style={[styles.label, { marginTop: 14 }]}>Defect Photo Proof</Text>
            <TouchableOpacity style={styles.photoBtn} onPress={pickDamagePhoto}>
              <Camera size={18} color="#1e40af" />
              <Text style={styles.photoBtnText}>
                {photoUri ? 'Change Photo Attached ✓' : 'Snap / Attach Defect Photo'}
              </Text>
            </TouchableOpacity>
            {photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} />}
          </ScrollView>

          {/* Footer Submit */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <ShieldAlert size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Maintenance Ticket</Text>
                </>
              )}
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
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
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
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  catScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#1e40af',
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  catTextActive: {
    color: '#fff',
  },
  textArea: {
    height: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  textInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  photoPreview: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    marginTop: 8,
    resizeMode: 'cover',
  },
  footer: {
    marginTop: 16,
  },
  submitBtn: {
    backgroundColor: '#b91c1c',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
