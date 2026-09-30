import { Tabs, useRouter } from "expo-router";
import { Home, Truck, Calendar, User, DollarSign, FileClock, Bell } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useDriverLocationBroadcaster } from "@/hooks/useDriverLocationBroadcaster";
import { useAlarmNotifications } from "@/hooks/useAlarmNotifications";
import { useEffect } from "react";
import { View, ActivityIndicator, Image, StyleSheet } from "react-native";

export default function TabLayout() {
  const { employee, loading } = useAuth();
  const router = useRouter();

  // Continuously broadcast live GPS location when logged in
  useDriverLocationBroadcaster();
  // Listen for dispatch alarms
  useAlarmNotifications();

  useEffect(() => {
    // If we're fully loaded and have no employee, the user is likely logged out.
    // Ensure routing handles this, though auth bounds should usually catch it.
  }, [loading, employee]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  const isAdmin = employee?.position?.toLowerCase() === "admin" || employee?.position?.toLowerCase() === "owner" || employee?.position?.toLowerCase() === "manager";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1976D2",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: { backgroundColor: "#fff", height: 60, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="trips"
        options={{
          title: isAdmin ? "All Trips" : "My Trips",
          tabBarIcon: ({ size, color }) => (
            <Truck size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ size, color }) => (
            <Calendar size={size} color={color} />
          ),
          href: isAdmin ? null : undefined,
        }}
      />

      <Tabs.Screen
        name="paycheck"
        options={{
          title: "Paycheck",
          tabBarIcon: ({ size, color }) => (
            <DollarSign size={size} color={color} />
          ),
          href: isAdmin ? null : undefined,
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          title: "Leaves",
          tabBarIcon: ({ size, color }) => (
            <FileClock size={size} color={color} />
          ),
          href: isAdmin ? null : undefined,
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
      
      <Tabs.Screen
        name="notification"
        options={{
          title: "Alerts",
          tabBarIcon: ({ size, color }) => (
            <Bell size={size} color={color} />
          ),
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
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc'
  },
  tabAvatarImg: {
    width: '100%',
    height: '100%'
  }
});
