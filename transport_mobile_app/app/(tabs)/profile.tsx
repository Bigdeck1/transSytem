import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useAuth, type EmployeeData } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Shield,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Settings,
  Info,
  Check,
  X,
  Camera,
  IdCard,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Colors, moderateScale, isTablet, isSmallDevice } from "@/constants/theme";

export default function ProfileTab() {
  const { session, employee: authEmployee, signOut, setEmployee: setAuthEmployee } = useAuth();

  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeData | null>(authEmployee ?? null);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isNotifModalVisible, setIsNotifModalVisible] = useState(false);
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Settings state (mock)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  useEffect(() => {
    setEmployee(authEmployee ?? null);
    if (authEmployee) {
      setEditName(authEmployee.full_name || "");
      setEditPhone(authEmployee.phone || "");
    }
  }, [authEmployee]);

  const handlePickImage = async () => {
    if (!employee?.id) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert(
          "Permission Required",
          "Please grant camera roll permissions to change your avatar."
        );
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Pick image failed:", err);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!employee?.id) return;
    setIsUploading(true);

    try {
      const fileExt = uri.split(".").pop()?.toLowerCase() || "png";
      const fileName = `${employee.id}/${Date.now()}.${fileExt}`;

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: fileName,
        type: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, formData, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { data, error: updateError } = await supabase
        .from("employees")
        .update({ avatar_url: publicUrl })
        .eq("id", employee.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updated = data as EmployeeData;
      setEmployee(updated);
      if (setAuthEmployee) setAuthEmployee(updated);

      Alert.alert("Success", "Profile photo updated!");
    } catch (err: any) {
      console.error("Upload error:", err);
      Alert.alert(
        "Upload Failed",
        "Could not update photo. Please check your network connection."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of the JRR Transport portal?",
      [
        { text: "Stay Logged In", style: "cancel" },
        {
          text: "Yes, Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/auth");
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to sign out");
            }
          },
        },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!employee?.id) return;
    if (!editName.trim()) return Alert.alert("Error", "Full Name cannot be empty.");

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim(),
        })
        .eq("id", employee.id)
        .select()
        .single();

      if (error) throw error;

      const updated = data as EmployeeData;
      setEmployee(updated);
      if (setAuthEmployee) setAuthEmployee(updated);

      setIsEditModalVisible(false);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (err: any) {
      Alert.alert("Update Failed", err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const MenuSection = ({ title, items }: { title: string; items: any[] }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.menuContainer}>
        {items.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.menuItem, idx === items.length - 1 && { borderBottomWidth: 0 }]}
            onPress={item.onPress || (() => Alert.alert(item.label, "Coming soon!"))}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: item.bg || Colors.primarySoft }]}>
              {item.icon}
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.value && (
                <Text style={styles.menuValue} numberOfLines={1}>
                  {item.value}
                </Text>
              )}
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const hPadding = isSmallDevice ? 14 : isTablet ? 28 : 18;

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {/* --- TOP PROFILE HEADER --- */}
          <View style={styles.header}>
            <View style={styles.avatarWrapper}>
              <TouchableOpacity
                style={styles.avatar}
                onPress={handlePickImage}
                activeOpacity={0.85}
              >
                {isUploading ? (
                  <ActivityIndicator color={Colors.primaryNavy} />
                ) : employee?.avatar_url ? (
                  <Image source={{ uri: employee.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <User size={moderateScale(38)} color={Colors.primaryNavy} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBadge}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <Camera size={13} color={Colors.textWhite} />
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>{employee?.full_name || "Employee"}</Text>
            <Text style={styles.userRole}>
              {employee?.position || "Operations Staff"} • {employee?.department || "Dispatch"}
            </Text>
          </View>

          {/* --- SUMMARY STATS BAR --- */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{employee?.status || "Active"}</Text>
              <Text style={styles.statLab}>Status</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{employee?.employee_id?.slice(0, 7) || "EMP"}</Text>
              <Text style={styles.statLab}>Staff ID</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>Internal</Text>
              <Text style={styles.statLab}>Portal</Text>
            </View>
          </View>

          {/* --- MENU GROUPS --- */}
          <MenuSection
            title="Account & Contact"
            items={[
              {
                icon: <User size={18} color={Colors.primaryNavy} />,
                label: "Update Profile Photo",
                onPress: handlePickImage,
                bg: Colors.primarySoft,
              },
              {
                icon: <Settings size={18} color={Colors.primaryNavy} />,
                label: "Edit Personal Information",
                onPress: () => setIsEditModalVisible(true),
                bg: Colors.primarySoft,
              },
              {
                icon: <Mail size={18} color={Colors.primaryNavy} />,
                label: "Company Email",
                value: employee?.email || session?.user?.email || "Not specified",
                bg: Colors.primarySoft,
              },
              {
                icon: <Phone size={18} color={Colors.primaryNavy} />,
                label: "Mobile Contact",
                value: employee?.phone || "Not set",
                bg: Colors.primarySoft,
              },
            ]}
          />

          <MenuSection
            title="Preferences & Safety"
            items={[
              {
                icon: <Bell size={18} color={Colors.warning} />,
                label: "Notifications & Alarms",
                onPress: () => setIsNotifModalVisible(true),
                bg: Colors.warningSoft,
              },
              {
                icon: <Shield size={18} color={Colors.success} />,
                label: "Security & Privacy",
                onPress: () => setIsPrivacyModalVisible(true),
                bg: Colors.successSoft,
              },
              {
                icon: <HelpCircle size={18} color={Colors.info} />,
                label: "Operations Help Center",
                onPress: () => setIsHelpModalVisible(true),
                bg: Colors.infoSoft,
              },
            ]}
          />

          {/* Sign Out Button */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <LogOut size={18} color={Colors.danger} />
            <Text style={styles.logoutText}>Sign Out from Portal</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Info size={14} color={Colors.textMuted} />
            <Text style={styles.footerText}>JRR Transport Services • Internal Fleet System</Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>

      {/* --- EDIT PERSONAL INFO MODAL --- */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Information</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.editLabel}>Full Name</Text>
              <View style={styles.editInputWrapper}>
                <User size={18} color={Colors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter full name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <Text style={styles.editLabel}>Phone Number</Text>
              <View style={styles.editInputWrapper}>
                <Phone size={18} color={Colors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.editInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="e.g. +63 912 345 6789"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleUpdateProfile}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.textWhite} />
              ) : (
                <>
                  <Check size={18} color={Colors.textWhite} />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- NOTIFICATIONS MODAL --- */}
      <Modal visible={isNotifModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Settings</Text>
              <TouchableOpacity
                onPress={() => setIsNotifModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setPushEnabled(!pushEnabled)}
              >
                <Text style={styles.settingLabel}>Dispatch Push Alerts</Text>
                <View style={[styles.toggle, pushEnabled && styles.toggleActive]}>
                  <View style={[styles.toggleDot, pushEnabled && styles.toggleDotActive]} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setSmsEnabled(!smsEnabled)}
              >
                <Text style={styles.settingLabel}>SMS Dispatch Alerts</Text>
                <View style={[styles.toggle, smsEnabled && styles.toggleActive]}>
                  <View style={[styles.toggleDot, smsEnabled && styles.toggleDotActive]} />
                </View>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => setIsNotifModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- PRIVACY MODAL --- */}
      <Modal visible={isPrivacyModalVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { justifyContent: "center", padding: 20 }]}>
          <View style={[styles.modalContent, { borderRadius: 24, padding: 28 }]}>
            <Shield
              size={44}
              color={Colors.success}
              style={{ alignSelf: "center", marginBottom: 14 }}
            />
            <Text style={[styles.modalTitle, { textAlign: "center", marginBottom: 8 }]}>
              Security & Privacy
            </Text>
            <Text
              style={{
                textAlign: "center",
                color: Colors.textSecondary,
                lineHeight: 20,
                fontSize: moderateScale(13),
                marginBottom: 20,
              }}
            >
              All driver and fleet operations data is encrypted end-to-end. Telematics, locations, and trip logs are strictly retained in compliance with enterprise transportation protocols.
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: Colors.primaryNavy }]}
              onPress={() => setIsPrivacyModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- HELP MODAL --- */}
      <Modal visible={isHelpModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Operations Help</Text>
              <TouchableOpacity
                onPress={() => setIsHelpModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.helpItem}
                onPress={() => Alert.alert("Dispatch Hotline", "Dialing dispatcher desk...")}
              >
                <Text style={styles.helpItemTitle}>Contact Dispatch Desk</Text>
                <ChevronRight size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.helpItem}
                onPress={() => Alert.alert("Emergency", "Contacting fleet road assistance...")}
              >
                <Text style={styles.helpItemTitle}>Roadside Emergency Support</Text>
                <ChevronRight size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => setIsHelpModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 12 : 24,
    paddingBottom: 20,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: moderateScale(90),
    height: moderateScale(90),
    borderRadius: moderateScale(45),
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryNavy,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.card,
  },
  userName: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  userRole: {
    fontSize: moderateScale(13),
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statVal: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  statLab: {
    fontSize: moderateScale(11),
    color: Colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: Colors.border,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 4,
    marginBottom: 8,
  },
  menuContainer: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuLabel: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  menuValue: {
    fontSize: moderateScale(12),
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.dangerSoft,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    marginTop: 8,
  },
  logoutText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: Colors.danger,
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontSize: moderateScale(11),
    color: Colors.textMuted,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    backgroundColor: Colors.cardSecondary,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    gap: 14,
    marginBottom: 20,
  },
  editLabel: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: -6,
  },
  editInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.primaryNavy,
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: Colors.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    color: Colors.textWhite,
    fontSize: moderateScale(15),
    fontWeight: "700",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingLabel: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: Colors.success,
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.card,
  },
  toggleDotActive: {
    transform: [{ translateX: 20 }],
  },
  helpItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  helpItemTitle: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: Colors.textPrimary,
  },
});