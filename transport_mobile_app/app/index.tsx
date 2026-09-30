import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { session, employee, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  if (session && employee) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/auth/login" />;
}
