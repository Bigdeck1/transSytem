import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView
} from "react-native";
import { FileClock, Calendar, MessageSquare, Send, CheckCircle, Clock as ClockIcon, XCircle, ChevronRight, ListFilter } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type TimeOffRequest = {
  id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
};

const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'approved': return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', icon: <CheckCircle size={14} color="#15803d" /> };
    case 'rejected': return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', icon: <XCircle size={14} color="#b91c1c" /> };
    default: return { bg: '#fef3c7', text: '#92400e', border: '#fde68a', icon: <ClockIcon size={14} color="#92400e" /> };
  }
};

export default function RequestsScreen() {
  const { employee, loading: authLoading } = useAuth();

  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Calculate earliest allowed date (Next week Monday or +7 days)
  const getNextWeekMinDate = () => {
    const today = new Date();
    const nextWeek = new Date(today);
    // Move to next week (+7 days)
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek;
  };

  const formatDateYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const minAllowedDate = getNextWeekMinDate();
  const minAllowedDateStr = formatDateYYYYMMDD(minAllowedDate);

  // Form state default to next week
  const [startDate, setStartDate] = useState(minAllowedDateStr);
  const [endDate, setEndDate] = useState(minAllowedDateStr);
  const [reason, setReason] = useState("");
  const [requestType, setRequestType] = useState("Vacation");

  const fetchRequests = useCallback(async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data || []) as TimeOffRequest[]);
    } catch (err: any) {
      console.error("Fetch requests error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employee?.id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const submitRequest = async () => {
    if (!startDate || !endDate || !reason.trim()) {
      Alert.alert("Required", "Please provide start date, end date, and a reason.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const minDate = new Date(minAllowedDateStr);

    // Validate no backdating & must be at least next week
    if (start < minDate) {
      Alert.alert(
        "Invalid Start Date",
        `Leave requests must be submitted at least 1 week in advance. Earliest allowed start date is ${minAllowedDateStr}.`
      );
      return;
    }

    if (end < start) {
      Alert.alert("Invalid Range", "End date cannot be earlier than start date.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("time_off_requests").insert([
        {
          employee_id: employee?.id,
          request_type: requestType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          status: "Pending"
        }
      ]);

      if (error) throw error;

      Alert.alert("Success", "Your leave request has been submitted for approval.");
      setReason("");
      setStartDate(minAllowedDateStr);
      setEndDate(minAllowedDateStr);
      fetchRequests();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>;
  }

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <View style={styles.topHeader}>
            <Text style={styles.headerTitle}>Leave Requests</Text>
            <View style={styles.headerRight}>
               <ListFilter size={18} color="#64748b" />
            </View>
          </View>

          <ScrollView 
            style={styles.container} 
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* --- SUBMISSION FORM --- */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New Leave Request</Text>
              
              <View style={styles.noticeBox}>
                <ClockIcon size={16} color="#2563eb" />
                <Text style={styles.noticeText}>
                  Policy: Leave requests must be booked at least 1 week in advance (Earliest: <Text style={{fontWeight: '700'}}>{minAllowedDateStr}</Text>). Backdating is strictly disabled.
                </Text>
              </View>

              <View style={styles.typeSelector}>
                 {["Vacation", "Sick Leave", "Emergency", "Other"].map(t => (
                   <TouchableOpacity 
                    key={t} 
                    style={[styles.typeChip, requestType === t && styles.typeChipActive]}
                    onPress={() => setRequestType(t)}
                   >
                     <Text style={[styles.typeText, requestType === t && styles.typeTextActive]}>{t}</Text>
                   </TouchableOpacity>
                 ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Start Date (Min: {minAllowedDateStr})</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={18} color="#2563eb" style={styles.inputIcon} />
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      min={minAllowedDateStr}
                      value={startDate}
                      onChange={(e: any) => setStartDate(e.target.value)}
                      style={{
                        flex: 1,
                        height: 48,
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: 15,
                        color: '#1e293b',
                        fontFamily: 'inherit',
                        paddingRight: 12
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder={minAllowedDateStr}
                      value={startDate}
                      onChangeText={setStartDate}
                    />
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>End Date (Cannot be before Start Date)</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={18} color="#2563eb" style={styles.inputIcon} />
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      min={startDate || minAllowedDateStr}
                      value={endDate}
                      onChange={(e: any) => setEndDate(e.target.value)}
                      style={{
                        flex: 1,
                        height: 48,
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: 15,
                        color: '#1e293b',
                        fontFamily: 'inherit',
                        paddingRight: 12
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder={startDate || minAllowedDateStr}
                      value={endDate}
                      onChangeText={setEndDate}
                    />
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Reason</Text>
                <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingTop: 12 }]}>
                  <MessageSquare size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                    placeholder="Provide details for your leave request..."
                    multiline
                    value={reason}
                    onChangeText={setReason}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={submitRequest} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Send size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>Submit Leave Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* --- HISTORY LIST --- */}
            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Request History</Text>
            
            {requests.length === 0 ? (
              <View style={styles.empty}>
                <FileClock size={48} color="#e2e8f0" />
                <Text style={styles.emptyText}>No previous requests</Text>
              </View>
            ) : (
              requests.map((item) => {
                const s = getStatusStyle(item.status);
                return (
                  <View key={item.id} style={styles.requestCard}>
                    <View style={styles.cardHeader}>
                       <Text style={styles.requestType}>{item.request_type}</Text>
                       <View style={[styles.statusBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
                          {s.icon}
                          <Text style={[styles.statusText, { color: s.text }]}>{item.status}</Text>
                       </View>
                    </View>
                    
                    <View style={styles.dateRange}>
                       <Calendar size={14} color="#64748b" />
                       <Text style={styles.dateText}>{item.start_date} to {item.end_date}</Text>
                    </View>
                    
                    <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>
                    
                    <View style={styles.cardFooterDivider} />
                    <View style={styles.cardFooter}>
                       <Text style={styles.createdAt}>Sent {new Date(item.created_at).toLocaleDateString()}</Text>
                       <ChevronRight size={16} color="#cbd5e1" />
                    </View>
                  </View>
                );
              })
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#fff" },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 0 : 40, marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  headerRight: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingHorizontal: 20 },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3
  },
  formTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  typeSelector: { flexDirection: "row", gap: 10, marginBottom: 20 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#f1f5f9" },
  typeChipActive: { backgroundColor: "#1e40af" },
  typeText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  typeTextActive: { color: "#fff" },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  inputIcon: { marginLeft: 12, marginRight: 8 },
  input: { flex: 1, height: 48, color: "#1e293b", fontSize: 15, fontWeight: "500" },
  submitBtn: {
    backgroundColor: "#1e40af",
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    shadowColor: "#1e40af",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  empty: { alignItems: "center", padding: 60, gap: 12 },
  emptyText: { color: "#94a3b8", fontWeight: "500" },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  requestType: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  dateRange: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dateText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  reasonText: { fontSize: 14, color: "#64748b", marginBottom: 12, lineHeight: 20 },
  cardFooterDivider: { height: 1, backgroundColor: "#f1f5f9", marginBottom: 12 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  createdAt: { fontSize: 11, color: "#94a3b8", fontWeight: "500" }
});
