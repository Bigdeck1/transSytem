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
  Platform,
  Modal,
  Alert
} from 'react-native';
import { Calendar, Clock, DollarSign, ChevronRight, TrendingUp, CreditCard, X, FileText, ArrowDownCircle, ArrowUpCircle } from 'lucide-react-native';
import { supabase, Paycheck } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function PaycheckScreen() {
  const { employee, loading: authLoading } = useAuth();
  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPaycheck, setSelectedPaycheck] = useState<Paycheck | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee?.id) loadPaychecks();
    else if (!authLoading) setLoading(false);
  }, [employee?.id, authLoading]);

  const loadPaychecks = async () => {
    if (!employee?.id) return;
    try {
      setLoading(true);
      setError(null);

      // Race the Supabase query against a 10-second timeout so the
      // screen never hangs forever on a slow/paused Supabase project.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 10000)
      );
      const query = supabase
        .from('paychecks')
        .select('*')
        .eq('employee_id', employee.id)
        .order('payment_date', { ascending: false });

      const { data, error: fetchError } = await Promise.race([query, timeout]) as any;

      if (fetchError) throw fetchError;
      setPaychecks(data || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load payment history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => `₱${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  // Only block on local fetch loading — not authLoading — to avoid
  // the screen being stuck if auth takes too long to resolve.
  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>;
  }

  const renderPaycheck = (pay: Paycheck) => (
    <TouchableOpacity 
      key={pay.id} 
      style={styles.payCard}
      onPress={() => {
        setSelectedPaycheck(pay);
        setIsModalVisible(true);
      }}
    >
      <View style={styles.payHeader}>
        <View>
          <Text style={styles.payPeriod}>{formatDate(pay.pay_period_start)}</Text>
          <Text style={styles.paySub}>Ending {formatDate(pay.pay_period_end)}</Text>
        </View>
        <Text style={styles.payAmount}>{formatCurrency(pay.net_pay)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.payFooter}>
        <Text style={styles.payMetadata}>Hours: {pay.hours_worked}</Text>
        <View style={styles.viewDetails}>
          <Text style={styles.viewDetailsText}>Details</Text>
          <ChevronRight size={14} color="#3b82f6" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Payroll</Text>
          <View style={styles.headerRight}><CreditCard size={18} color="#64748b" /></View>
        </View>

        <ScrollView 
          style={styles.container} 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPaychecks} />}
        >
          {error && <Text style={styles.errorBanner}>{error}</Text>}

          {paychecks.length > 0 ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryLabel}>Latest Payout</Text>
                <View style={styles.statusPill}><Text style={styles.statusPillText}>Paid</Text></View>
              </View>
              <Text style={styles.summaryAmount}>{formatCurrency(paychecks[0].net_pay)}</Text>
              <View style={styles.summaryFooter}>
                <View style={styles.summaryItem}>
                  <Calendar size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.summaryItemText}>{formatDate(paychecks[0].payment_date || '')}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Clock size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.summaryItemText}>{paychecks[0].hours_worked} hrs</Text>
                </View>
              </View>
            </View>
          ) : (
             <View style={styles.summaryCardEmpty}>
                <DollarSign size={32} color="#94a3b8" />
                <Text style={styles.emptyText}>No payment data yet</Text>
             </View>
          )}

          <Text style={styles.sectionTitle}>History</Text>

          {paychecks.length === 0 ? (
            <View style={styles.emptyState}>
              <TrendingUp size={48} color="#e2e8f0" />
              <Text style={styles.emptyStateText}>No history available</Text>
            </View>
          ) : (
            paychecks.map(renderPaycheck)
          )}
          <View style={{height: 40}} />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
              <View style={styles.modalHeaderExtra}>
                 <View>
                    <Text style={styles.modalTitle}>Statement Details</Text>
                    <Text style={styles.modalSubtitle}>Period: {selectedPaycheck && formatDate(selectedPaycheck.pay_period_start)} - {selectedPaycheck && formatDate(selectedPaycheck.pay_period_end)}</Text>
                 </View>
                 <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                 <View style={styles.detailRowMain}>
                    <Text style={styles.detailLabelMain}>Net Payment</Text>
                    <Text style={styles.detailValueMain}>{selectedPaycheck ? formatCurrency(selectedPaycheck.net_pay) : ''}</Text>
                 </View>
                 
                 <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                       <View style={styles.detailIconLabel}>
                          <ArrowUpCircle size={18} color="#10b981" />
                          <Text style={styles.detailLabel}>Gross Earnings</Text>
                       </View>
                       <Text style={[styles.detailValue, { color: '#10b981' }]}>+ {selectedPaycheck ? formatCurrency(selectedPaycheck.gross_pay) : ''}</Text>
                    </View>
                    <View style={styles.detailRow}>
                       <View style={styles.detailIconLabel}>
                          <ArrowDownCircle size={18} color="#ef4444" />
                          <Text style={styles.detailLabel}>Total Deductions</Text>
                       </View>
                       <Text style={[styles.detailValue, { color: '#ef4444' }]}>- {selectedPaycheck ? formatCurrency(selectedPaycheck.deductions) : ''}</Text>
                    </View>
                 </View>

                 <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                       <View style={styles.detailIconLabel}>
                          <Clock size={18} color="#64748b" />
                          <Text style={styles.detailLabel}>Hours Worked</Text>
                       </View>
                       <Text style={styles.detailValue}>{selectedPaycheck?.hours_worked}h</Text>
                    </View>
                    <View style={styles.detailRow}>
                       <View style={styles.detailIconLabel}>
                          <Calendar size={18} color="#64748b" />
                          <Text style={styles.detailLabel}>Payment Date</Text>
                       </View>
                       <Text style={styles.detailValue}>{selectedPaycheck && formatDate(selectedPaycheck.payment_date || selectedPaycheck.created_at)}</Text>
                    </View>
                 </View>
              </View>
           </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 0 : 40, marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  headerRight: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingHorizontal: 20 },
  errorBanner: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 12, textAlign: 'center', marginBottom: 20 },
  summaryCard: {
    backgroundColor: '#1e40af',
    borderRadius: 28,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8
  },
  summaryCardEmpty: { height: 160, backgroundColor: '#f8fafc', borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#f1f5f9', borderStyle: 'dashed' },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  statusPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  summaryAmount: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, marginBottom: 20 },
  summaryFooter: { flexDirection: 'row', gap: 20 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryItemText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  payCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1
  },
  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  payPeriod: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  paySub: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
  payAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 16 },
  payFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payMetadata: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewDetailsText: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  emptyState: { alignItems: 'center', padding: 40, gap: 12 },
  emptyStateText: { color: '#94a3b8', fontSize: 15, fontWeight: '500' },
  emptyText: { color: '#94a3b8', marginTop: 8 },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeaderExtra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '500' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalBody: { marginBottom: 24 },
  detailRowMain: { backgroundColor: '#f8fafc', padding: 24, borderRadius: 24, alignItems: 'center', marginBottom: 20 },
  detailLabelMain: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  detailValueMain: { fontSize: 32, fontWeight: '800', color: '#1e293b' },
  detailSection: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', padding: 16, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  detailIconLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  detailValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  downloadBtn: { backgroundColor: '#1e40af', height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, shadowColor: '#1e40af', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  downloadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});

