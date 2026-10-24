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
  Modal,
  Alert,
} from "react-native";
import { useAuth, DeviceLockError } from "@/contexts/AuthContext";
import { Truck, ShieldAlert, Smartphone, ArrowRight, RefreshCw, CheckCircle2, Clock } from "lucide-react-native";
import { submitDeviceTransferRequest, checkTransferRequestApproval } from "@/lib/deviceService";

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

  // Device Lock Modal State
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [lockInfo, setLockInfo] = useState<{
    driverId: string;
    driverName: string;
    boundDeviceId: string;
    boundDeviceModel: string;
    currentDeviceId: string;
    currentDeviceModel: string;
    pendingRequest: any;
  } | null>(null);

  const [transferReason, setTransferReason] = useState("Switched to replacement phone");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [transferSuccessMessage, setTransferSuccessMessage] = useState("");

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
      if (err instanceof DeviceLockError || err?.isDeviceLocked) {
        setLockInfo({
          driverId: err.driverId,
          driverName: err.driverName,
          boundDeviceId: err.boundDeviceId,
          boundDeviceModel: err.boundDeviceModel,
          currentDeviceId: err.currentDeviceId,
          currentDeviceModel: err.currentDeviceModel,
          pendingRequest: err.pendingRequest,
        });
        setLockModalVisible(true);
      } else {
        setError(err?.message || "Authentication failed");
      }
    }
  };

  const handleSubmitTransfer = async () => {
    if (!lockInfo) return;
    setIsSubmittingTransfer(true);
    setTransferSuccessMessage("");

    try {
      const res = await submitDeviceTransferRequest(
        lockInfo.driverId,
        lockInfo.boundDeviceId,
        lockInfo.currentDeviceId,
        lockInfo.currentDeviceModel,
        transferReason
      );

      if (res.success) {
        setTransferSuccessMessage(
          "Transfer request submitted successfully. Please inform your administrator or IT supervisor to approve this device."
        );
        setLockInfo((prev) =>
          prev
            ? {
                ...prev,
                pendingRequest: res.data || { status: "pending" },
              }
            : null
        );
      } else {
        Alert.alert("Submission Error", res.error || "Failed to submit request.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit transfer request.");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleCheckApproval = async () => {
    if (!lockInfo) return;
    setIsCheckingApproval(true);

    try {
      const check = await checkTransferRequestApproval(
        lockInfo.driverId,
        lockInfo.currentDeviceId
      );

      if (check.isApproved) {
        Alert.alert(
          "Device Approved!",
          "Administrator has approved your device transfer. You can now sign in with your PIN.",
          [
            {
              text: "Sign In Now",
              onPress: () => {
                setLockModalVisible(false);
                handleAuth();
              },
            },
          ]
        );
      } else if (check.status === "rejected") {
        Alert.alert(
          "Request Rejected",
          "Your device transfer request was rejected by administration. Please contact your supervisor."
        );
      } else {
        Alert.alert(
          "Still Pending",
          "Your device transfer request is currently awaiting Administrator approval in the Admin Console."
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to verify approval status.");
    } finally {
      setIsCheckingApproval(false);
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
          <View style={styles.logoBadge}>
            <Truck size={36} color="#0D47A1" />
          </View>
          <Text style={styles.title}>JRR Transport</Text>
          <Text style={styles.subtitle}>Driver Fleet Portal & Mobile Console</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>EMPLOYEE ID</Text>
          <TextInput
            placeholder="e.g. EMP-001"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={employeeId}
            onChangeText={(text) => {
              setEmployeeId(normalizeEmployeeId(text));
              if (error) setError("");
            }}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>SECURITY PIN (4 DIGITS)</Text>
          <TextInput
            placeholder="••••"
            placeholderTextColor="#94A3B8"
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
        </View>

        <Text style={styles.hint}>
          Under company security policy, your account is bound to your physical mobile device.
        </Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnContent}>
              <Text style={styles.buttonText}>Sign In to Fleet</Text>
              <ArrowRight size={18} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* --- DEVICE LOCK & TRANSFER MODAL --- */}
      <Modal
        visible={lockModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.lockIconBadge}>
                <ShieldAlert size={28} color="#DC2626" />
              </View>
              <Text style={styles.modalTitle}>Device Lock Enforced</Text>
              <Text style={styles.modalSubtitle}>
                1-Driver, 1-Device Policy Active
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={styles.lockDesc}>
                Driver <Text style={{ fontWeight: "700" }}>{lockInfo?.driverName}</Text> is registered to a different physical phone. You cannot log in from an unapproved device.
              </Text>

              <View style={styles.deviceCompareBox}>
                <View style={styles.deviceRow}>
                  <Text style={styles.deviceLabel}>Registered Phone:</Text>
                  <Text style={styles.deviceVal} numberOfLines={1}>
                    {lockInfo?.boundDeviceModel || "Previous Device"}
                  </Text>
                  <Text style={styles.deviceIdSmall}>{lockInfo?.boundDeviceId}</Text>
                </View>

                <View style={[styles.deviceRow, { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 10, marginTop: 10 }]}>
                  <Text style={styles.deviceLabel}>This Phone (Current):</Text>
                  <Text style={[styles.deviceVal, { color: "#0284C7" }]} numberOfLines={1}>
                    {lockInfo?.currentDeviceModel}
                  </Text>
                  <Text style={styles.deviceIdSmall}>{lockInfo?.currentDeviceId}</Text>
                </View>
              </View>

              {lockInfo?.pendingRequest ? (
                <View style={styles.pendingBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Clock size={16} color="#D97706" />
                    <Text style={styles.pendingTitle}>Transfer Request Pending Approval</Text>
                  </View>
                  <Text style={styles.pendingText}>
                    An administrator has been notified. Tap below to check if your transfer request has been granted.
                  </Text>

                  <TouchableOpacity
                    style={styles.checkBtn}
                    onPress={handleCheckApproval}
                    disabled={isCheckingApproval}
                  >
                    {isCheckingApproval ? (
                      <ActivityIndicator color="#0D47A1" size="small" />
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <RefreshCw size={15} color="#0D47A1" />
                        <Text style={styles.checkBtnText}>Check Approval Status</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.requestForm}>
                  <Text style={styles.formTitle}>Request Device Transfer</Text>
                  <Text style={styles.formSubtitle}>
                    If you replaced or lost your phone, submit a transfer request for Administrator authorization:
                  </Text>

                  <TextInput
                    style={styles.reasonInput}
                    value={transferReason}
                    onChangeText={setTransferReason}
                    placeholder="Reason for changing mobile device..."
                    placeholderTextColor="#94A3B8"
                    multiline
                  />

                  {transferSuccessMessage ? (
                    <View style={styles.successBox}>
                      <CheckCircle2 size={16} color="#16A34A" />
                      <Text style={styles.successText}>{transferSuccessMessage}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.submitTransferBtn, isSubmittingTransfer && { opacity: 0.7 }]}
                    onPress={handleSubmitTransfer}
                    disabled={isSubmittingTransfer}
                  >
                    {isSubmittingTransfer ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.submitTransferBtnText}>Submit Transfer to Admin</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setLockModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, justifyContent: "center", flexGrow: 1 },
  header: { alignItems: "center", marginBottom: 28 },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: "500" },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    fontSize: 15,
    color: "#0F172A",
  },
  hint: {
    color: "#64748B",
    marginBottom: 16,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#0284C7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.65 },
  btnContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    marginBottom: 16,
  },
  error: { color: "#DC2626", fontSize: 13, textAlign: "center", fontWeight: "600" },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: { alignItems: "center", marginBottom: 16 },
  lockIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 19, fontWeight: "800", color: "#0F172A" },
  modalSubtitle: { fontSize: 12, color: "#DC2626", fontWeight: "700", marginTop: 2 },
  lockDesc: { fontSize: 13, color: "#475569", lineHeight: 18, marginBottom: 14, textAlign: "center" },
  deviceCompareBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  deviceRow: { marginBottom: 2 },
  deviceLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase" },
  deviceVal: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginTop: 2 },
  deviceIdSmall: { fontSize: 11, color: "#94A3B8", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", marginTop: 1 },
  pendingBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginBottom: 14,
  },
  pendingTitle: { fontSize: 13, fontWeight: "700", color: "#B45309" },
  pendingText: { fontSize: 12, color: "#92400E", lineHeight: 16, marginTop: 4 },
  checkBtn: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  checkBtnText: { fontSize: 13, fontWeight: "700", color: "#0D47A1" },
  requestForm: { marginTop: 4, marginBottom: 14 },
  formTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  formSubtitle: { fontSize: 12, color: "#64748B", marginBottom: 10, lineHeight: 16 },
  reasonInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 10,
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: "top",
    color: "#0F172A",
    marginBottom: 10,
  },
  submitTransferBtn: {
    backgroundColor: "#0D47A1",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  submitTransferBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  successText: { fontSize: 12, color: "#166534", flex: 1, lineHeight: 16 },
  closeBtn: {
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
  },
  closeBtnText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
});