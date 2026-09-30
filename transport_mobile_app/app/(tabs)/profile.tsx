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
  Image
} from "react-native";
import { useAuth, type EmployeeData } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
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
  Camera
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";

type UserSession = {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
      employee_id?: string;
    };
  };
};

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
      if (status !== 'granted') {
        return Alert.alert("Permission Required", "Sorry, we need camera roll permissions to make this work!");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
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
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${employee.id}/${Date.now()}.${fileExt}`;
      
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      } as any);

      // 2. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, { 
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 4. Update Database
      const { data, error: updateError } = await supabase
        .from('employees')
        .update({ avatar_url: publicUrl })
        .eq('id', employee.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updated = data as EmployeeData;
      setEmployee(updated);
      if (setAuthEmployee) setAuthEmployee(updated);

      Alert.alert("Success", "Profile photo updated!");
    } catch (err: any) {
      console.error("Upload error:", err);
      Alert.alert("Upload Failed", "Please ensure an 'avatars' storage bucket exists in your Supabase project.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of the JRR Transport portal? You will need to enter your credentials again to access your account.",
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
          }
        }
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
          phone: editPhone.trim()
        })
        .eq("id", employee.id)
        .select()
        .single();

      if (error) throw error;

      // Update both local and context state
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

  const MenuSection = ({ title, items }: { title: string, items: any[] }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.menuContainer}>
        {items.map((item, idx) => (
          <TouchableOpacity 
            key={idx} 
            style={[styles.menuItem, idx === items.length - 1 && { borderBottomWidth: 0 }]} 
            onPress={item.onPress || (() => Alert.alert(item.label, "Coming soon!"))}
          >
            <View style={[styles.iconWrapper, { backgroundColor: item.bg || '#f1f5f9' }]}>
              {item.icon}
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.value && <Text style={styles.menuValue} numberOfLines={1}>{item.value}</Text>}
            </View>
            <ChevronRight size={16} color="#cbd5e1" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          
          {/* --- HEADER --- */}
          <View style={styles.header}>
            <View style={styles.avatarWrapper}>
              <TouchableOpacity style={styles.avatar} onPress={handlePickImage} activeOpacity={0.9}>
                {isUploading ? (
                  <ActivityIndicator color="#1e40af" />
                ) : employee?.avatar_url ? (
                  <Image source={{ uri: employee.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <User size={40} color="#1e40af" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.editBadge} onPress={handlePickImage}>
                <Camera size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>{employee?.full_name || "Employee"}</Text>
            <Text style={styles.userRole}>{employee?.position || "Staff"} • {employee?.department || "Operations"}</Text>
          </View>

          {/* --- QUICK STATS --- */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{employee?.status || "Active"}</Text>
              <Text style={styles.statLab}>Status</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{employee?.employee_id?.slice(0, 5) || "SYS"}</Text>
              <Text style={styles.statLab}>ID</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>v2.3</Text>
              <Text style={styles.statLab}>App</Text>
            </View>
          </View>

          {/* --- MENU GROUPS --- */}
          <MenuSection 
            title="Account Details"
            items={[
              { icon: <User size={18} color="#1e40af" />, label: "Update Profile Photo", onPress: handlePickImage, bg: '#eff6ff' },
              { icon: <Settings size={18} color="#1e40af" />, label: "Edit Personal Info", onPress: () => setIsEditModalVisible(true), bg: '#eff6ff' },
              { icon: <Mail size={18} color="#1e40af" />, label: "Email", value: employee?.email || session?.user?.email, bg: '#eff6ff' },
              { icon: <Phone size={18} color="#1e40af" />, label: "Phone", value: employee?.phone || "Not set", bg: '#eff6ff' },
            ]}
          />

          <MenuSection 
            title="Preferences"
            items={[
              { icon: <Bell size={18} color="#f59e0b" />, label: "Notifications", onPress: () => setIsNotifModalVisible(true), bg: '#fffbeb' },
              { icon: <Shield size={18} color="#10b981" />, label: "Privacy & Security", onPress: () => setIsPrivacyModalVisible(true), bg: '#ecfdf5' },
              { icon: <HelpCircle size={18} color="#6366f1" />, label: "Help Center", onPress: () => setIsHelpModalVisible(true), bg: '#eef2ff' },
            ]}
          />

          {/* --- DEBUG STORAGE TOOL --- */}
          {__DEV__ && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>System Debug</Text>
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#fefce8', borderColor: '#fef08a' }]}
                onPress={async () => {
                  try {
                    const { data, error } = await supabase.storage.listBuckets();
                    if (error) throw error;
                    const names = data.map(b => b.name).join(', ') || 'No buckets found';
                    Alert.alert("Available Buckets", `Found: ${names}\n\nApp is looking for: 'avatars'`);
                  } catch (err: any) {
                    Alert.alert("Debug Error", `Could not list buckets: ${err.message}\n\nTip: Ensure the 'anon' role has SELECT permissions on 'storage.buckets' or just manually ensure 'avatars' exists.`);
                  }
                }}
              >
                <View style={[styles.iconWrapper, { backgroundColor: '#fef9c3' }]}>
                  <Info size={18} color="#854d0e" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuLabel, { color: '#854d0e' }]}>Debug Storage Buckets</Text>
                  <Text style={styles.menuValue}>Verify connection to Supabase</Text>
                </View>
                <ChevronRight size={16} color="#ca8a04" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
            <LogOut size={18} color="#ef4444" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
             <Info size={14} color="#94a3b8" />
             <Text style={styles.footerText}>JRR Transport Services Portal</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* --- EDIT MODAL --- */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
           <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Update Profile</Text>
                 <TouchableOpacity onPress={() => setIsEditModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                 <Text style={styles.editLabel}>Full Name</Text>
                 <View style={styles.editInputWrapper}>
                   <User size={18} color="#94a3b8" style={{marginLeft: 12}} />
                   <TextInput
                      style={styles.editInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter full name"
                   />
                 </View>

                 <Text style={styles.editLabel}>Phone Number</Text>
                 <View style={styles.editInputWrapper}>
                   <Phone size={18} color="#94a3b8" style={{marginLeft: 12}} />
                   <TextInput
                      style={styles.editInput}
                      value={editPhone}
                      onChangeText={setEditPhone}
                      placeholder="e.g. +63 912 345 6789"
                      keyboardType="phone-pad"
                   />
                 </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile} disabled={isSaving}>
                 {isSaving ? <ActivityIndicator color="#fff" /> : (
                   <>
                     <Check size={18} color="#fff" />
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
                 <Text style={styles.modalTitle}>Notifications</Text>
                 <TouchableOpacity onPress={() => setIsNotifModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                 <TouchableOpacity style={styles.settingRow} onPress={() => setPushEnabled(!pushEnabled)}>
                    <Text style={styles.settingLabel}>Push Notifications</Text>
                    <View style={[styles.toggle, pushEnabled && styles.toggleActive]}>
                       <View style={[styles.toggleDot, pushEnabled && styles.toggleDotActive]} />
                    </View>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.settingRow} onPress={() => setSmsEnabled(!smsEnabled)}>
                    <Text style={styles.settingLabel}>SMS Alerts</Text>
                    <View style={[styles.toggle, smsEnabled && styles.toggleActive]}>
                       <View style={[styles.toggleDot, smsEnabled && styles.toggleDotActive]} />
                    </View>
                 </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={() => setIsNotifModalVisible(false)}>
                 <Text style={styles.saveBtnText}>Done</Text>
              </TouchableOpacity>
           </View>
        </View>
      </Modal>

      {/* --- PRIVACY MODAL --- */}
      <Modal visible={isPrivacyModalVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
           <View style={[styles.modalContent, { borderRadius: 24, padding: 32 }]}>
              <Shield size={48} color="#10b981" style={{alignSelf: 'center', marginBottom: 16}} />
              <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 8 }]}>Privacy & Security</Text>
              <Text style={{ textAlign: 'center', color: '#64748b', lineHeight: 20, marginBottom: 24 }}>
                Your data is encrypted and stored securely in our enterprise cloud. JRR Transport complies with all data protection standards to ensure your personal information remains private.
              </Text>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#10b981' }]} onPress={() => setIsPrivacyModalVisible(false)}>
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
                 <Text style={styles.modalTitle}>Help Center</Text>
                 <TouchableOpacity onPress={() => setIsHelpModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                 <TouchableOpacity style={styles.helpItem} onPress={() => Alert.alert("Support", "Connecting to live agent...")}>
                    <Text style={styles.helpItemTitle}>Contact Support</Text>
                    <ChevronRight size={16} color="#94a3b8" />
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.helpItem}>
                    <Text style={styles.helpItemTitle}>Frequently Asked Questions</Text>
                    <ChevronRight size={16} color="#94a3b8" />
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.helpItem}>
                    <Text style={styles.helpItemTitle}>Privacy Policy</Text>
                    <ChevronRight size={16} color="#94a3b8" />
                 </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={() => setIsHelpModalVisible(false)}>
                 <Text style={styles.saveBtnText}>Go Back</Text>
              </TouchableOpacity>
           </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#fff" },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { alignItems: "center", paddingTop: 40, paddingBottom: 24 },
  avatarWrapper: { position: "relative", marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center", borderWidth: 4, borderColor: "#fff", shadowColor: "#1e40af", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  editBadge: { position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: "#1e40af", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  userName: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  userRole: { fontSize: 14, color: "#64748b", marginTop: 4, fontWeight: "500" },
  statsRow: { flexDirection: "row", backgroundColor: "#f8fafc", marginHorizontal: 20, borderRadius: 20, padding: 16, marginBottom: 32 },
  statBox: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  statLab: { fontSize: 11, color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", marginTop: 2 },
  statDivider: { width: 1, height: "100%", backgroundColor: "#e2e8f0" },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginLeft: 4, marginBottom: 12 },
  menuContainer: { backgroundColor: "#fff", borderRadius: 24, padding: 8, borderWidth: 1, borderColor: "#f1f5f9" },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  iconWrapper: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  menuContent: { flex: 1, marginLeft: 16 },
  menuLabel: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  menuValue: { fontSize: 12, color: "#64748b", marginTop: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 20, height: 56, borderRadius: 16, backgroundColor: "#fef2f2", marginTop: 8 },
  logoutText: { fontSize: 16, fontWeight: "700", color: "#ef4444" },
  footer: { alignItems: "center", marginTop: 32, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalBody: { gap: 16, marginBottom: 24 },
  editLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: -8 },
  editInputWrapper: { flexDirection: 'row', alignItems: 'center', height: 54, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  editInput: { flex: 1, paddingHorizontal: 12, fontSize: 16, fontWeight: '600', color: '#1e293b' },
  saveBtn: { backgroundColor: '#1e40af', height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowColor: '#1e40af', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  // Setting & Toggle Styles
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0', padding: 2 },
  toggleActive: { backgroundColor: '#10b981' },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleDotActive: { transform: [{ translateX: 20 }] },
  helpItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  helpItemTitle: { fontSize: 16, fontWeight: '500', color: '#334155' }
});