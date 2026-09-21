import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { Customer, CustomerFinancialSummary, Payment, ServiceTransaction } from '@/types/database';
import { customerService } from '@/services/customerService';
import { formatCurrency } from '@/utils/calculations';
import { sendViaWhatsApp } from '@/utils/whatsapp';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<CustomerFinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<ServiceTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<'services' | 'payments'>('services');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const [custRes, sumRes, histRes] = await Promise.all([
        customerService.getCustomerById(id),
        customerService.getCustomerLedgerSummary(id),
        customerService.getCustomerHistory(id),
      ]);

      if (custRes.data) setCustomer(custRes.data);
      if (sumRes.data) setSummary(sumRes.data);
      setTransactions(histRes.transactions);
      setPayments(histRes.payments);
    } catch (e) {
      console.warn('Error loading customer ledger:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleShareWhatsApp = () => {
    if (!customer) return;
    let msg = `🚜 *DSR TRACTORS - கணக்கு விவரம் (STATEMENT)*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 *வாடிக்கையாளர் (Customer):* ${customer.name}\n`;
    if (customer.village) msg += `📍 *ஊர் (Village):* ${customer.village}\n`;
    msg += `📅 *தேதி (Date):* ${new Date().toLocaleDateString('en-IN')}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *மொத்த சேவை கட்டணம்:* ${formatCurrency(summary?.total_charges || 0)}\n`;
    msg += `💵 *செலுத்திய தொகை:* ${formatCurrency(summary?.total_payments || 0)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⚖️ *மீதி பாக்கி (BALANCE):* *${formatCurrency(balance)}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `நன்றி! 🚜 *DSR Tractors*`;
    sendViaWhatsApp(msg, customer.phone);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Customer Ledger" showBack />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Customer Ledger" showBack />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Customer not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const balance = summary?.balance ?? 0;
  const status = summary?.status ?? 'Pending';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title={customer.name}
        subtitle={customer.village || 'Customer Ledger'}
        showBack
        rightAction={
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push(`/customers/edit/${customer.id}` as any)}
          >
            <Ionicons name="create-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Customer Header Info */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            <View style={styles.profileTextCol}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.villageText}>
                <Ionicons name="location-outline" size={14} color={Colors.textMuted} />{' '}
                {customer.village || 'No village specified'}
              </Text>
              {customer.address ? (
                <Text style={styles.addressText}>{customer.address}</Text>
              ) : null}
            </View>

            {customer.phone ? (
              <View style={styles.contactActionsRow}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={16} color={Colors.surface} />
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={handleShareWhatsApp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={Colors.surface} />
                  <Text style={styles.callButtonText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {customer.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesContent}>{customer.notes}</Text>
            </View>
          ) : null}
        </Card>

        {/* Financial Ledger Summary */}
        <Card style={styles.ledgerCard}>
          <View style={styles.ledgerTopRow}>
            <Text style={styles.ledgerHeading}>FINANCIAL BALANCE</Text>
            <Badge label={status} variant={status} />
          </View>

          <View style={styles.balanceContainer}>
            <Text style={styles.balanceCaption}>CURRENT OUTSTANDING BALANCE</Text>
            <Text
              style={[
                styles.balanceValue,
                balance > 0 ? styles.balancePending : styles.balanceSettled,
              ]}
            >
              {formatCurrency(balance)}
            </Text>
          </View>

          <View style={styles.ledgerBreakdown}>
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>Total Charges</Text>
              <Text style={styles.chargesValue}>
                {formatCurrency(summary?.total_charges ?? 0)}
              </Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>Total Paid</Text>
              <Text style={styles.paymentsValue}>
                {formatCurrency(summary?.total_payments ?? 0)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Action Shortcuts */}
        <View style={styles.quickActionRow}>
          <Button
            title="+ New Service"
            onPress={() =>
              router.push({
                pathname: '/services/new',
                params: { customerId: customer.id },
              } as any)
            }
            style={styles.actionBtn}
          />
          <Button
            title="+ Record Payment"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/payments/new',
                params: { customerId: customer.id },
              } as any)
            }
            style={styles.actionBtn}
          />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'services' && styles.activeTabItem]}
            onPress={() => setActiveTab('services')}
          >
            <Ionicons
              name="calculator-outline"
              size={18}
              color={activeTab === 'services' ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'services' && styles.activeTabItemText,
              ]}
            >
              Services ({transactions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'payments' && styles.activeTabItem]}
            onPress={() => setActiveTab('payments')}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={activeTab === 'payments' ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'payments' && styles.activeTabItemText,
              ]}
            >
              Payments ({payments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* History List */}
        {activeTab === 'services' ? (
          transactions.length === 0 ? (
            <View style={styles.emptyTabContent}>
              <Text style={styles.emptyTabText}>No machinery service records yet.</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <Card key={tx.id} style={styles.historyCard}>
                <TouchableOpacity
                  onPress={() => router.push(`/services/${tx.id}` as any)}
                >
                  <View style={styles.historyRow}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDate}>{tx.transaction_date}</Text>
                      <Text style={styles.historySub}>
                        {tx.items && tx.items.length > 0
                          ? tx.items.map((i) => i.service_name).join(', ')
                          : 'Machinery Job'}
                      </Text>
                    </View>
                    <View style={styles.historyAmountCol}>
                      <Text style={styles.historyAmount}>
                        {formatCurrency(tx.total_amount)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>
              </Card>
            ))
          )
        ) : payments.length === 0 ? (
          <View style={styles.emptyTabContent}>
            <Text style={styles.emptyTabText}>No payments recorded yet.</Text>
          </View>
        ) : (
          payments.map((p) => (
            <Card key={p.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyDate}>{p.payment_date}</Text>
                  <Text style={styles.historySub}>
                    Method: {p.payment_method} {p.notes ? `• ${p.notes}` : ''}
                  </Text>
                </View>
                <Text style={styles.paymentReceivedAmount}>
                  +{formatCurrency(p.amount)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    color: Colors.danger,
  },
  editBtn: {
    minWidth: Layout.touchTargetMin,
    minHeight: Layout.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginBottom: Spacing.md,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileTextCol: {
    flex: 1,
    marginRight: Spacing.md,
  },
  customerName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  villageText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addressText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  contactActionsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.sm,
    gap: 4,
    minHeight: 36,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.sm,
    gap: 4,
    minHeight: 36,
  },
  callButtonText: {
    color: Colors.surface,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  notesBox: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  notesLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
  },
  notesContent: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text,
    marginTop: 2,
  },
  ledgerCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  ledgerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ledgerHeading: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  balanceContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Layout.borderRadius.md,
    marginBottom: Spacing.lg,
  },
  balanceCaption: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  balanceValue: {
    fontSize: Typography.fontSize.hero,
    fontWeight: Typography.fontWeight.heavy,
    marginTop: Spacing.xs,
  },
  balancePending: {
    color: Colors.danger,
  },
  balanceSettled: {
    color: Colors.success,
  },
  ledgerBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  breakdownCol: {
    alignItems: 'center',
    flex: 1,
  },
  breakdownLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  chargesValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  paymentsValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success,
  },
  breakdownDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    minHeight: Layout.touchTargetMin,
  },
  activeTabItem: {
    backgroundColor: Colors.primarySoft,
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  tabItemText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textMuted,
  },
  activeTabItemText: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyTabContent: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyTabText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
  },
  historyCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeight.semibold,
  },
  historySub: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
    marginTop: 2,
    fontWeight: Typography.fontWeight.medium,
  },
  historyAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  paymentReceivedAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success,
  },
});
