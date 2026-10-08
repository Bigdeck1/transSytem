import { Tabs, useRouter } from "expo-router";
import { Home, Truck, Calendar, User, DollarSign, FileClock, Bell } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useDriverLocationBroadcaster } from "@/hooks/useDriverLocationBroadcaster";
import { useAlarmNotifications } from "@/hooks/useAlarmNotifications";
import { useEffect } from "react";
import { View, ActivityIndicator, Image, StyleSheet } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, isTablet, moderateScale } from "@/constants/theme";

export default function TabLayout() {
  const { employee, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Continuously broadcast live GPS location when logged in
  useDriverLocationBroadcaster();
  // Listen for dispatch alarms
  useAlarmNotifications();

  useEffect(() => {
    // If we're fully loaded and have no employee, the user is likely logged out.
  }, [loading, employee]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={Colors.primaryBlue} />
      </View>
    );
  }

  const isAdmin =
    employee?.position?.toLowerCase() === "admin" ||
    employee?.position?.toLowerCase() === "owner" ||
    employee?.position?.toLowerCase() === "manager";

  const bottomPadding = Math.max(insets.bottom, 8);
  const tabHeight = 58 + (insets.bottom > 0 ? insets.bottom - 4 : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryNavy,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: "#0D47A1",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: isTablet ? 13 : 11,
          fontWeight: "700",
        },
      }}
    >
      {/* ── Active Tabs ─────────────────────────── */}

      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="trips"
        options={{
          title: isAdmin ? "All Trips" : "My Trips",
          tabBarIcon: ({ size, color }) => <Truck size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          title: "Leaves",
          tabBarIcon: ({ size, color }) => <FileClock size={size} color={color} />,
          href: isAdmin ? null : undefined,
        }}
      />

      <Tabs.Screen
        name="notification"
        options={{
          title: "Alerts",
          tabBarIcon: ({ size, color }) => <Bell size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: isAdmin ? "Admin Profile" : "Profile",
          tabBarIcon: ({ size, color }) => (
            <View style={[styles.tabAvatar, { borderColor: color }]}>
              {employee?.avatar_url ? (
                <Image source={{ uri: employee.avatar_url }} style={styles.tabAvatarImg} />
              ) : (
                <User size={size - 2} color={color} />
              )}
            </View>
          ),
        }}
      />

      {/* ── ARCHIVED — Money-related tabs hidden for all users ─── */}
      {/* To restore: remove href: null from the relevant screen   */}

      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ size, color }) => <Calendar size={size} color={color} />,
          href: null, // ARCHIVED — clock-in/out hidden
        }}
      />

      <Tabs.Screen
        name="paycheck"
        options={{
          title: "Paycheck",
          tabBarIcon: ({ size, color }) => <DollarSign size={size} color={color} />,
          href: null, // ARCHIVED — payroll hidden
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  tabAvatarImg: {
    width: "100%",
    height: "100%",
  },
});
