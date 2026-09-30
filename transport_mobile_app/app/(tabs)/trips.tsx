import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  SafeAreaView,
  Platform,
  Linking,
  TextInput,
  Switch,
  Image,
  PanResponder,
  GestureResponderEvent
} from 'react-native';
import { Users, Wrench, Package, CheckCircle, MapPin, Clock, ChevronRight, Filter, X, Navigation, Info, CheckCircle2, Truck, ShieldAlert, ClipboardCheck, Scale, Fuel, Camera, DollarSign, PenTool, AlertTriangle, AlertCircle, QrCode } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAlarmNotifications } from '@/hooks/useAlarmNotifications';
import { useDriverLocationBroadcaster } from '@/hooks/useDriverLocationBroadcaster';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { CargoScannerModal } from '@/components/CargoScannerModal';
import { VehicleDefectReportModal } from '@/components/VehicleDefectReportModal';
import { InAppNavigationModal } from '@/components/InAppNavigationModal';
import { FailedDeliveryModal } from '@/components/FailedDeliveryModal';
import { useGeofenceTracker } from '@/hooks/useGeofenceTracker';
import { useDriverSafetyMonitor } from '@/hooks/useDriverSafetyMonitor';
import { SafetyMonitorOverlay } from '@/components/SafetyMonitorOverlay';

type TripType = 'passenger' | 'equipment' | 'cargo';
type TripStatus = 'scheduled' | 'active' | 'completed' | 'delivered' | 'pending' | 'in-transit';
type EmployeeStatus = 'pending' | 'active' | 'available' | 'inactive' | 'in-use';
type TripDetails = Record<string, unknown> | string | null;

type Trip = {
  id: string;
  trip_number: string;
  tracking_code?: string;
  trip_type: TripType;
  pickup_time: string;
  delivery_location: string;
  pickup_location: string;
  status: TripStatus;
  details: TripDetails;
  driver_id: string | null;
  vehicle_id?: number | string | null;
  cargo?: string;
  delivery_time?: string;
  leg1_distance_km?: number;
  leg1_duration_mins?: number;
  leg2_distance_km?: number;
  leg2_duration_mins?: number;
  package_length_cm?: number;
  package_width_cm?: number;
  package_height_cm?: number;
  package_weight_kg?: number;
  volumetric_weight_kg?: number;
  chargeable_weight_kg?: number;
  estimated_fare?: number;
  pod_recipient_name?: string;
  pod_signature_data?: string;
  pod_photo_url?: string;
  pod_delivered_at?: string;
};

type TabType = 'all' | TripType;

const getStatusColor = (status: TripStatus) => {
  switch (status) {
    case 'active': return '#15803d';
    case 'delivered': case 'completed': return '#475569';
    default: return '#0D47A1';
  }
};

export default function Trips() {
  const { employee, loading: authLoading } = useAuth();
  useAlarmNotifications();
  const { enqueueAction } = useOfflineSync();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDriver, setIsDriver] = useState(false);

  // Assessment State
  const [isAssessmentModalVisible, setIsAssessmentModalVisible] = useState(false);
  const [odometerInput, setOdometerInput] = useState('');
  const [fuelLevelInput, setFuelLevelInput] = useState('100');
  const [damageNotesInput, setDamageNotesInput] = useState('');
  const [checklist, setChecklist] = useState({
    brakes_steering: true,
    tires_wheels: true,
    engine_oil_fluids: true,
    lights_signals: true,
    safety_kit_extinguisher: true,
  });

  // e-POD (Proof of Delivery) State
  const [isEpodModalVisible, setIsEpodModalVisible] = useState(false);
  const [recipientNameInput, setRecipientNameInput] = useState('');
  const [podPhotoUri, setPodPhotoUri] = useState<string | null>(null);
  const [signaturePoints, setSignaturePoints] = useState<{ x: number; y: number }[]>([]);

  // Expense Logger State
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState(false);
  const [expenseType, setExpenseType] = useState<'fuel' | 'toll' | 'parking'>('fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseLiters, setExpenseLiters] = useState('');
  const [expenseOdo, setExpenseOdo] = useState('');
  const [expenseReceiptUri, setExpenseReceiptUri] = useState<string | null>(null);
  const [expenseNotes, setExpenseNotes] = useState('');

  // Enterprise Feature Modals State
  const [isScannerModalVisible, setIsScannerModalVisible] = useState(false);
  const [isDefectModalVisible, setIsDefectModalVisible] = useState(false);
  const [isNavModalVisible, setIsNavModalVisible] = useState(false);
  const [isFailedModalVisible, setIsFailedModalVisible] = useState(false);

  // Signature Pad PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setSignaturePoints(prev => [...prev, { x: Math.round(locationX), y: Math.round(locationY) }]);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setSignaturePoints(prev => [...prev, { x: Math.round(locationX), y: Math.round(locationY) }]);
      },
    })
  ).current;

  // Track active trip for background GPS broadcast & geofence triggers
  const activeTrip = trips.find(t => t.status === 'active' || t.status === 'in-transit');
  useDriverLocationBroadcaster(activeTrip?.id, activeTrip?.vehicle_id);
  useGeofenceTracker(null, null, activeTrip, () => {
    if (employee?.id) fetchTrips(employee.id, isDriver);
  });

  // HERMES Driver Safety Monitor
  const { monitorState, simulateSignal } = useDriverSafetyMonitor({
    tripId: activeTrip?.id,
    employeeId: employee?.id,
    driverName: employee?.full_name,
    isActive: !!activeTrip,
  });

  const fetchTrips = useCallback(async (empId: string, driverMode: boolean) => {
    setLoading(true);
    try {
      let query = supabase.from('trips').select('*').order('pickup_time', { ascending: true });
      if (driverMode) query = query.eq('driver_id', empId);
      const { data, error } = await query;
      if (error) throw error;
      setTrips((data ?? []) as Trip[]);
    } catch (err: any) { console.error('Trip fetch error:', err.message); setTrips([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!employee?.id) return;
    const driverMode = (employee.position || '').toLowerCase() === 'driver';
    setIsDriver(driverMode);
    fetchTrips(employee.id, driverMode);
  }, [employee?.id, fetchTrips]);

  useEffect(() => {
    if (activeTab === 'all') setFilteredTrips(trips);
    else setFilteredTrips(trips.filter((t) => t.trip_type === activeTab));
  }, [activeTab, trips]);

  const onRefresh = async () => {
    if (!employee?.id) return;
    setRefreshing(true);
    await fetchTrips(employee.id, isDriver);
    setRefreshing(false);
  };

  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  const handleStartNavigation = (address?: string, tripObj?: Trip | null) => {
    if (tripObj) {
      setSelectedTrip(tripObj);
    } else if (!selectedTrip && activeTrip) {
      setSelectedTrip(activeTrip);
    }
    setIsNavModalVisible(true);
  };

  const handleUpdateStatus = async (tripId: number | string, newStatus: string) => {
    try {
      setLoading(true);
      const updates: any = { status: newStatus };
      if (newStatus === 'completed' || newStatus === 'delivered') {
        updates.delivery_time = new Date().toISOString();
      }

      const { error: updateErr } = await supabase
        .from('trips')
        .update(updates)
        .eq('id', tripId);
        
      if (updateErr) {
        // Enqueue offline action if network failed
        enqueueAction({
          table: 'trips',
          type: 'update',
          payload: updates,
          matchKey: 'id',
          matchValue: tripId
        });
      }
      
      Alert.alert("Status Updated", `Trip has been marked as ${newStatus.toUpperCase()}.`);
      setIsModalVisible(false);
      onRefresh();
    } catch (err: any) {
      Alert.alert("Offline", "Action queued offline and will sync when connected.");
    } finally {
      setLoading(false);
    }
  };

  // Direct Complete Trip with Confirmation
  const handleCompleteTrip = (tripId: number | string, tripNumber?: string) => {
    Alert.alert(
      "Complete Trip",
      `Are you sure you want to mark trip ${tripNumber || `#${tripId}`} as COMPLETED?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Mark Completed",
          style: "default",
          onPress: () => handleUpdateStatus(tripId, 'completed'),
        },
      ]
    );
  };

  // Submit Proof of Delivery (e-POD)
  const handleSubmitEpod = async () => {
    if (!selectedTrip) return;
    if (!recipientNameInput.trim()) {
      Alert.alert("Required", "Please input the recipient name.");
      return;
    }
    if (signaturePoints.length < 3) {
      Alert.alert("Required", "Please have the recipient draw their signature.");
      return;
    }

    try {
      setLoading(true);
      const deliveredAt = new Date().toISOString();
      // Generate compact SVG signature path representation
      const signatureSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><path d="M${signaturePoints.map(p => `${p.x},${p.y}`).join(' L')}" stroke="%231e40af" stroke-width="3" fill="none"/></svg>`;

      const { error } = await supabase
        .from('trips')
        .update({
          status: 'completed',
          pod_recipient_name: recipientNameInput.trim(),
          pod_signature_data: signatureSvg,
          pod_photo_url: podPhotoUri || null,
          pod_delivered_at: deliveredAt,
          delivery_time: deliveredAt,
        })
        .eq('id', selectedTrip.id);

      if (error) {
        enqueueAction({
          table: 'trips',
          type: 'update',
          payload: {
            status: 'completed',
            pod_recipient_name: recipientNameInput.trim(),
            pod_signature_data: signatureSvg,
            pod_photo_url: podPhotoUri || null,
            pod_delivered_at: deliveredAt,
            delivery_time: deliveredAt,
          },
          matchKey: 'id',
          matchValue: selectedTrip.id
        });
      }

      Alert.alert("Delivery Verified", "e-POD receipt captured and trip marked COMPLETED!");
      setIsEpodModalVisible(false);
      setIsModalVisible(false);
      setSignaturePoints([]);
      setRecipientNameInput('');
      setPodPhotoUri(null);
      onRefresh();
    } catch (err: any) {
      Alert.alert("Error", "Failed to submit e-POD: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Photo Picker Helper
  const pickImage = async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setter(result.assets[0].uri);
    }
  };

  // Submit Expense
  const handleSubmitExpense = async () => {
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Required", "Please enter a valid expense amount.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        trip_id: selectedTrip?.id ? Number(selectedTrip.id) : null,
        driver_id: employee?.id || null,
        vehicle_id: selectedTrip?.vehicle_id ? Number(selectedTrip.vehicle_id) : null,
        expense_type: expenseType,
        amount: amt,
        liters: expenseLiters ? parseFloat(expenseLiters) : null,
        odometer: expenseOdo ? parseFloat(expenseOdo) : null,
        receipt_photo_url: expenseReceiptUri || null,
        notes: expenseNotes.trim() || null,
      };

      const { error } = await supabase.from('trip_expenses').insert([payload]);
      if (error) {
        enqueueAction({ table: 'trip_expenses', type: 'insert', payload });
      }

      Alert.alert("Expense Logged", `Successfully recorded ₱${amt.toFixed(2)} for ${expenseType}.`);
      setIsExpenseModalVisible(false);
      setExpenseAmount('');
      setExpenseLiters('');
      setExpenseOdo('');
      setExpenseReceiptUri(null);
      setExpenseNotes('');
    } catch (err: any) {
      Alert.alert("Error", "Failed to save expense: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Emergency SOS Panic Alert
  const handleTriggerSos = () => {
    Alert.alert(
      "🚨 TRIGGER EMERGENCY SOS",
      "Are you sure you want to broadcast an urgent SOS panic alarm to all dispatchers with your live location?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "BROADCAST SOS NOW",
          style: "destructive",
          onPress: async () => {
            if (!employee?.id) return;
            try {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                  const { latitude, longitude } = pos.coords;
                  await supabase.from('incident_reports').insert([{
                    driver_id: employee.id,
                    trip_id: selectedTrip?.id ? Number(selectedTrip.id) : null,
                    vehicle_id: selectedTrip?.vehicle_id ? Number(selectedTrip.vehicle_id) : null,
                    severity: 'sos',
                    incident_type: 'sos_panic',
                    description: `EMERGENCY SOS Triggered by ${employee.full_name} (${employee.employee_id})`,
                    latitude,
                    longitude,
                  }]);
                  Alert.alert("🚨 SOS Broadcast Sent", "Dispatchers and emergency response teams have been alerted!");
                });
              }
            } catch (err) {
              console.warn("SOS failed:", err);
            }
          }
        }
      ]
    );
  };

  // Submit Vehicle Assessment
  const handleSubmitAssessment = async () => {
    if (!selectedTrip?.vehicle_id || !employee?.id) {
      Alert.alert("Error", "No vehicle linked to this trip.");
      return;
    }

    const odo = parseFloat(odometerInput) || 0;
    if (odo <= 0) {
      Alert.alert("Required", "Please input a valid current odometer mileage.");
      return;
    }

    const hasCriticalFail = !checklist.brakes_steering || !checklist.tires_wheels || !checklist.lights_signals;
    const overallStatus = hasCriticalFail ? 'failed' : (!checklist.engine_oil_fluids || !checklist.safety_kit_extinguisher ? 'warning' : 'passed');

    try {
      setLoading(true);
      const { error: assessErr } = await supabase.from('vehicle_assessments').insert([{
        vehicle_id: Number(selectedTrip.vehicle_id),
        inspector_id: employee.id,
        trip_id: Number(selectedTrip.id),
        assessment_type: 'pre_trip',
        odometer_reading: odo,
        fuel_level_percentage: parseInt(fuelLevelInput, 10) || 100,
        checklist,
        has_critical_failure: hasCriticalFail,
        status: overallStatus,
        damage_notes: damageNotesInput,
      }]);

      if (assessErr) throw assessErr;

      if (hasCriticalFail) {
        Alert.alert(
          "🚨 SAFETY CRITICAL DEFECT",
          "Vehicle failed pre-trip safety checklist. It has been locked in MAINTENANCE mode. Do not operate this vehicle.",
          [{ text: "OK", style: "destructive" }]
        );
      } else {
        Alert.alert("Safety Passed", "Vehicle pre-trip inspection recorded. Proceeding with dispatch.");
        await handleUpdateStatus(selectedTrip.id, 'active');
      }

      setIsAssessmentModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", "Failed to submit assessment: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const TripIcon = ({ type, color }: { type: TripType, color: string }) => {
    if (type === 'passenger') return <Users size={16} color={color} />;
    if (type === 'equipment') return <Wrench size={16} color={color} />;
    return <Package size={16} color={color} />;
  };

  const renderTrip = (trip: Trip) => (
    <TouchableOpacity 
      key={trip.id} 
      style={styles.tripCard}
      onPress={() => {
        setSelectedTrip(trip);
        setIsModalVisible(true);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.idBadge}>
           <TripIcon type={trip.trip_type} color="#0D47A1" />
           <Text style={styles.tripId}>{trip.trip_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) + '20' }]}>
           <Text style={[styles.statusText, { color: getStatusColor(trip.status) }]}>{trip.status}</Text>
        </View>
      </View>

      <View style={styles.locationSection}>
        <View style={styles.locationRow}>
          <View style={styles.iconCircle}><MapPin size={10} color="#64748b" /></View>
          <Text style={styles.locationText}>{trip.pickup_location || 'Pickup'}</Text>
        </View>
        <View style={styles.locationLine} />
        <View style={styles.locationRow}>
          <View style={[styles.iconCircle, {backgroundColor: '#0D47A1'}]}><MapPin size={10} color="#fff" /></View>
          <Text style={[styles.locationText, {fontWeight: '600', color: '#1e293b'}]}>{trip.delivery_location}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.timeInfo}>
          <Clock size={12} color="#64748b" />
          <Text style={styles.timeLabel}>{formatDate(trip.pickup_time)}</Text>
        </View>
        <ChevronRight size={16} color="#cbd5e1" />
      </View>

      {/* DIRECT ACTION BUTTONS ON TRIP CARD */}
      {(trip.status === 'scheduled' || trip.status === 'pending') && (
        <View style={styles.cardDirectActionsRow}>
          <TouchableOpacity
            style={[styles.cardDirectBtn, { backgroundColor: '#0D47A1', flex: 1.2 }]}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedTrip(trip);
              handleUpdateStatus(trip.id, 'active');
              setIsNavModalVisible(true);
            }}
          >
            <Truck size={14} color="#fff" />
            <Text style={styles.cardDirectBtnText}>Start Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cardDirectBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', flex: 1 }]}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedTrip(trip);
              setIsAssessmentModalVisible(true);
            }}
          >
            <ClipboardCheck size={14} color="#0D47A1" />
            <Text style={[styles.cardDirectBtnText, { color: '#0D47A1' }]}>Pre-Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {(trip.status === 'active' || trip.status === 'in-transit') && (
        <View style={styles.cardDirectActionsRow}>
          <TouchableOpacity
            style={[styles.cardDirectBtn, { backgroundColor: '#1976D2', flex: 1 }]}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedTrip(trip);
              setIsNavModalVisible(true);
            }}
          >
            <Navigation size={14} color="#fff" />
            <Text style={styles.cardDirectBtnText}>Open In-App Map & Safety Cam</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading || authLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0D47A1" /></View>;
  }

  return (
    <View style={styles.wrapper}>
      {/* HERMES Driver Safety Monitor Floating HUD */}
      {activeTrip && (
        <SafetyMonitorOverlay
          driverName={employee?.full_name || 'Driver'}
          tripNumber={activeTrip.trip_number}
          fatigueLevel={monitorState.fatigueLevel}
          fatigueScore={monitorState.fatigueScore}
          dominantSignal={monitorState.dominantSignal}
          eventCount={monitorState.eventCount}
          onSimulate={simulateSignal}
        />
      )}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Trips & Deliveries</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity style={styles.sosHeaderBtn} onPress={handleTriggerSos}>
              <ShieldAlert size={16} color="#fff" />
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
            <View style={styles.headerRight}>
               <Filter size={18} color="#64748b" />
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
          {['all', 'passenger', 'equipment', 'cargo'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, activeTab === t && styles.chipActive]}
              onPress={() => setActiveTab(t as TabType)}
            >
              <Text style={[styles.chipText, activeTab === t && styles.chipTextActive]}>
                {t === 'cargo' ? 'Deliveries' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView 
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
        >
          {filteredTrips.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No trips scheduled.</Text></View>
          ) : (
            filteredTrips.map(renderTrip)
          )}
          <View style={{height: 40}} />
        </ScrollView>
      </SafeAreaView>

      {/* TRIP DETAILS MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
              <View style={styles.modalHeaderExtra}>
                 <View>
                    <Text style={styles.modalTitle}>Trip Details</Text>
                    <Text style={styles.modalSubtitle}>Order #{selectedTrip?.trip_number}</Text>
                 </View>
                 <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                 {/* DUAL-LEG ROUTE & TRACKING CARD */}
                 <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Dual-Leg Tracking & ETAs</Text>
                    <View style={styles.dualLegCard}>
                       <View style={styles.dualLegRow}>
                          <View style={[styles.legDot, {backgroundColor: '#0284c7'}]} />
                          <View style={{flex: 1}}>
                             <Text style={styles.legTitle}>Leg 1: Dispatch (HQ ➔ Pickup)</Text>
                             <Text style={styles.legSub}>
                               {selectedTrip?.leg1_distance_km ? `${selectedTrip.leg1_distance_km} km • ~${selectedTrip.leg1_duration_mins || 25} mins` : 'Est. ~14 km • 25 mins'}
                             </Text>
                          </View>
                          <TouchableOpacity style={styles.legNavBtn} onPress={() => handleStartNavigation(selectedTrip?.pickup_location || '')}>
                             <Navigation size={12} color="#0284c7" />
                          </TouchableOpacity>
                       </View>

                       <View style={styles.legDivider} />

                       <View style={styles.dualLegRow}>
                          <View style={[styles.legDot, {backgroundColor: '#16a34a'}]} />
                          <View style={{flex: 1}}>
                             <Text style={styles.legTitle}>Leg 2: In-Transit (Pickup ➔ Delivery)</Text>
                             <Text style={styles.legSub}>
                               {selectedTrip?.leg2_distance_km ? `${selectedTrip.leg2_distance_km} km • ~${selectedTrip.leg2_duration_mins || 45} mins` : 'Est. ~35 km • 50 mins'}
                             </Text>
                          </View>
                          <TouchableOpacity style={styles.legNavBtn} onPress={() => handleStartNavigation(selectedTrip?.delivery_location || '')}>
                             <Navigation size={12} color="#16a34a" />
                          </TouchableOpacity>
                       </View>
                    </View>
                 </View>

                 {/* CARGO & ESTIMATION CARD */}
                 <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Cargo & Automated Estimation</Text>
                    <View style={styles.cargoCard}>
                       <Package size={24} color="#0D47A1" />
                       <View style={{flex: 1}}>
                          <Text style={styles.cargoName}>{selectedTrip?.cargo || 'General Cargo'}</Text>
                          <Text style={styles.cargoType}>{selectedTrip?.trip_type.toUpperCase()} DELIVERY</Text>
                          {selectedTrip?.chargeable_weight_kg ? (
                            <Text style={styles.cargoEstimateDetail}>
                              Chargeable Wt: <Text style={{fontWeight: '700', color: '#1e293b'}}>{selectedTrip.chargeable_weight_kg} kg</Text> • Vol: <Text style={{fontWeight: '700', color: '#1e293b'}}>{selectedTrip.volumetric_weight_kg || 0} kg</Text>
                            </Text>
                          ) : null}
                          {selectedTrip?.estimated_fare ? (
                            <Text style={styles.cargoFareDetail}>
                              Estimated Fare: <Text style={{fontWeight: '700', color: '#047857'}}>₱{selectedTrip.estimated_fare.toLocaleString()}</Text>
                            </Text>
                          ) : null}
                       </View>
                    </View>
                 </View>

                 {/* ROUTE SCHEDULE */}
                 <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Route Stops</Text>
                    <View style={styles.routeContainer}>
                       <View style={styles.routeItem}>
                          <View style={[styles.routeDot, {backgroundColor: '#3b82f6'}]} />
                          <View style={{flex: 1}}>
                             <Text style={styles.routeLabel}>Origin / Pickup</Text>
                             <Text style={styles.routeName}>{selectedTrip?.pickup_location}</Text>
                             <Text style={styles.routeDate}>{formatDate(selectedTrip?.pickup_time)}</Text>
                          </View>
                       </View>
                       <View style={styles.routeLine} />
                       <View style={styles.routeItem}>
                          <View style={[styles.routeDot, {backgroundColor: '#10b981'}]} />
                          <View style={{flex: 1}}>
                             <Text style={styles.routeLabel}>Destination</Text>
                             <Text style={styles.routeName}>{selectedTrip?.delivery_location}</Text>
                             <Text style={styles.routeDate}>{formatDate(selectedTrip?.delivery_time)}</Text>
                          </View>
                       </View>
                    </View>
                 </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                 {/* COMPLETED STATUS BADGE */}
                 {selectedTrip && (selectedTrip.status === 'completed' || selectedTrip.status === 'delivered') && (
                    <View style={styles.completedBanner}>
                       <CheckCircle size={20} color="#16a34a" />
                       <View style={{flex: 1}}>
                          <Text style={styles.completedTitle}>Trip Completed ✓</Text>
                          <Text style={styles.completedSub}>
                            {selectedTrip.pod_recipient_name ? `Delivered to ${selectedTrip.pod_recipient_name}` : 'Completed successfully'}
                          </Text>
                       </View>
                    </View>
                 )}

                 {/* SCHEDULED / PENDING ACTIONS */}
                 {selectedTrip && (selectedTrip.status === 'scheduled' || selectedTrip.status === 'pending') && (
                    <>
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#0D47A1'}]} 
                        onPress={() => {
                          handleUpdateStatus(selectedTrip.id, 'active');
                          setIsModalVisible(false);
                          setIsNavModalVisible(true);
                        }}
                      >
                         <Truck size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Start Trip & Launch In-App Map</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#0284c7'}]} 
                        onPress={() => {
                          setIsModalVisible(false);
                          setIsAssessmentModalVisible(true);
                        }}
                      >
                         <ClipboardCheck size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Pre-Trip Safety Inspection & Start</Text>
                      </TouchableOpacity>
                    </>
                 )}

                 {/* ACTIVE & IN-TRANSIT ACTIONS */}
                 {selectedTrip && (selectedTrip.status === 'active' || selectedTrip.status === 'in-transit') && (
                    <>
                      {/* Set In-Transit if just active */}
                      {selectedTrip.status === 'active' && (
                        <TouchableOpacity 
                          style={[styles.actionBtn, {backgroundColor: '#0284c7'}]} 
                          onPress={() => handleUpdateStatus(selectedTrip.id, 'in-transit')}
                        >
                           <Navigation size={18} color="#fff" />
                           <Text style={styles.actionBtnText}>Mark as In-Transit</Text>
                        </TouchableOpacity>
                      )}

                      {/* In-App Live HUD Map */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#1976D2'}]} 
                        onPress={() => {
                          setIsModalVisible(false);
                          setIsNavModalVisible(true);
                        }}
                      >
                         <Navigation size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Open In-App Map & Safety Cam</Text>
                      </TouchableOpacity>

                      {/* Scan Cargo QR Code */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#4f46e5'}]} 
                        onPress={() => setIsScannerModalVisible(true)}
                      >
                         <QrCode size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Scan Cargo Barcode / QR</Text>
                      </TouchableOpacity>

                      {/* Complete Trip - Direct */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#16a34a'}]} 
                        onPress={() => handleCompleteTrip(selectedTrip.id, selectedTrip.trip_number)}
                      >
                         <CheckCircle2 size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Complete Trip (Direct)</Text>
                      </TouchableOpacity>

                      {/* e-POD Sign-Off */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#0f766e'}]} 
                        onPress={() => setIsEpodModalVisible(true)}
                      >
                         <PenTool size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Sign Proof of Delivery (e-POD)</Text>
                      </TouchableOpacity>

                      {/* Log Failed Delivery / RTO */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#dc2626'}]} 
                        onPress={() => setIsFailedModalVisible(true)}
                      >
                         <AlertCircle size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Log Failed Attempt / RTO</Text>
                      </TouchableOpacity>

                      {/* Report Defect */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#b91c1c'}]} 
                        onPress={() => setIsDefectModalVisible(true)}
                      >
                         <Wrench size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Report Vehicle Defect</Text>
                      </TouchableOpacity>

                      {/* Log Expense */}
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#475569'}]} 
                        onPress={() => setIsExpenseModalVisible(true)}
                      >
                         <Fuel size={18} color="#fff" />
                         <Text style={styles.actionBtnText}>Log Fuel / Toll Expense</Text>
                      </TouchableOpacity>
                    </>
                 )}

                 {/* In-App Navigation with Safety Cam */}
                 <TouchableOpacity
                   style={[styles.actionBtn, {backgroundColor: '#1976D2'}]} 
                   onPress={() => {
                     setIsModalVisible(false);
                     handleStartNavigation(selectedTrip?.delivery_location || '', selectedTrip);
                   }}
                 >
                    <Navigation size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Open In-App Map & Safety Cam</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* e-POD SIGNATURE & PHOTO MODAL */}
      <Modal visible={isEpodModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { maxHeight: '92%' }]}>
              <View style={styles.modalHeaderExtra}>
                 <View>
                    <Text style={styles.modalTitle}>Proof of Delivery (e-POD)</Text>
                    <Text style={styles.modalSubtitle}>Order #{selectedTrip?.trip_number} — Recipient Sign-Off</Text>
                 </View>
                 <TouchableOpacity onPress={() => setIsEpodModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                 <Text style={styles.inputLabel}>Recipient Full Name *</Text>
                 <TextInput 
                   style={styles.textInput} 
                   placeholder="e.g. Maria Santos" 
                   value={recipientNameInput} 
                   onChangeText={setRecipientNameInput} 
                 />

                 <View style={{marginTop: 16}}>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6}}>
                     <Text style={styles.inputLabel}>Recipient Digital Signature *</Text>
                     <TouchableOpacity onPress={() => setSignaturePoints([])}>
                       <Text style={{fontSize: 12, color: '#dc2626', fontWeight: '700'}}>Clear Pad</Text>
                     </TouchableOpacity>
                   </View>
                   <View style={styles.signaturePad} {...panResponder.panHandlers}>
                     {signaturePoints.length === 0 ? (
                       <Text style={styles.signaturePrompt}>Draw digital signature here with finger</Text>
                     ) : (
                       <View style={styles.signaturePreview}>
                         {signaturePoints.map((pt, idx) => (
                           <View key={idx} style={[styles.signatureDot, { left: pt.x, top: pt.y }]} />
                         ))}
                       </View>
                     )}
                   </View>
                 </View>

                 <View style={{marginTop: 16}}>
                   <Text style={styles.inputLabel}>Delivery Cargo Photo Proof (Optional)</Text>
                   <TouchableOpacity style={styles.photoPickerBtn} onPress={() => pickImage(setPodPhotoUri)}>
                     <Camera size={20} color="#0D47A1" />
                     <Text style={styles.photoPickerText}>{podPhotoUri ? 'Change Delivery Photo' : 'Attach Delivery Photo'}</Text>
                   </TouchableOpacity>
                   {podPhotoUri && (
                     <Image source={{ uri: podPhotoUri }} style={styles.photoPreview} />
                   )}
                 </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                 <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#16a34a'}]} onPress={handleSubmitEpod}>
                    <CheckCircle2 size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Confirm Delivery & Complete</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* EXPENSE LOGGER MODAL */}
      <Modal visible={isExpenseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeaderExtra}>
                 <View>
                    <Text style={styles.modalTitle}>Log Trip Expense</Text>
                    <Text style={styles.modalSubtitle}>Trip #{selectedTrip?.trip_number}</Text>
                 </View>
                 <TouchableOpacity onPress={() => setIsExpenseModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                 <View style={{flexDirection: 'row', gap: 8, marginBottom: 16}}>
                   {(['fuel', 'toll', 'parking'] as const).map(t => (
                     <TouchableOpacity 
                       key={t} 
                       style={[styles.expenseTypeChip, expenseType === t && styles.expenseTypeChipActive]}
                       onPress={() => setExpenseType(t)}
                     >
                       <Text style={[styles.expenseTypeText, expenseType === t && styles.expenseTypeTextActive]}>
                         {t.toUpperCase()}
                       </Text>
                     </TouchableOpacity>
                   ))}
                 </View>

                 <Text style={styles.inputLabel}>Amount (₱) *</Text>
                 <TextInput 
                   style={styles.textInput} 
                   placeholder="e.g. 1500.00" 
                   keyboardType="numeric" 
                   value={expenseAmount} 
                   onChangeText={setExpenseAmount} 
                 />

                 {expenseType === 'fuel' && (
                   <>
                     <View style={{marginTop: 12}}>
                       <Text style={styles.inputLabel}>Fuel Liters (Optional)</Text>
                       <TextInput 
                         style={styles.textInput} 
                         placeholder="e.g. 25.5" 
                         keyboardType="numeric" 
                         value={expenseLiters} 
                         onChangeText={setExpenseLiters} 
                       />
                     </View>

                     <View style={{marginTop: 12}}>
                       <Text style={styles.inputLabel}>Current Odometer Mileage (km)</Text>
                       <TextInput 
                         style={styles.textInput} 
                         placeholder="e.g. 48200" 
                         keyboardType="numeric" 
                         value={expenseOdo} 
                         onChangeText={setExpenseOdo} 
                       />
                     </View>
                   </>
                 )}

                 <View style={{marginTop: 16}}>
                   <TouchableOpacity style={styles.photoPickerBtn} onPress={() => pickImage(setExpenseReceiptUri)}>
                     <Camera size={18} color="#0D47A1" />
                     <Text style={styles.photoPickerText}>{expenseReceiptUri ? 'Receipt Photo Attached ✓' : 'Attach Receipt Photo'}</Text>
                   </TouchableOpacity>
                 </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                 <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#0284c7'}]} onPress={handleSubmitExpense}>
                    <DollarSign size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Save Expense Log</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* VEHICLE SAFETY ASSESSMENT MODAL */}
      <Modal visible={isAssessmentModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { maxHeight: '92%' }]}>
              <View style={styles.modalHeaderExtra}>
                 <View>
                    <Text style={styles.modalTitle}>Pre-Trip Vehicle Assessment</Text>
                    <Text style={styles.modalSubtitle}>Trip #{selectedTrip?.trip_number} — Safety Verification</Text>
                 </View>
                 <TouchableOpacity onPress={() => setIsAssessmentModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                 <Text style={styles.assessPrompt}>Verify each mechanical & safety item before initiating dispatch:</Text>

                 {/* Checklist switches */}
                 {[
                   { key: 'brakes_steering', label: 'Braking & Steering Response (Critical)' },
                   { key: 'tires_wheels', label: 'Tire Pressure & Tread Condition (Critical)' },
                   { key: 'lights_signals', label: 'Headlights, Taillights & Turn Signals (Critical)' },
                   { key: 'engine_oil_fluids', label: 'Engine Oil & Coolant Levels' },
                   { key: 'safety_kit_extinguisher', label: 'Fire Extinguisher & First Aid Kit' },
                 ].map((item) => (
                   <View key={item.key} style={styles.switchRow}>
                     <Text style={[styles.switchLabel, item.label.includes('Critical') && { fontWeight: '700', color: '#0f172a' }]}>{item.label}</Text>
                     <Switch 
                       value={(checklist as any)[item.key]} 
                       onValueChange={(val) => setChecklist(prev => ({ ...prev, [item.key]: val }))} 
                       trackColor={{ false: '#fca5a5', true: '#86efac' }}
                       thumbColor={(checklist as any)[item.key] ? '#16a34a' : '#dc2626'}
                     />
                   </View>
                 ))}

                 <View style={{marginTop: 16}}>
                   <Text style={styles.inputLabel}>Current Odometer Mileage (km) *</Text>
                   <TextInput 
                     style={styles.textInput} 
                     placeholder="e.g. 45280" 
                     keyboardType="numeric" 
                     value={odometerInput} 
                     onChangeText={setOdometerInput} 
                   />
                 </View>

                 <View style={{marginTop: 12}}>
                   <Text style={styles.inputLabel}>Fuel Level Percentage (%)</Text>
                   <TextInput 
                     style={styles.textInput} 
                     placeholder="e.g. 100" 
                     keyboardType="numeric" 
                     value={fuelLevelInput} 
                     onChangeText={setFuelLevelInput} 
                   />
                 </View>

                 <View style={{marginTop: 12}}>
                   <Text style={styles.inputLabel}>Damage or Observation Notes (Optional)</Text>
                   <TextInput 
                     style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]} 
                     placeholder="Note any visible scratches or dents..." 
                     multiline 
                     value={damageNotesInput} 
                     onChangeText={setDamageNotesInput} 
                   />
                 </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                 <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#16a34a'}]} onPress={handleSubmitAssessment}>
                    <CheckCircle2 size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Sign Off & Initialize Dispatch</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* IN-APP LIVE NAVIGATION HUD MODAL */}
      <InAppNavigationModal
        visible={isNavModalVisible}
        onClose={() => setIsNavModalVisible(false)}
        trip={selectedTrip || activeTrip}
        driverName={employee?.full_name || 'Driver'}
        fatigueLevel={monitorState.fatigueLevel}
        fatigueScore={monitorState.fatigueScore}
        dominantSignal={monitorState.dominantSignal}
        eventCount={monitorState.eventCount}
        onSimulate={simulateSignal}
        onOpenEpod={() => {
          setIsNavModalVisible(false);
          setIsEpodModalVisible(true);
        }}
        onOpenScanner={() => {
          setIsNavModalVisible(false);
          setIsScannerModalVisible(true);
        }}
        onOpenExpense={() => {
          setIsNavModalVisible(false);
          setIsExpenseModalVisible(true);
        }}
        onTriggerSos={handleTriggerSos}
      />

      {/* CARGO QR / BARCODE SCANNER MODAL */}
      <CargoScannerModal
        visible={isScannerModalVisible}
        onClose={() => setIsScannerModalVisible(false)}
        expectedTrackingCode={selectedTrip?.tracking_code}
        expectedTripNumber={selectedTrip?.trip_number}
        onVerified={(scannedCode) => {
          Alert.alert("Cargo Verified ✓", `Package ${scannedCode} verified for order #${selectedTrip?.trip_number}.`);
        }}
      />

      {/* VEHICLE DEFECT & MAINTENANCE TICKET MODAL */}
      <VehicleDefectReportModal
        visible={isDefectModalVisible}
        onClose={() => setIsDefectModalVisible(false)}
        vehicleId={selectedTrip?.vehicle_id}
        tripId={selectedTrip?.id}
        onSubmitted={() => {
          onRefresh();
        }}
      />

      {/* FAILED DELIVERY / RTO MODAL */}
      {selectedTrip && (
        <FailedDeliveryModal
          visible={isFailedModalVisible}
          onClose={() => setIsFailedModalVisible(false)}
          tripId={selectedTrip.id}
          tripNumber={selectedTrip.trip_number}
          onSuccess={() => {
            onRefresh();
            setIsModalVisible(false);
          }}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 0 : 40, marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  headerRight: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  filters: { maxHeight: 50, marginBottom: 12 },
  filtersContent: { paddingHorizontal: 20, gap: 10, alignItems: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0D47A1' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  tripCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  idBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tripId: { fontSize: 13, fontWeight: '700', color: '#0D47A1' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  locationSection: { marginBottom: 16, paddingLeft: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  locationText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  locationLine: { width: 1, height: 16, backgroundColor: '#e2e8f0', marginLeft: 8.5, marginVertical: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  timeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '90%' },
  modalHeaderExtra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '500' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalBody: { marginBottom: 24 },
  detailSection: { marginBottom: 24 },
  detailTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  cargoCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#f8fafc', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  cargoName: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  cargoType: { fontSize: 12, fontWeight: '600', color: '#3b82f6', marginTop: 2 },
  cargoEstimateDetail: { fontSize: 11, color: '#475569', marginTop: 4 },
  cargoFareDetail: { fontSize: 12, color: '#16a34a', fontWeight: '700', marginTop: 2 },
  dualLegCard: { backgroundColor: '#f8fafc', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  dualLegRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legDot: { width: 10, height: 10, borderRadius: 5 },
  legTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  legSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  legNavBtn: { backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  legDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10 },
  routeContainer: { paddingLeft: 8 },
  routeItem: { flexDirection: 'row', gap: 16 },
  routeDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  routeLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  routeName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  routeDate: { fontSize: 13, color: '#64748b', marginTop: 2 },
  routeLine: { width: 2, height: 40, backgroundColor: '#f1f5f9', marginLeft: 5, marginVertical: 4 },
  modalFooter: { gap: 12 },
  actionBtn: { backgroundColor: '#0D47A1', height: 54, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#64748b' },
  assessPrompt: { fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  switchLabel: { fontSize: 13, color: '#334155', flex: 1, paddingRight: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  textInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  sosHeaderBtn: { backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sosText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  signaturePad: { height: 130, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', borderStyle: 'dashed', position: 'relative', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  signaturePrompt: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  signaturePreview: { width: '100%', height: '100%', position: 'relative' },
  signatureDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#0D47A1' },
  photoPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  photoPickerText: { fontSize: 13, fontWeight: '700', color: '#0D47A1' },
  photoPreview: { width: '100%', height: 120, borderRadius: 12, marginTop: 10, resizeMode: 'cover' },
  expenseTypeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  expenseTypeChipActive: { backgroundColor: '#0284c7' },
  expenseTypeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  expenseTypeTextActive: { color: '#fff' },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#dcfce7',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#86efac',
    marginBottom: 8,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803d',
  },
  completedSub: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
    fontWeight: '500',
  },
  cardDirectActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cardDirectBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});