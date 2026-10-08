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
  KeyboardAvoidingView,
} from "react-native";
import {
  FileClock,
  Calendar,
  MessageSquare,
  Send,
  CheckCircle,
  Clock as ClockIcon,
  XCircle,
  ChevronRight,
  ListFilter,
  Info,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, moderateScale, isTablet, isSmallDevice } from "@/constants/theme";

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
    case "approved":
      return {
        bg: Colors.successSoft,
        text: Colors.successText,
        border: Colors.successBorder,
        icon: <CheckCircle size={14} color={Colors.success} />,
      };
    case "rejected":
      return {
        bg: Colors.dangerSoft,
        text: Colors.dangerText,
        border: Colors.dangerBorder,
        icon: <XCircle size={14} color={Colors.danger} />,
      };
    default:
      return {
        bg: Colors.warningSoft,
        text: Colors.warningText,
        border: Colors.warningBorder,
        icon: <ClockIcon size={14} color={Colors.warning} />,
      };
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
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek;
  };

  const formatDateYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
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
          status: "Pending",
        },
      ]);

      if (error) throw error;

      Alert.alert("Success", "Your leave request has been submitted to dispatch for approval.");
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
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primaryBlue} />
      </View>
    );
  }

  const hPadding = isSmallDevice ? 14 : isTablet ? 28 : 18;

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* --- TOP HEADER --- */}
          <View style={[styles.topHeader, { paddingHorizontal: hPadding }]}>
            <View>
              <Text style={styles.headerTitle}>Leave & Time-Off</Text>
              <Text style={styles.headerSubtitle}>Advance scheduling & attendance management</Text>
            </View>
            <View style={styles.headerRight}>
              <ListFilter size={18} color={Colors.primaryNavy} />
            </View>
          </View>

          <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hPadding }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primaryBlue]}
                tintColor={Colors.primaryBlue}
              />
            }
          >
            {/* --- SUBMISSION FORM CARD --- */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Submit New Request</Text>

              <View style={styles.noticeBox}>
                <Info size={16} color={Colors.info} />
                <Text style={styles.noticeText}>
                  Internal Notice: Leave requests must be booked 1 week in advance (Earliest:{" "}
                  <Text style={{ fontWeight: "700" }}>{minAllowedDateStr}</Text>).
                </Text>
              </View>

              {/* Type Selector Pills */}
              <View style={styles.typeSelector}>
                {["Vacation", "Sick Leave", "Emergency", "Other"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.7}
                    style={[styles.typeChip, requestType === t && styles.typeChipActive]}
                    onPress={() => setRequestType(t)}
                  >
                    <Text style={[styles.typeText, requestType === t && styles.typeTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Start Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Start Date (Min: {minAllowedDateStr})</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={18} color={Colors.primaryNavy} style={styles.inputIcon} />
                  {Platform.OS === "web" ? (
                    <input
                      type="date"
                      min={minAllowedDateStr}
                      value={startDate}
                      onChange={(e: any) => setStartDate(e.target.value)}
                      style={{
                        flex: 1,
                        height: 46,
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: 14,
                        color: Colors.textPrimary,
                        fontFamily: "inherit",
                        paddingRight: 12,
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder={minAllowedDateStr}
                      placeholderTextColor={Colors.textMuted}
                      value={startDate}
                      onChangeText={setStartDate}
                    />
                  )}
                </View>
              </View>

              {/* End Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>End Date</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={18} color={Colors.primaryNavy} style={styles.inputIcon} />
                  {Platform.OS === "web" ? (
                    <input
                      type="date"
                      min={startDate || minAllowedDateStr}
                      value={endDate}
                      onChange={(e: any) => setEndDate(e.target.value)}
                      style={{
                        flex: 1,
                        height: 46,
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: 14,
                        color: Colors.textPrimary,
                        fontFamily: "inherit",
                        paddingRight: 12,
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder={startDate || minAllowedDateStr}
                      placeholderTextColor={Colors.textMuted}
                      value={endDate}
                      onChangeText={setEndDate}
                    />
                  )}
                </View>
              </View>

              {/* Reason */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Reason for Request</Text>
                <View style={[styles.inputWrapper, { alignItems: "flex-start", paddingTop: 10 }]}>
                  <MessageSquare size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { height: 75, textAlignVertical: "top" }]}
                    placeholder="Provide justification for internal record..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    value={reason}
                    onChangeText={setReason}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                activeOpacity={0.8}
                onPress={submitRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.textWhite} />
                ) : (
                  <>
                    <Send size={18} color={Colors.textWhite} />
                    <Text style={styles.submitBtnText}>Submit Leave Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* --- REQUEST HISTORY --- */}
            <Text style={styles.sectionTitle}>Request History</Text>

            {requests.length === 0 ? (
              <View style={styles.empty}>
                <FileClock size={44} color={Colors.border} />
                <Text style={styles.emptyText}>No previous leave requests submitted</Text>
              </View>
            ) : (
              requests.map((item) => {
                const s = getStatusStyle(item.status);
                return (
                  <View key={item.id} style={styles.requestCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.requestType}>{item.request_type}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: s.bg, borderColor: s.border },
                        ]}
                      >
                        {s.icon}
                        <Text style={[styles.statusText, { color: s.text }]}>{item.status}</Text>
                      </View>
                    </View>

                    <View style={styles.dateRange}>
                      <Calendar size={14} color={Colors.textSecondary} />
                      <Text style={styles.dateText}>
                        {item.start_date} → {item.end_date}
                      </Text>
                    </View>

                    <Text style={styles.reasonText} numberOfLines={2}>
                      {item.reason}
                    </Text>

                    <View style={styles.cardFooterDivider} />
                    <View style={styles.cardFooter}>
                      <Text style={styles.createdAt}>
                        Filed: {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                      <ChevronRight size={16} color={Colors.textMuted} />
                    </View>
                  </View>
                );
              })
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 8 : 18,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    color: Colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  headerRight: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  formTitle: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.infoSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.infoBorder,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: moderateScale(11),
    color: Colors.infoText,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 24,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  typeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryNavy,
    borderColor: Colors.primaryNavy,
  },
  typeText: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  typeTextActive: {
    color: Colors.textWhite,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 46,
    color: Colors.textPrimary,
    fontSize: moderateScale(13),
    fontWeight: "500",
    paddingRight: 12,
  },
  submitBtn: {
    backgroundColor: Colors.primaryNavy,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: Colors.textWhite,
    fontWeight: "700",
    fontSize: moderateScale(14),
  },
  empty: {
    alignItems: "center",
    padding: 40,
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    color: Colors.textMuted,
    fontWeight: "500",
    fontSize: moderateScale(13),
  },
  requestCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  requestType: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dateRange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  dateText: {
    fontSize: moderateScale(12),
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  reasonText: {
    fontSize: moderateScale(13),
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  createdAt: {
    fontSize: moderateScale(11),
    color: Colors.textMuted,
    fontWeight: "500",
  },
});
