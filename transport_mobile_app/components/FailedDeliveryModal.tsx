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
import { X, AlertCircle, Camera, RotateCcw, Home, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface FailedDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string | number;
  tripNumber?: string;
  onSuccess: () => void;
}

const FAILED_REASONS = [
  'Customer Not Home / Business Closed',
  'Incorrect Address / Unreachable Road',
  'Recipient Refused Delivery',
  'Payment / COD Discrepancy',
  'Contact Number Unreachable / No Answer',
  'Road Blockage / Flooding',
];

export function FailedDeliveryModal({
  visible,
  onClose,
  tripId,
  tripNumber,
  onSuccess,
}: FailedDeliveryModalProps) {
  const { employee } = useAuth();
  const [selectedReason, setSelectedReason] = useState(FAILED_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [actionChoice, setActionChoice] = useState<'reattempt' | 'rto'>('reattempt');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickProofPhoto = async () => {
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
    try {
      setSubmitting(true);

      const statusUpdate = actionChoice === 'rto' ? 'failed' : 'in-transit';
      const notesFormatted = `[FAILED ATTEMPT] Reason: ${selectedReason}. Notes: ${notes.trim() || 'N/A'}. Action: ${
        actionChoice === 'rto' ? 'Return to Morong HQ (RTO)' : 'Re-attempt later today'
      }`;

      const { error } = await supabase
        .from('trips')
        .update({
          status: statusUpdate,
          pod_notes: notesFormatted,
          pod_photo_url: photoUri || null,
        })
        .eq('id', tripId);

      if (error) throw error;

      // Also log into incident_reports for fleet dispatcher visibility
      await supabase.from('incident_reports').insert([
        {
          trip_id: Number(tripId),
          driver_id: employee?.id || null,
          incident_type: 'other',
          severity: 'minor',
          description: `Delivery attempt failed for order #${tripNumber || tripId}. ${notesFormatted}`,
          photos: photoUri ? [photoUri] : [],
          status: 'reported',
        },
      ]);

      Alert.alert(
        'Failed Attempt Recorded',
        actionChoice === 'rto'
          ? 'Package marked for Return-to-Origin (RTO). Please return cargo to Morong Depot at end of shift.'
          : 'Trip kept active. You can re-attempt delivery after completing remaining stops.'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to record failed delivery: ' + err.message);
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
              <AlertCircle size={20} color="#dc2626" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.title}>Log Failed Delivery</Text>
              <Text style={styles.subtitle}>Order #{tripNumber || tripId}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
            {/* Reason Selector */}
            <Text style={styles.label}>Reason for Non-Delivery *</Text>
            <View style={styles.reasonsList}>
              {FAILED_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonItem, selectedReason === r && styles.reasonItemActive]}
                  onPress={() => setSelectedReason(r)}
                >
                  <View style={[styles.radioCircle, selectedReason === r && styles.radioCircleActive]} />
                  <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Next Action */}
            <Text style={[styles.label, { marginTop: 16 }]}>Recommended Action</Text>
            <View style={styles.actionChoiceRow}>
              <TouchableOpacity
                style={[styles.choiceCard, actionChoice === 'reattempt' && styles.choiceCardActive]}
                onPress={() => setActionChoice('reattempt')}
              >
                <Clock size={18} color={actionChoice === 'reattempt' ? '#2563eb' : '#64748b'} />
                <Text style={[styles.choiceTitle, actionChoice === 'reattempt' && styles.choiceTitleActive]}>
                  Re-Attempt Today
                </Text>
                <Text style={styles.choiceSub}>Try again after remaining stops</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choiceCard, actionChoice === 'rto' && styles.choiceCardActiveRto]}
                onPress={() => setActionChoice('rto')}
              >
                <RotateCcw size={18} color={actionChoice === 'rto' ? '#dc2626' : '#64748b'} />
                <Text style={[styles.choiceTitle, actionChoice === 'rto' && styles.choiceTitleActiveRto]}>
                  Return to Depot (RTO)
                </Text>
                <Text style={styles.choiceSub}>Bring package back to Morong HQ</Text>
              </TouchableOpacity>
            </View>

            {/* Additional Notes */}
            <Text style={[styles.label, { marginTop: 16 }]}>Attempt Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Called customer 3 times, gate padlocked..."
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            {/* Proof of Attempt Photo */}
            <Text style={[styles.label, { marginTop: 14 }]}>Proof of Attempt Photo</Text>
            <TouchableOpacity style={styles.photoBtn} onPress={pickProofPhoto}>
              <Camera size={18} color="#1e40af" />
              <Text style={styles.photoBtnText}>
                {photoUri ? 'Proof Photo Attached ✓' : 'Snap Closed Gate / Location Photo'}
              </Text>
            </TouchableOpacity>
            {photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} />}
          </ScrollView>

          {/* Submit Action */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <AlertCircle size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Confirm Failed Attempt</Text>
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
    maxHeight: '88%',
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
  reasonsList: {
    gap: 6,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reasonItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  radioCircleActive: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  reasonText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  reasonTextActive: {
    color: '#1e40af',
    fontWeight: '700',
  },
  actionChoiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    gap: 4,
  },
  choiceCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    borderWidth: 2,
  },
  choiceCardActiveRto: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
    borderWidth: 2,
  },
  choiceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  choiceTitleActive: {
    color: '#1e40af',
  },
  choiceTitleActiveRto: {
    color: '#dc2626',
  },
  choiceSub: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  notesInput: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
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
    backgroundColor: '#dc2626',
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
