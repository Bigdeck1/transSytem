import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Truck } from "lucide-react-native";

function normalizeEmployeeId(value: string) {
  return (value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function normalizePin(value: string) {
  return (value ?? "").trim().replace(/\s+/g, "").slice(0, 4);
}

export default function LoginScreen() {
  const { signIn, loading } = useAuth();

  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleAuth = async () => {
    setError("");

    const normalizedEmployeeId = normalizeEmployeeId(employeeId);
    const normalizedPin = normalizePin(pin);

    try {
      if (!normalizedEmployeeId) {
        throw new Error("Please enter your Employee ID");
      }

      if (!normalizedPin) {
        throw new Error("Please enter your PIN");
      }

      if (normalizedPin.length !== 4) {
        throw new Error("PIN must be 4 digits");
      }

      await signIn(normalizedEmployeeId, normalizedPin);

    } catch (err: any) {
      setError(err?.message || "Authentication failed");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Truck size={48} color="#0D47A1" />
          <Text style={styles.title}>JRR Transport</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          placeholder="Employee ID"
          style={styles.input}
          value={employeeId}
          onChangeText={(text) => {
            setEmployeeId(normalizeEmployeeId(text));
            if (error) setError("");
          }}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TextInput
          placeholder="PIN (4 digits)"
          secureTextEntry
          style={styles.input}
          value={pin}
          onChangeText={(text) => {
            setPin(normalizePin(text));
            if (error) setError("");
          }}
          maxLength={4}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
        />

        <Text style={styles.hint}>Enter your 4-digit employee PIN provided by your Admin.</Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  content: { padding: 24, justifyContent: "center", flexGrow: 1 },
  header: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 28, fontWeight: "800", marginTop: 12, color: "#0D47A1" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 15,
  },
  hint: {
    color: "#64748B",
    marginBottom: 10,
    marginTop: -4,
    fontSize: 13,
    textAlign: "center"
  },
  button: {
    backgroundColor: "#1976D2",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#0D47A1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  error: {
    color: "#dc2626",
    marginBottom: 12,
    textAlign: "center"
  },
});