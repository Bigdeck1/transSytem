import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform
} from "react-native";
import { CheckCircle, LogOut, Calendar, Clock as ClockIcon, MapPin, ChevronRight } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type Attendance = {
  id: number;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  created_at: string;
};

const formatTime = (time: string | null) => {
  if (!time) return "—";
  const parts = time.split(":");
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }
  return time;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

const computeHours = (checkIn: string, checkOut: string) => {
  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);
  let inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;
  if (outMinutes < inMinutes) outMinutes += 24 * 60; // Overnight shift handling
  return +((outMinutes - inMinutes) / 60).toFixed(1);
};

export default function AttendanceScreen() {
  const { employee, loading: authLoading } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authLoading && employee) loadAttendance();
  }, [authLoading, employee]);

  const loadAttendance = async () => {
    if (!employee?.id) return;
    try {
      setLoading(true);
      setError(null);
      // Use local timezone date (not UTC) — critical for UTC+8 where toISOString()
      // returns yesterday's date after midnight local time
      const now = new Date();
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(thirtyDaysAgo.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("date", thirtyDaysAgoStr)
        .order("date", { ascending: false });

      if (error) throw error;
      const rows = (data ?? []).map((r) => ({ ...r, id: Number(r.id), date: r.date.split("T")[0], })) as Attendance[];
      setHistory(rows);
      setTodayAttendance(rows.find((r) => r.date === todayLocal) ?? null);
    } catch (err: any) { setError("Failed to load records"); } finally { setLoading(false); setRefreshing(false); }
  };

  const handleCheckIn = async () => {
    if (!employee) return;
    try {
      setSubmitting(true);
      setError(null);
      const now = new Date();
      const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const { data, error } = await supabase.rpc("insert_attendance", { 
        p_employee_id: employee.id,
        p_today_time: localTime 
      });
      if (error) throw error;
      const attendance = { ...data, id: Number(data.id) } as Attendance;
      setTodayAttendance(attendance);
      setHistory((prev) => [attendance, ...prev.filter((h) => h.id !== attendance.id)]);
    } catch (err: any) { setError(err.message ?? "Check-in failed"); } finally { setSubmitting(false); }
  };

  const handleCheckOut = async () => {
    if (!employee || !todayAttendance) return;
    try {
      setSubmitting(true);
      setError(null);
      const checkOutTime = new Date().toTimeString().slice(0, 8);
      const { data, error } = await supabase.from("attendance").update({ check_out: checkOutTime }).eq("id", Number(todayAttendance.id)).select();
      if (error) throw error;
      if (data && data.length > 0) {
        const updated = { ...data[0], id: Number(data[0].id) } as Attendance;
        setTodayAttendance(updated);
        setHistory((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      }
    } catch (err: any) { setError(err.message ?? "Check-out failed"); } finally { setSubmitting(false); }
  };

  if (authLoading || loading) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>
    );
  }

  const isCheckedIn = !!todayAttendance?.check_in;
  const isCheckedOut = !!todayAttendance?.check_out;

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Shift Control</Text>
          <Text style={styles.headerSubtitle}>{new Date().toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        </View>

        <ScrollView 
          style={styles.container} 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAttendance} />}
        >
          {/* --- ACTIVE STATUS HUB --- */}
          <View style={[styles.statusHub, isCheckedIn && !isCheckedOut ? styles.statusHubActive : {}]}>
            <View style={styles.hubHeader}>
              <View style={styles.clockContainer}>
                <ClockIcon size={16} color={isCheckedIn && !isCheckedOut ? "#fff" : "#64748b"} />
                <Text style={[styles.clockLabel, isCheckedIn && !isCheckedOut ? {color: "#bfdbfe"} : {}]}>Live Clock</Text>
              </View>
              <Text style={[styles.liveTime, isCheckedIn && !isCheckedOut ? {color: "#fff"} : {}]}>
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>

            <View style={styles.divider} />

            {!isCheckedIn ? (
              <TouchableOpacity style={styles.mainActionBtnIn} onPress={handleCheckIn} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Start Shift</Text>}
              </TouchableOpacity>
            ) : isCheckedOut ? (
              <View style={styles.completedBox}>
                <CheckCircle size={24} color="#059669" />
                <Text style={styles.completedText}>Shift Completed</Text>
                <Text style={styles.durationSummary}>{computeHours(todayAttendance!.check_in!, todayAttendance!.check_out!)} hrs total</Text>
              </View>
            ) : (
              <View>
                <View style={[styles.row, {marginBottom: 20, justifyContent: "center"}]}>
                   <View style={styles.statusDot} />
                   <Text style={[styles.activeLabel, {color: "#fff"}]}>On Duty since {formatTime(todayAttendance!.check_in)}</Text>
                </View>
                <TouchableOpacity style={styles.mainActionBtnOut} onPress={handleCheckOut} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>End Shift</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {error && <Text style={styles.errorBanner}>{error}</Text>}

          {/* --- HISTORY SECTION --- */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Timeline</Text>
            <TouchableOpacity onPress={loadAttendance}>
              <Text style={styles.viewAll}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {history.length === 0 ? (
            <View style={styles.empty}>
              <Calendar size={48} color="#e2e8f0" />
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          ) : (
            history.map((r, i) => (
              <View key={r.id} style={styles.timelineItem}>
                <View style={styles.timelinePoint}>
                   <View style={[styles.dot, i === 0 ? styles.dotActive : {}]} />
                   {i < history.length - 1 && <View style={styles.line} />}
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardDate}>{formatDate(r.date)}</Text>
                    <View style={styles.timeRange}>
                       <Text style={styles.timeText}>{formatTime(r.check_in)}</Text>
                       <ChevronRight size={12} color="#94a3b8" />
                       <Text style={styles.timeText}>{r.check_out ? formatTime(r.check_out) : "Active"}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    {r.check_out ? (
                      <Text style={styles.totalHrs}>{computeHours(r.check_in!, r.check_out!)}h</Text>
                    ) : (
                      <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Live</Text></View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
          <View style={{height: 40}} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#fff" },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeader: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 0 : 40, marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 14, color: "#64748b", marginTop: 4, fontWeight: "500" },
  container: { flex: 1, paddingHorizontal: 20 },
  statusHub: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#1e40af",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32
  },
  statusHubActive: { backgroundColor: "#1e40af", borderColor: "#1e40af" },
  hubHeader: { alignItems: "center", marginBottom: 20 },
  clockContainer: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  clockLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", textTransform: "uppercase" },
  liveTime: { fontSize: 36, fontWeight: "800", color: "#0f172a", letterSpacing: 1 },
  divider: { height: 1, backgroundColor: "#f1f5f9", opacity: 0.2, marginBottom: 20 },
  mainActionBtnIn: { backgroundColor: "#10b981", height: 60, borderRadius: 18, justifyContent: "center", alignItems: "center", shadowColor: "#10b981", shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  mainActionBtnOut: { backgroundColor: "rgba(255,255,255,0.2)", height: 60, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  completedBox: { alignItems: "center", gap: 8 },
  completedText: { fontSize: 18, fontWeight: "700", color: "#059669" },
  durationSummary: { fontSize: 14, color: "#64748b" },
  row: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981", marginRight: 8 },
  activeLabel: { fontSize: 14, fontWeight: "600" },
  errorBanner: { backgroundColor: "#fee2e2", color: "#b91c1c", padding: 12, borderRadius: 12, textAlign: "center", marginBottom: 20, fontSize: 13 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  viewAll: { fontSize: 14, color: "#1e40af", fontWeight: "600" },
  timelineItem: { flexDirection: "row", gap: 16, marginBottom: 12 },
  timelinePoint: { alignItems: "center", width: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e2e8f0", zIndex: 1 },
  dotActive: { backgroundColor: "#1e40af", borderWidth: 3, borderColor: "#dbeafe" },
  line: { width: 2, flex: 1, backgroundColor: "#f1f5f9", marginVertical: -4 },
  timelineCard: { flex: 1, backgroundColor: "#f8fafc", padding: 16, borderRadius: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardInfo: { gap: 4 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  cardDate: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  timeRange: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeText: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  totalHrs: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  activeBadge: { backgroundColor: "#dbeafe", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { fontSize: 11, fontWeight: "700", color: "#1e40af" },
  empty: { alignItems: "center", padding: 60, gap: 12 },
  emptyText: { color: "#94a3b8", fontWeight: "500" }
});

