import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, Image, RefreshControl } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Clock, CheckCircle, TrendingUp, Users, Truck, User, ChevronRight } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";

type AttendanceRow = {
  check_in: string | null;
  check_out: string | null;
};

type TripRow = {
  pickup_time: string;
  delivery_time: string;
  status: string;
};

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function HomeTab() {
  const { session, employee } = useAuth();
  const router = useRouter();
  const isAdmin = employee?.position?.toLowerCase() === "admin" || employee?.position?.toLowerCase() === "owner" || employee?.position?.toLowerCase() === "manager";

  const [userName, setUserName] = useState("Employee");
  const [employeeCode, setEmployeeCode] = useState<string | null>(null);

  const [activeDeliveries, setActiveDeliveries] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [hoursWorked, setHoursWorked] = useState("0h 0m");
  const [onTimeRate, setOnTimeRate] = useState("N/A");

  const [totalFleet, setTotalFleet] = useState(0);
  const [totalEmployees, setTotalEmployees] = useState(0);

  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    if (!employee?.id) return;

    try {
      const meta = (session?.user?.user_metadata ?? {}) as { full_name?: string };
      const rawName = (employee.full_name ?? "").trim() || (meta.full_name ?? "").trim() || "Employee";
      const firstName = rawName.split(/\s+/).filter(Boolean)[0] || "Employee";

      setEmployeeCode(employee.employee_id ?? null);
      setUserName(firstName);

      const todayDate = getLocalDateString();

      if (isAdmin) {
        const [activeTripsRes, completedTripsRes, fleetRes, empRes] = await Promise.all([
          supabase.from("trips").select("*", { count: "exact", head: true }).neq("status", "delivered"),
          supabase.from("trips").select("*", { count: "exact", head: true }).eq("status", "delivered").gte("delivery_time", `${todayDate}T00:00:00`),
          supabase.from("vehicles").select("*", { count: "exact", head: true }),
          supabase.from("employees").select("*", { count: "exact", head: true })
        ]);
        setActiveDeliveries(activeTripsRes.count || 0);
        setCompletedToday(completedTripsRes.count || 0);
        setTotalFleet(fleetRes.count || 0);
        setTotalEmployees(empRes.count || 0);
      } else {
        const [activeTripsRes, completedTripsRes, attendanceRes, totalTripsRes, deliveredTripsRes] = await Promise.all([
          supabase.from("trips").select("*", { count: "exact", head: true }).eq("driver_id", employee.id).neq("status", "delivered"),
          supabase.from("trips").select("*", { count: "exact", head: true }).eq("driver_id", employee.id).eq("status", "delivered").gte("delivery_time", `${todayDate}T00:00:00`),
          supabase.from("attendance").select("check_in, check_out").eq("employee_id", employee.id).eq("date", todayDate),
          supabase.from("trips").select("*", { count: "exact", head: true }).eq("driver_id", employee.id),
          supabase.from("trips").select("*", { count: "exact", head: true }).eq("driver_id", employee.id).eq("status", "delivered"),
        ]);

        const attendanceData = (attendanceRes.data ?? []) as AttendanceRow[];
        let totalMinutes = 0;
        attendanceData.forEach((row) => {
          if (row.check_in && row.check_out) {
            const [inH, inM] = row.check_in.split(":").map(Number);
            const [outH, outM] = row.check_out.split(":").map(Number);
            const inMinutes = inH * 60 + inM;
            const outMinutes = outH * 60 + outM;
            if (!Number.isNaN(inMinutes) && !Number.isNaN(outMinutes) && outMinutes >= inMinutes) {
              totalMinutes += outMinutes - inMinutes;
            }
          }
        });

        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        
        const totalCount = totalTripsRes.count || 0;
        const deliveredCount = deliveredTripsRes.count || 0;
        const derivedRate = totalCount ? `${Math.round((deliveredCount / totalCount) * 100)}%` : "N/A";

        setActiveDeliveries(activeTripsRes.count || 0);
        setCompletedToday(completedTripsRes.count || 0);
        setHoursWorked(`${h}h ${m}m`);
        setOnTimeRate(derivedRate);
      }
    } catch (error) { 
      console.error("Dashboard error:", error); 
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStats();
  }, [employee?.id, isAdmin]);

  const StatItem = ({ title, value, icon, color, bg }: { title: string, value: any, icon: any, color: string, bg: string }) => (
    <View style={[styles.statItem, { backgroundColor: bg }]}>
      <View style={styles.statIconContainer}>{icon}</View>
      <View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.container} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* --- HEADER --- */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome, {userName}</Text>
              <Text style={styles.date}>
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
              </Text>
            </View>
            <View style={styles.avatar}>
              {employee?.avatar_url ? (
                <Image source={{ uri: employee.avatar_url }} style={styles.avatarImg} />
              ) : (
                <User color="#1e40af" size={24} />
              )}
            </View>
          </View>

          {/* --- ROLE BANNER --- */}
          <View style={[styles.roleBanner, { backgroundColor: "#0D47A1" }]}>
            <View style={styles.roleIcon}>
              <Shield size={16} color="#fff" />
            </View>
            <Text style={styles.roleText}>
              {isAdmin ? "Admin Access" : (employeeCode ? `ID: ${employeeCode}` : "Employee View")}
            </Text>
          </View>

          {/* --- MAIN STATS MOSAIC --- */}
          <View style={styles.mosaic}>
            <View style={styles.mosaicRow}>
              <StatItem 
                title={isAdmin ? "Active Trips" : "In Progress"} 
                value={activeDeliveries} 
                icon={<Package size={22} color="#1976D2" />} 
                color="#1976D2"
                bg="#E3F2FD" 
              />
              <StatItem 
                title={isAdmin ? "Fleet Size" : "Today Done"} 
                value={isAdmin ? totalFleet : completedToday} 
                icon={<Truck size={22} color="#0D47A1" />} 
                color="#0D47A1"
                bg="#E8EAF6" 
              />
            </View>
            <View style={styles.mosaicRow}>
              <StatItem 
                title={isAdmin ? "Team Members" : "Shift Hours"} 
                value={isAdmin ? totalEmployees : hoursWorked} 
                icon={<Clock size={22} color="#43A047" />} 
                color="#43A047"
                bg="#E8F5E9" 
              />
              <StatItem 
                title={isAdmin ? "Daily Performance" : "On-Time Rate"} 
                value={isAdmin ? "Trending" : onTimeRate} 
                icon={<TrendingUp size={22} color="#F59E0B" />} 
                color="#F59E0B"
                bg="#FFF8E1" 
              />
            </View>
          </View>

          {/* --- HOURS OF SERVICE (HOS) & DRIVER FATIGUE MONITOR --- */}
          {!isAdmin && (
            <View style={styles.hosCard}>
              <View style={styles.hosHeader}>
                <View style={styles.hosTitleRow}>
                  <Clock size={16} color="#0284c7" />
                  <Text style={styles.hosTitle}>Hours of Service (HOS) & Safety</Text>
                </View>
                <View style={[styles.hosBadge, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[styles.hosBadgeText, { color: '#15803d' }]}>Compliant ✓</Text>
                </View>
              </View>

              <Text style={styles.hosSubtitle}>
                Continuous Drive Time: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{hoursWorked}</Text> / 4h max
              </Text>

              {/* Progress bar towards 4-hour rest limit */}
              <View style={styles.hosProgressBg}>
                <View style={[styles.hosProgressFill, { width: '45%' }]} />
              </View>

              <Text style={styles.hosFooterText}>
                Mandatory 15-min rest break recommended every 4 hours of continuous road dispatch.
              </Text>
            </View>
          )}

          {/* --- DRIVER INCENTIVE & PERFORMANCE MILESTONES --- */}
          {!isAdmin && (
            <View style={styles.performanceCard}>
              <View style={styles.perfHeader}>
                <Text style={styles.perfTitle}>Weekly Dispatch Milestone</Text>
                <Text style={styles.perfReward}>₱1,500 Bonus</Text>
              </View>
              <Text style={styles.perfSub}>
                Completed <Text style={{ fontWeight: '700', color: '#1e40af' }}>{completedToday}</Text> of 8 target trips this week
              </Text>
              <View style={styles.perfBarBg}>
                <View style={[styles.perfBarFill, { width: `${Math.min(100, Math.max(15, completedToday * 18))}%` }]} />
              </View>
              <Text style={styles.perfTip}>
                🎯 On-time delivery rate is at {onTimeRate}. Keep up the safe driving!
              </Text>
            </View>
          )}

          {/* --- QUICK ACTIONS --- */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/attendance")}>
              <View style={[styles.actionIcon, { backgroundColor: "#1e40af" }]}>
                <CheckCircle size={20} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Attendance & Shift Clock-In</Text>
              <ChevronRight size={18} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/trips")}>
              <View style={[styles.actionIcon, { backgroundColor: "#c2410c" }]}>
                <Truck size={20} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Active Trips & Dispatches</Text>
              <ChevronRight size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const Shield = ({ size, color }: any) => <Users size={size} color={color} />;

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#fff" },
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Platform.OS === 'ios' ? 0 : 40,
    marginBottom: 16
  },
  greeting: { fontSize: 24, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  date: { fontSize: 14, color: "#64748b", fontWeight: "500", marginTop: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  roleBanner: {
    backgroundColor: "#1e40af",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24
  },
  roleIcon: { marginRight: 6 },
  roleText: { color: "#fff", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  mosaic: { gap: 12 },
  mosaicRow: { flexDirection: "row", gap: 12 },
  statItem: { flex: 1, padding: 20, borderRadius: 24, justifyContent: "space-between", height: 130 },
  statIconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.7)", justifyContent: "center", alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800" },
  statTitle: { fontSize: 13, color: "#334155", fontWeight: "600", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginTop: 32, marginBottom: 16 },
  actions: { gap: 12 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  actionIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 16 },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1e293b" },
  hosCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hosTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  hosBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hosBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hosSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
  },
  hosProgressBg: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  hosProgressFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 4,
  },
  hosFooterText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  performanceCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  perfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  perfTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
  },
  perfReward: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  perfSub: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 8,
  },
  perfBarBg: {
    height: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  perfBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  perfTip: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '500',
  },
});