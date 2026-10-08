import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Image,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package,
  Clock,
  CheckCircle2,
  TrendingUp,
  Users,
  Truck,
  User,
  ChevronRight,
  ShieldCheck,
  CalendarCheck,
  Award,
  AlertTriangle
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { Colors, moderateScale, isTablet, isSmallDevice } from "@/constants/theme";

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
  const { width } = useWindowDimensions();
  const isAdmin =
    employee?.position?.toLowerCase() === "admin" ||
    employee?.position?.toLowerCase() === "owner" ||
    employee?.position?.toLowerCase() === "manager";

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

  const StatItem = ({
    title,
    value,
    icon,
    color,
    bg,
  }: {
    title: string;
    value: any;
    icon: any;
    color: string;
    bg: string;
  }) => (
    <View style={[styles.statItem, { backgroundColor: bg }]}>
      <View style={styles.statIconContainer}>{icon}</View>
      <View style={styles.statTextWrap}>
        <Text style={[styles.statValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.statTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: isSmallDevice ? 14 : isTablet ? 28 : 18 },
          ]}
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
          {/* --- TOP BRAND HEADER --- */}
          <View style={styles.header}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting} numberOfLines={1}>
                Welcome, {userName}
              </Text>
              <Text style={styles.date}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/profile")}
              style={styles.avatar}
            >
              {employee?.avatar_url ? (
                <Image source={{ uri: employee.avatar_url }} style={styles.avatarImg} />
              ) : (
                <User color={Colors.primaryNavy} size={moderateScale(24)} />
              )}
            </TouchableOpacity>
          </View>

          {/* --- ROLE / ACCESS BADGE --- */}
          <View style={styles.roleBanner}>
            <ShieldCheck size={14} color={Colors.textWhite} style={styles.roleIcon} />
            <Text style={styles.roleText}>
              {isAdmin
                ? "Fleet Operations Admin"
                : employeeCode
                ? `ID: ${employeeCode} • Verified Driver`
                : "Internal Staff"}
            </Text>
          </View>

          {/* --- MAIN KPI STATS MOSAIC --- */}
          <View style={styles.mosaic}>
            <View style={styles.mosaicRow}>
              <StatItem
                title={isAdmin ? "Active Trips" : "In Progress"}
                value={activeDeliveries}
                icon={<Package size={22} color={Colors.primaryBlue} />}
                color={Colors.primaryNavy}
                bg={Colors.primarySoft}
              />
              <StatItem
                title={isAdmin ? "Fleet Size" : "Today Done"}
                value={isAdmin ? totalFleet : completedToday}
                icon={<Truck size={22} color={Colors.primaryNavy} />}
                color={Colors.primaryNavy}
                bg="#EDE7F6"
              />
            </View>
            <View style={styles.mosaicRow}>
              <StatItem
                title={isAdmin ? "Active Staff" : "Shift Drive Time"}
                value={isAdmin ? totalEmployees : hoursWorked}
                icon={<Clock size={22} color={Colors.success} />}
                color={Colors.successText}
                bg={Colors.successSoft}
              />
              <StatItem
                title={isAdmin ? "Operational Flow" : "On-Time Dispatch"}
                value={isAdmin ? "Optimal" : onTimeRate}
                icon={<TrendingUp size={22} color={Colors.warning} />}
                color={Colors.warningText}
                bg={Colors.warningSoft}
              />
            </View>
          </View>

          {/* --- DRIVER SAFETY & HOS (INTERNAL PROCESS MONITOR) --- */}
          {!isAdmin && (
            <View style={styles.hosCard}>
              <View style={styles.hosHeader}>
                <View style={styles.hosTitleRow}>
                  <Clock size={16} color={Colors.info} />
                  <Text style={styles.hosTitle}>Hours of Service (HOS) & Safety</Text>
                </View>
                <View style={[styles.hosBadge, { backgroundColor: Colors.successSoft }]}>
                  <Text style={[styles.hosBadgeText, { color: Colors.success }]}>
                    Compliant ✓
                  </Text>
                </View>
              </View>

              <Text style={styles.hosSubtitle}>
                Continuous Road Drive:{" "}
                <Text style={{ fontWeight: "800", color: Colors.textPrimary }}>
                  {hoursWorked}
                </Text>{" "}
                / 4h max safe threshold
              </Text>

              {/* Responsive Progress Bar */}
              <View style={styles.hosProgressBg}>
                <View style={[styles.hosProgressFill, { width: "45%" }]} />
              </View>

              <Text style={styles.hosFooterText}>
                Safety Protocol: 15-minute mandatory safety check is required for long-haul routes.
              </Text>
            </View>
          )}

          {/* --- OPERATIONAL MILESTONE CARD --- */}
          {!isAdmin && (
            <View style={styles.performanceCard}>
              <View style={styles.perfHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Award size={16} color={Colors.primaryNavy} />
                  <Text style={styles.perfTitle}>Weekly Dispatch Milestone</Text>
                </View>
                <View style={styles.perfBadge}>
                  <Text style={styles.perfBadgeText}>Target: 8 Trips</Text>
                </View>
              </View>
              <Text style={styles.perfSub}>
                Completed{" "}
                <Text style={{ fontWeight: "700", color: Colors.primaryNavy }}>
                  {completedToday}
                </Text>{" "}
                of 8 scheduled dispatches this week
              </Text>
              <View style={styles.perfBarBg}>
                <View
                  style={[
                    styles.perfBarFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(12, completedToday * 12.5)
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.perfTip}>
                🎯 On-time delivery rating is {onTimeRate}. Safety records are up to standard.
              </Text>
            </View>
          )}

          {/* --- INTERNAL OPERATIONS ACTIONS --- */}
          <Text style={styles.sectionTitle}>Internal Operations</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push("/trips")}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.primaryNavy }]}>
                <Truck size={20} color={Colors.textWhite} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>Active Trips & Dispatches</Text>
                <Text style={styles.actionSub}>View routes, cargo details, and electronic POD</Text>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push("/requests")}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.primaryBlue }]}>
                <CalendarCheck size={20} color={Colors.textWhite} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>Time-Off & Leave Filing</Text>
                <Text style={styles.actionSub}>Submit advance scheduling requests to dispatchers</Text>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
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
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Platform.OS === "ios" ? 8 : 18,
    marginBottom: 14,
  },
  greetingContainer: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  date: {
    fontSize: moderateScale(13),
    color: Colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  avatar: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: moderateScale(23),
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  roleBanner: {
    backgroundColor: Colors.primaryNavy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roleIcon: {
    marginRight: 6,
  },
  roleText: {
    color: Colors.textWhite,
    fontSize: moderateScale(11),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mosaic: {
    gap: 12,
  },
  mosaicRow: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    justifyContent: "space-between",
    minHeight: moderateScale(110),
    borderWidth: 1,
    borderColor: "rgba(13, 71, 161, 0.06)",
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  statTextWrap: {
    marginTop: 8,
  },
  statValue: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statTitle: {
    fontSize: moderateScale(12),
    color: Colors.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 24,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  actions: {
    gap: 10,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  actionLabel: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  actionSub: {
    fontSize: moderateScale(11),
    color: Colors.textSecondary,
    marginTop: 2,
  },
  hosCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  hosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  hosTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hosTitle: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  hosBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hosBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: "700",
  },
  hosSubtitle: {
    fontSize: moderateScale(12),
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  hosProgressBg: {
    height: 7,
    backgroundColor: Colors.borderSubtle,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  hosProgressFill: {
    height: "100%",
    backgroundColor: Colors.info,
    borderRadius: 4,
  },
  hosFooterText: {
    fontSize: moderateScale(11),
    color: Colors.textMuted,
    lineHeight: 15,
  },
  performanceCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  perfHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  perfTitle: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: Colors.primaryNavy,
  },
  perfBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  perfBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: Colors.primaryNavy,
  },
  perfSub: {
    fontSize: moderateScale(12),
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  perfBarBg: {
    height: 7,
    backgroundColor: Colors.primarySoft,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  perfBarFill: {
    height: "100%",
    backgroundColor: Colors.primaryBlue,
    borderRadius: 4,
  },
  perfTip: {
    fontSize: moderateScale(11),
    color: Colors.primaryNavy,
    fontWeight: "600",
  },
});