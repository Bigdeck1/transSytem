import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
} from "react-native";
import {
  Megaphone,
  AlertCircle,
  Bell,
  Info,
  Truck,
  CheckCircle2,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, moderateScale, isTablet, isSmallDevice } from "@/constants/theme";

export interface Notification {
  id: string;
  employee_id: string;
  title: string;
  message: string;
  type: "paycheck" | "announcement" | "alert" | "other";
  urgency?: "low" | "normal" | "urgent" | "alarm";
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const { employee, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee?.id) loadNotifications();
    else if (!authLoading) setLoading(false);
  }, [employee?.id, authLoading]);

  const loadNotifications = async () => {
    if (!employee?.id) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setNotifications((data as Notification[]) ?? []);
    } catch (err: any) {
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    } catch (err) {
      console.warn("Failed to sync read status");
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getIcon = (type: Notification["type"], urgency?: Notification["urgency"]) => {
    if (urgency === "alarm" || type === "alert") {
      return {
        icon: <AlertCircle size={20} color={Colors.danger} />,
        bg: Colors.dangerSoft,
      };
    }
    switch (type) {
      case "announcement":
        return {
          icon: <Megaphone size={20} color={Colors.info} />,
          bg: Colors.infoSoft,
        };
      default:
        return {
          icon: <Truck size={20} color={Colors.primaryBlue} />,
          bg: Colors.primarySoft,
        };
    }
  };

  if (loading || authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primaryBlue} />
      </View>
    );
  }

  const unread = notifications.filter((n) => !n.is_read);
  const hPadding = isSmallDevice ? 14 : isTablet ? 28 : 18;

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        {/* --- TOP HEADER --- */}
        <View style={[styles.topHeader, { paddingHorizontal: hPadding }]}>
          <View>
            <Text style={styles.headerTitle}>Operational Alerts</Text>
            <Text style={styles.headerSubtitle}>Live dispatch updates & alarms</Text>
          </View>
          <View style={styles.headerRight}>
            {unread.length > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unread.length}</Text>
              </View>
            )}
            <Bell size={18} color={Colors.primaryNavy} />
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadNotifications}
              colors={[Colors.primaryBlue]}
              tintColor={Colors.primaryBlue}
            />
          }
        >
          {error && <Text style={styles.errorText}>{error}</Text>}

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Bell size={40} color={Colors.border} />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up</Text>
              <Text style={styles.emptySub}>
                You will receive real-time notifications here when new dispatches, route changes, or alarms occur.
              </Text>
            </View>
          ) : (
            notifications.map((n) => {
              const isAlarm = n.urgency === "alarm" || n.type === "alert";
              const { icon, bg } = getIcon(n.type, n.urgency);
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[
                    styles.notiCard,
                    !n.is_read && styles.notiUnread,
                    isAlarm && styles.alarmCard,
                  ]}
                  onPress={() => markAsRead(n.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: bg }]}>{icon}</View>
                  <View style={styles.content}>
                    <View style={styles.contentHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                        {isAlarm && <Text style={styles.alarmPill}>🚨 ALARM</Text>}
                        <Text
                          style={[
                            styles.notiTitle,
                            !n.is_read && { color: Colors.textPrimary, fontWeight: "700" },
                          ]}
                          numberOfLines={1}
                        >
                          {n.title}
                        </Text>
                      </View>
                      <Text style={styles.notiTime}>{formatTimestamp(n.created_at)}</Text>
                    </View>
                    <Text style={styles.notiMsg} numberOfLines={2}>
                      {n.message}
                    </Text>
                  </View>
                  {!n.is_read && (
                    <View
                      style={[
                        styles.blueDot,
                        isAlarm && { backgroundColor: Colors.danger },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })
          )}
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
    position: "relative",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.card,
    zIndex: 1,
  },
  unreadCountText: {
    color: Colors.textWhite,
    fontSize: 9,
    fontWeight: "800",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  errorText: {
    color: Colors.danger,
    textAlign: "center",
    margin: 16,
    fontSize: moderateScale(13),
  },
  notiCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  notiUnread: {
    backgroundColor: Colors.card,
    borderColor: Colors.primaryLight,
    borderLeftWidth: 3.5,
    borderLeftColor: Colors.primaryNavy,
  },
  alarmCard: {
    backgroundColor: Colors.dangerSoft,
    borderColor: Colors.dangerBorder,
    borderWidth: 1.5,
  },
  alarmPill: {
    backgroundColor: Colors.danger,
    color: Colors.textWhite,
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  contentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  notiTitle: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  notiTime: {
    fontSize: moderateScale(10),
    color: Colors.textMuted,
    fontWeight: "500",
    marginLeft: 6,
  },
  notiMsg: {
    fontSize: moderateScale(12),
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryBlue,
    marginLeft: 8,
  },
  empty: {
    alignItems: "center",
    padding: 40,
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: moderateScale(12),
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
