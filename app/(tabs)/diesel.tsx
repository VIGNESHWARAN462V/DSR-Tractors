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
import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { dieselService, FleetStats } from '@/services/dieselService';
import { DieselTransaction, Tractor } from '@/types/database';
import { formatCurrency } from '@/utils/calculations';

export default function DieselTab() {
  const router = useRouter();

  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<DieselTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [tracRes, statsRes, logsRes] = await Promise.all([
        dieselService.getTractors(),
        dieselService.getFleetStats(),
        dieselService.getDieselTransactions(3),
      ]);

      if (tracRes.data) setTractors(tracRes.data);
      if (statsRes.data) setStats(statsRes.data);
      if (logsRes.data) setRecentLogs(logsRes.data);
    } catch (e) {
      console.warn('Error loading diesel tab:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Tractor Diesel"
        subtitle="Fleet balances & consumption"
        rightAction={
          <TouchableOpacity
            style={styles.historyIconBtn}
            onPress={() => router.push('/diesel/history')}
            accessibilityLabel="Diesel History"
          >
            <Ionicons name="time-outline" size={24} color={Colors.primary} />
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
        {/* Quick Log Diesel Button */}
        <Button
          title="+ Log Diesel & Working Hours"
          onPress={() => router.push('/diesel/new')}
          style={styles.logBtn}
        />

        {/* Fleet KPI Summary Bar */}
        {stats && (
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{stats.total_fleet_fuel.toFixed(1)} L</Text>
              <Text style={styles.kpiLabel}>Fleet In Tanks</Text>
            </View>
            <View style={[styles.kpiBox, styles.kpiBorder]}>
              <Text style={styles.kpiValue}>{stats.total_diesel_consumed.toFixed(1)} L</Text>
              <Text style={styles.kpiLabel}>Total Consumed</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{stats.total_working_hours.toFixed(1)} h</Text>
              <Text style={styles.kpiLabel}>Hours Worked</Text>
            </View>
          </View>
        )}

        {/* Consumption Rule Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="speedometer-outline" size={20} color={Colors.accent} />
          <Text style={styles.infoText}>
            Standard rule: 4.00 Litres consumed per 1 Working Hour. Balances deduct automatically upon logging.
          </Text>
        </View>

        {/* Tractor Fuel Balances */}
        <Text style={styles.sectionHeading}>Swaraj Fleet Fuel Balances</Text>

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          tractors.map((tractor) => {
            const fuel = Number(tractor.current_fuel_litres) || 0;
            const isLow = fuel < 10;

            return (
              <Card key={tractor.id} style={styles.tractorCard}>
                <View style={styles.tractorHeader}>
                  <View style={styles.tractorNameCol}>
                    <View style={styles.tractorTitleRow}>
                      <Text style={styles.tractorTitle}>{tractor.name}</Text>
                      {isLow && (
                        <Badge
                          label="Low Fuel"
                          variant="warning"
                          style={{ marginLeft: Spacing.xs }}
                        />
                      )}
                    </View>
                    <Text style={styles.tractorStatus}>Active • Ready for Field</Text>
                  </View>
                  <View style={[styles.tankBadge, isLow && styles.tankBadgeLow]}>
                    <Ionicons
                      name="water"
                      size={16}
                      color={isLow ? Colors.danger : Colors.primary}
                    />
                    <Text
                      style={[styles.tankText, isLow && { color: Colors.danger }]}
                    >
                      TANK
                    </Text>
                  </View>
                </View>

                <View style={styles.fuelGaugeRow}>
                  <Text
                    style={[
                      styles.fuelValue,
                      isLow && { color: Colors.danger },
                    ]}
                  >
                    {fuel.toFixed(2)} L
                  </Text>
                  <Text style={styles.fuelSub}>CURRENT TANK BALANCE</Text>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.inlineActionBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/diesel/new',
                        params: { tractorId: tractor.id },
                      })
                    }
                  >
                    <Text style={styles.inlineActionText}>Log Fuel / Work</Text>
                    <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}

        {/* Recent Diesel Logs Preview */}
        {recentLogs.length > 0 && (
          <View style={{ marginTop: Spacing.md }}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionHeading}>Recent Diesel Logs</Text>
              <TouchableOpacity onPress={() => router.push('/diesel/history')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {recentLogs.map((log) => (
              <Card key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logTractor}>
                    {log.tractor?.name || 'Tractor'}
                  </Text>
                  <Text style={styles.logDate}>{log.transaction_date}</Text>
                </View>

                <View style={styles.logStatsRow}>
                  <View style={styles.logStatItem}>
                    <Text style={styles.logStatLabel}>Intake Mode</Text>
                    <Text style={styles.logStatVal}>
                      {log.input_mode === 'amount'
                        ? formatCurrency(log.diesel_amount || 0)
                        : `${((log.diesel_amount || 0) / (log.diesel_price || 1)).toFixed(1)} L`}
                    </Text>
                  </View>

                  <View style={styles.logStatItem}>
                    <Text style={styles.logStatLabel}>Hours Worked</Text>
                    <Text style={styles.logStatVal}>
                      {Number(log.total_working_hours).toFixed(2)} h
                    </Text>
                  </View>

                  <View style={styles.logStatItem}>
                    <Text style={styles.logStatLabel}>Consumed (4L/h)</Text>
                    <Text style={[styles.logStatVal, { color: Colors.danger }]}>
                      -{Number(log.diesel_consumed).toFixed(2)} L
                    </Text>
                  </View>

                  <View style={styles.logStatItem}>
                    <Text style={styles.logStatLabel}>Remaining</Text>
                    <Text style={[styles.logStatVal, { color: Colors.primary }]}>
                      {Number(log.remaining_fuel).toFixed(2)} L
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.viewHistoryCard}
          onPress={() => router.push('/diesel/history')}
        >
          <Ionicons name="receipt-outline" size={24} color={Colors.text} />
          <Text style={styles.viewHistoryText}>View Full Diesel Logs & History</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
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
  historyIconBtn: {
    minWidth: Layout.touchTargetMin,
    minHeight: Layout.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtn: {
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
  },
  kpiValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  kpiLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.dark,
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  loadingBox: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  tractorCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tractorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  tractorNameCol: {
    flex: 1,
  },
  tractorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tractorTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  tractorStatus: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Layout.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  tankBadgeLow: {
    borderColor: Colors.danger,
    backgroundColor: '#FEE2E2',
  },
  tankText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  fuelGaugeRow: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius.sm,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  fuelValue: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.black,
    color: Colors.primary,
  },
  fuelSub: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    alignItems: 'flex-end',
  },
  inlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  inlineActionText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  seeAllText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  logCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  logTractor: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  logDate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  logStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logStatItem: {
    alignItems: 'center',
  },
  logStatLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  logStatVal: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  viewHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  viewHistoryText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
});
