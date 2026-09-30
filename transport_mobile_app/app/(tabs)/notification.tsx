import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform
} from 'react-native';
import { DollarSign, Megaphone, AlertCircle, CheckCircle, Bell, Trash2, ChevronRight, Info } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  employee_id: string;
  title: string;
  message: string;
  type: 'paycheck' | 'announcement' | 'alert' | 'other';
  urgency?: 'low' | 'normal' | 'urgent' | 'alarm';
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
        .from('notifications')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setNotifications((data as Notification[]) ?? []);
    } catch (err: any) {
      setError('Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    } catch (err) { console.warn('Failed to sync read status'); }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getIcon = (type: Notification['type'], urgency?: Notification['urgency']) => {
    if (urgency === 'alarm' || type === 'alert') {
      return { icon: <AlertCircle size={20} color="#dc2626" />, bg: '#fee2e2' };
    }
    switch (type) {
      case 'paycheck': return { icon: <DollarSign size={20} color="#1e40af" />, bg: '#eff6ff' };
      case 'announcement': return { icon: <Megaphone size={20} color="#0891b2" />, bg: '#ecfeff' };
      default: return { icon: <Info size={20} color="#16a34a" />, bg: '#f0fdf4' };
    }
  };

  if (loading || authLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>;
  }

  const unread = notifications.filter(n => !n.is_read);

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Notifications & Alarms</Text>
          <View style={styles.headerRight}>
             {unread.length > 0 && <View style={styles.unreadCountBadge}><Text style={styles.unreadCountText}>{unread.length}</Text></View>}
             <Bell size={18} color="#64748b" />
          </View>
        </View>

        <ScrollView 
          style={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadNotifications} />}
        >
          {error && <Text style={styles.errorText}>{error}</Text>}

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Bell size={48} color="#e2e8f0" /></View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>We'll notify you here when dispatches, alarms, or payroll updates happen.</Text>
            </View>
          ) : (
            notifications.map((n) => {
              const isAlarm = n.urgency === 'alarm' || n.type === 'alert';
              const { icon, bg } = getIcon(n.type, n.urgency);
              return (
                <TouchableOpacity 
                  key={n.id} 
                  style={[
                    styles.notiCard, 
                    !n.is_read && styles.notiUnread,
                    isAlarm && styles.alarmCard
                  ]}
                  onPress={() => markAsRead(n.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBox, { backgroundColor: bg }]}>{icon}</View>
                  <View style={styles.content}>
                    <View style={styles.contentHeader}>
                       <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                         {isAlarm && <Text style={styles.alarmPill}>🚨 ALARM</Text>}
                         <Text style={[styles.notiTitle, !n.is_read && { color: '#0f172a', fontWeight: '700' }]}>{n.title}</Text>
                       </View>
                       <Text style={styles.notiTime}>{formatTimestamp(n.created_at)}</Text>
                    </View>
                    <Text style={styles.notiMsg} numberOfLines={2}>{n.message}</Text>
                  </View>
                  {!n.is_read && <View style={[styles.blueDot, isAlarm && { backgroundColor: '#dc2626' }]} />}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 0 : 40, marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  headerRight: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  unreadCountBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', zIndex: 1 },
  unreadCountText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  container: { flex: 1, paddingHorizontal: 16 },
  errorText: { color: "#ef4444", textAlign: "center", margin: 16 },
  notiCard: { flexDirection: 'row', padding: 16, borderRadius: 24, backgroundColor: '#fff', marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  notiUnread: { backgroundColor: '#f0f7ff', borderColor: '#dbeafe' },
  alarmCard: { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1.5 },
  alarmPill: { backgroundColor: '#ef4444', color: '#fff', fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  content: { flex: 1 },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  notiTitle: { fontSize: 15, fontWeight: '600', color: '#475569' },
  notiTime: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  notiMsg: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  blueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginLeft: 8 },
  empty: { alignItems: 'center', padding: 60, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  emptySub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 }
});

