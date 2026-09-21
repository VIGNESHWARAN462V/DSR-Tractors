import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { SyncStatusBadge } from '@/components/common/SyncStatusBadge';
import { dieselService, FleetStats } from '@/services/dieselService';
import { customerService } from '@/services/customerService';
import { machineryService } from '@/services/machineryService';
import { Customer, ServiceTransaction, Tractor } from '@/types/database';
import { formatCurrency, formatLitres } from '@/utils/calculations';

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();

  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ServiceTransaction[]>([]);
  const [totalReceivable, setTotalReceivable] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [tracRes, statsRes, custRes, txRes] = await Promise.all([
        dieselService.getTractors(),
        dieselService.getFleetStats(),
        customerService.getCustomers(),
        machineryService.getRecentTransactions(undefined, 5),
      ]);

      if (tracRes.data) setTractors(tracRes.data);
      if (statsRes.data) setFleetStats(statsRes.data);
      if (txRes.data) setRecentTransactions(txRes.data);

      if (custRes.data) {
        setCustomers(custRes.data);
        // Compute total outstanding balance across all customers
        const summaries = await Promise.all(
          custRes.data.map((c) => customerService.getCustomerLedgerSummary(c.id))
        );

        let sumBal = 0;
        let sumRev = 0;
        summaries.forEach((s) => {
          if (s.data) {
            sumBal += s.data.balance;
            sumRev += s.data.total_charges;
          }
        });

        setTotalReceivable(sumBal);
        setTotalRevenue(sumRev);
      }
    } catch (e) {
      console.warn('Error loading dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const { syncNow } = useSync();

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    await loadDashboardData();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.userName}>
            {profile?.full_name || user?.email?.split('@')[0] || 'Operator'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsIconBtn}
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Offline & Sync Status Pill */}
      <SyncStatusBadge />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Brand Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroBadge}>DSR TRACTORS</Text>
              <Text style={styles.heroTitle}>Machinery Management</Text>
              <Text style={styles.heroSubtitle}>
                Service Billing • Customer Balances • Diesel Tracking
              </Text>
            </View>
            <View style={styles.heroIconCircle}>
              <Ionicons name="car-outline" size={32} color={Colors.surface} />
            </View>
          </View>
        </View>

        {/* Quick Action Buttons */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.primary }]}
            onPress={() => router.push('/services/new')}
          >
            <Ionicons name="add-circle" size={24} color={Colors.surface} />
            <Text style={styles.actionButtonText}>New Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.accent }]}
            onPress={() => router.push('/diesel/new')}
          >
            <Ionicons name="speedometer" size={24} color={Colors.surface} />
            <Text style={styles.actionButtonText}>Log Diesel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.dark }]}
            onPress={() => router.push('/customers/new')}
          >
            <Ionicons name="person-add" size={24} color={Colors.surface} />
            <Text style={styles.actionButtonText}>Add Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.info }]}
            onPress={() => router.push('/payments/new')}
          >
            <Ionicons name="cash" size={24} color={Colors.surface} />
            <Text style={styles.actionButtonText}>Record Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Tractor Fuel Snapshot */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Tractor Fleet Fuel</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/diesel')}>
            <Text style={styles.seeAllLink}>Manage Fleet &rarr;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tractorGrid}>
          {tractors.map((tractor) => {
            const fuel = Number(tractor.current_fuel_litres) || 0;
            const isLow = fuel < 10;
            return (
              <TouchableOpacity
                key={tractor.id}
                style={styles.tractorCardTouchable}
                onPress={() =>
                  router.push({
                    pathname: '/diesel/new',
                    params: { tractorId: tractor.id },
                  })
                }
                activeOpacity={0.8}
              >
                <Card style={isLow ? [styles.tractorCard, styles.tractorCardLow] : styles.tractorCard}>
                  <Text style={styles.tractorName} numberOfLines={1}>
                    {tractor.name}
                  </Text>
                  <Text
                    style={[
                      styles.tractorLitres,
                      isLow && { color: Colors.danger },
                    ]}
                  >
                    {fuel.toFixed(1)} L
                  </Text>
                  <Text style={styles.tractorStatus}>
                    {isLow ? '⚠️ Low Fuel' : 'In Tank'}
                  </Text>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Business Overview Stats */}
        <Text style={styles.sectionTitle}>Business Overview</Text>
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Farmer Accounts</Text>
            <Text style={styles.statValue}>{customers.length}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Total Billed</Text>
            <Text style={styles.statValue}>{formatCurrency(totalRevenue)}</Text>
          </Card>
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Total Fuel Consumed</Text>
            <Text style={[styles.statValue, { color: Colors.accent }]}>
              {fleetStats ? `${fleetStats.total_diesel_consumed.toFixed(1)} L` : '0.0 L'}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Pending Receivables</Text>
            <Text
              style={[
                styles.statValue,
                { color: totalReceivable > 0 ? Colors.danger : Colors.primary },
              ]}
            >
              {formatCurrency(totalReceivable)}
            </Text>
          </Card>
        </View>

        {/* Recent Machinery Jobs */}
        {recentTransactions.length > 0 && (
          <View style={{ marginTop: Spacing.md }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Invoices</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/services')}>
                <Text style={styles.seeAllLink}>View All &rarr;</Text>
              </TouchableOpacity>
            </View>

            {recentTransactions.map((tx) => (
              <Card key={tx.id} style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txCustomer}>
                      {tx.customer?.name || 'Customer'}
                    </Text>
                    <Text style={styles.txSub}>
                      {tx.service_date} • {tx.items?.length || 0} services
                    </Text>
                  </View>
                  <Text style={styles.txAmount}>
                    {formatCurrency(tx.total_amount)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  welcomeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  userName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  settingsIconBtn: {
    minWidth: Layout.touchTargetMin,
    minHeight: Layout.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  heroBadge: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.accent,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: '#D1FAE5',
    lineHeight: 16,
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  seeAllLink: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Layout.borderRadius.md,
    gap: Spacing.xs,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
  tractorGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  tractorCardTouchable: {
    flex: 1,
  },
  tractorCard: {
    padding: Spacing.sm,
    alignItems: 'center',
  },
  tractorCardLow: {
    borderColor: Colors.danger,
    borderWidth: 1,
  },
  tractorName: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  tractorLitres: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.black,
    color: Colors.primary,
    marginVertical: 2,
  },
  tractorStatus: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.black,
    color: Colors.text,
  },
  txCard: {
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txCustomer: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  txSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});
