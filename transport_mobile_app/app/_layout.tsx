import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

function AppStack() {
  const { session, employee, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Wait until auth finishes loading
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!session || !employee) {
      // Not logged in or employee not loaded — send to login
      if (!inAuthGroup) {
        console.debug("[NAV] No valid session/employee, redirecting to login");
        router.replace("/auth/login");
      }
    } else {
      // Logged in AND employee profile verified — allow into app
      if (!inTabsGroup) {
        console.debug("[NAV] Session & Employee verified, entering app");
        router.replace("/(tabs)/dashboard");
      }
    }
  }, [session, employee, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppStack />
    </AuthProvider>
  );
}
