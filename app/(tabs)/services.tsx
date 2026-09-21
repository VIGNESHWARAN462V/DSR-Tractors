import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { ServiceMaster, ServiceTransaction } from '@/types/database';
import { machineryService } from '@/services/machineryService';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_SERVICE_RATES, formatCurrency } from '@/utils/calculations';
import { formatBillMessage, sendViaWhatsApp } from '@/utils/whatsapp';

export default function ServicesTab() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'calculator' | 'recent'>('calculator');
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ServiceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [srvRes, txRes] = await Promise.all([
        machineryService.getServices(),
        user ? machineryService.getRecentTransactions(user.id) : Promise.resolve({ data: [] }),
      ]);

      if (srvRes.data) setServices(srvRes.data);
      if (txRes.data) setRecentTransactions(txRes.data);
    } catch (e) {
      console.warn('Error loading services:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const serviceList =
    services.length > 0
      ? services
      : Object.entries(DEFAULT_SERVICE_RATES).map(([name, config], index) => ({
          id: `default-${index}`,
          name,
          unit: config.unit,
          rate: config.rate,
          has_worker_types: Boolean(config.workerRates),
          worker_rate: config.workerRates?.with_worker,
          no_worker_rate: config.workerRates?.without_worker,
          is_active: true,
          created_at: '',
          updated_at: '',
        }));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Machinery Services"
        subtitle="Calculators, master rates & jobs"
        rightAction={
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => router.push('/services/new' as any)}
          >
            <Ionicons name="add" size={26} color={Colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <Button
          title="+ Open Machinery Calculator"
          onPress={() => router.push('/services/new' as any)}
          style={styles.newTxBtn}
        />

        {/* View Switcher: Rates Master vs Recent Jobs */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'calculator' && styles.switchTabActive]}
            onPress={() => setActiveTab('calculator')}
          >
            <Text
              style={[
                styles.switchTabText,
                activeTab === 'calculator' && styles.switchTabTextActive,
              ]}
            >
              Standard Machine Rates
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'recent' && styles.switchTabActive]}
            onPress={() => setActiveTab('recent')}
          >
            <Text
              style={[
                styles.switchTabText,
                activeTab === 'recent' && styles.switchTabTextActive,
              ]}
            >
              Recent Jobs ({recentTransactions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activeTab === 'calculator' ? (
          <FlatList
            data={serviceList}
            keyExtractor={(item) => item.name}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Card style={styles.serviceCard}>
                <View style={styles.serviceRow}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    {item.has_worker_types ? (
                      <View style={styles.rateSplit}>
                        <Text style={styles.subRate}>
                          • ஆள் உண்டு: ₹{item.worker_rate || 100}/{item.unit}
                        </Text>
                        <Text style={styles.subRate}>
                          • ஆள் இல்லை: ₹{item.no_worker_rate || 75}/{item.unit}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.rateText}>
                        ₹{item.rate.toLocaleString('en-IN')} / {item.unit}
                      </Text>
                    )}
                  </View>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>{item.unit.toUpperCase()}</Text>
                  </View>
                </View>
              </Card>
            )}
          />
        ) : recentTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Services Recorded Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button above to calculate and save a new machinery job.
            </Text>
          </View>
        ) : (
          <FlatList
            data={recentTransactions}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Card style={styles.serviceCard}>
                <TouchableOpacity
                  onPress={() => router.push(`/services/${item.id}` as any)}
                >
                  <View style={styles.txRow}>
                    <View style={styles.txInfo}>
                      <Text style={styles.txCustomerName}>
                        {item.customer?.name || 'Customer'}
                      </Text>
                      <Text style={styles.txDate}>
                        {item.transaction_date} • {item.customer?.village || ''}
                      </Text>
                      <Text style={styles.txItemsSummary}>
                        {item.items && item.items.length > 0
                          ? item.items.map((i) => i.service_name).join(', ')
                          : 'Machinery Job'}
                      </Text>
                    </View>

                    <View style={styles.txAmountCol}>
                      <Text style={styles.txAmount}>
                        {formatCurrency(item.total_amount)}
                      </Text>
                      <TouchableOpacity
                        style={styles.whatsappChip}
                        onPress={() => {
                          const billMsg = formatBillMessage({
                            customerName: item.customer?.name || 'Customer',
                            customerPhone: item.customer?.phone,
                            date: item.transaction_date,
                            items: (item.items || []).map((i) => ({
                              serviceName: i.service_name,
                              quantity: i.quantity,
                              unit: i.unit,
                              rate: i.rate ?? i.unit_rate ?? 0,
                              amount: i.amount ?? i.total_amount ?? 0,
                              workerType: i.worker_type,
                            })),
                            totalAmount: item.total_amount,
                            notes: item.notes,
                          });
                          sendViaWhatsApp(billMsg, item.customer?.phone);
                        }}
                      >
                        <Ionicons name="logo-whatsapp" size={14} color="#15803D" />
                        <Text style={styles.whatsappChipText}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </Card>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  addIconBtn: {
    minWidth: Layout.touchTargetMin,
    minHeight: Layout.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newTxBtn: {
    marginBottom: Spacing.md,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  switchTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Layout.touchTargetMin,
  },
  switchTabActive: {
    backgroundColor: Colors.primarySoft,
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  switchTabText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textMuted,
  },
  switchTabTextActive: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  serviceCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  rateText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  rateSplit: {
    marginTop: Spacing.xs,
    gap: 2,
  },
  subRate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  tagPill: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.sm,
  },
  tagText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txInfo: {
    flex: 1,
  },
  txCustomerName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  txDate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  txItemsSummary: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginTop: 2,
    fontWeight: Typography.fontWeight.medium,
  },
  txAmountCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  txAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  whatsappChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  whatsappChipText: {
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
    color: '#15803D',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
