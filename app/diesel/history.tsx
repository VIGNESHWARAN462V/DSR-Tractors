import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Badge } from '@/components/common/Badge';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { dieselService } from '@/services/dieselService';
import { DieselTransaction, Tractor } from '@/types/database';
import { formatCurrency, formatLitres } from '@/utils/calculations';

type DateFilter = 'all' | 'today' | 'week';

export default function DieselHistoryScreen() {
  const router = useRouter();

  const [transactions, setTransactions] = useState<DieselTransaction[]>([]);
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [selectedTractorId, setSelectedTractorId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [txRes, tracRes] = await Promise.all([
        dieselService.getDieselTransactions(100),
        dieselService.getTractors(),
      ]);

      if (txRes.data) setTransactions(txRes.data);
      if (tracRes.data) setTractors(tracRes.data);
    } catch (e) {
      console.warn('Error loading diesel history:', e);
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

  const handleDelete = (tx: DieselTransaction) => {
    Alert.alert(
      'Delete Diesel Entry',
      `Are you sure you want to delete this diesel log for ${
        tx.tractor?.name || 'Tractor'
      }? The tractor tank balance will be reverted to ${formatLitres(
        tx.initial_fuel_litres
      )}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await dieselService.deleteDieselTransaction(tx.id);
            if (error) {
              Alert.alert('Error', error.message || 'Failed to delete entry.');
            } else {
              loadData();
            }
          },
        },
      ]
    );
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    // Tractor filter
    if (selectedTractorId !== 'all' && tx.tractor_id !== selectedTractorId) {
      return false;
    }

    // Date filter
    if (dateFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return tx.transaction_date === today;
    }

    if (dateFilter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const cutoff = oneWeekAgo.toISOString().split('T')[0];
      return tx.transaction_date >= cutoff;
    }

    return true;
  });

  // Calculate stats for filtered view
  const totalFuelConsumed = filteredTransactions.reduce(
    (sum, t) => sum + (Number(t.diesel_consumed) || 0),
    0
  );
  const totalHoursWorked = filteredTransactions.reduce(
    (sum, t) => sum + (Number(t.total_working_hours) || 0),
    0
  );

  const renderTransactionItem = ({ item }: { item: DieselTransaction }) => {
    return (
      <Card style={styles.recordCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.tractorName}>
              {item.tractor?.name || 'Swaraj Tractor'}
            </Text>
            <Text style={styles.dateText}>{item.transaction_date}</Text>
          </View>

          <View style={styles.cardHeaderRight}>
            <Badge
              label={item.input_mode === 'amount' ? 'Amount Mode' : 'Litres Mode'}
              variant="neutral"
            />
            <TouchableOpacity
              style={styles.deleteIconBtn}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Starting Tank</Text>
            <Text style={styles.metricVal}>
              {formatLitres(item.initial_fuel_litres)}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>
              {item.input_mode === 'amount' ? 'Diesel Spent' : 'Fuel Added'}
            </Text>
            <Text style={[styles.metricVal, { color: Colors.primary }]}>
              {item.diesel_amount
                ? formatCurrency(item.diesel_amount)
                : '0.00 L'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Hours Worked</Text>
            <Text style={styles.metricVal}>
              {Number(item.total_working_hours).toFixed(2)} hrs
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Consumed (4L/h)</Text>
            <Text style={[styles.metricVal, { color: Colors.danger }]}>
              -{formatLitres(item.diesel_consumed)}
            </Text>
          </View>
        </View>

        {/* Timings List if present */}
        {item.timings && item.timings.length > 0 && (
          <View style={styles.timingsBreakdown}>
            <Text style={styles.timingsHeading}>Work Timings Breakdown:</Text>
            <View style={styles.timingsChipsRow}>
              {item.timings.map((tm, idx) => (
                <View key={tm.id || idx} style={styles.timingChip}>
                  <Ionicons name="time" size={12} color={Colors.primary} />
                  <Text style={styles.timingChipText}>
                    Slot {idx + 1}: {Number(tm.timing_hours).toFixed(2)}h
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Final Tank Balance Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterLabel}>REMAINING IN TANK:</Text>
          <Text style={styles.cardFooterVal}>
            {formatLitres(item.remaining_fuel)}
          </Text>
        </View>

        {item.notes ? (
          <Text style={styles.notesText}>Note: {item.notes}</Text>
        ) : null}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Diesel History"
        subtitle={`${filteredTransactions.length} logs recorded`}
        showBack
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/diesel/new')}
          >
            <Ionicons name="add-circle" size={26} color={Colors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Tractor Filter Chips */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tractorFiltersScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedTractorId === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedTractorId('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedTractorId === 'all' && styles.filterChipTextActive,
              ]}
            >
              All Fleet
            </Text>
          </TouchableOpacity>

          {tractors.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.filterChip,
                selectedTractorId === t.id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedTractorId(t.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedTractorId === t.id && styles.filterChipTextActive,
                ]}
              >
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date Filter Tabs */}
        <View style={styles.dateTabsRow}>
          <TouchableOpacity
            style={[
              styles.dateTab,
              dateFilter === 'all' && styles.dateTabActive,
            ]}
            onPress={() => setDateFilter('all')}
          >
            <Text
              style={[
                styles.dateTabText,
                dateFilter === 'all' && styles.dateTabTextActive,
              ]}
            >
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dateTab,
              dateFilter === 'week' && styles.dateTabActive,
            ]}
            onPress={() => setDateFilter('week')}
          >
            <Text
              style={[
                styles.dateTabText,
                dateFilter === 'week' && styles.dateTabTextActive,
              ]}
            >
              Past 7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dateTab,
              dateFilter === 'today' && styles.dateTabActive,
            ]}
            onPress={() => setDateFilter('today')}
          >
            <Text
              style={[
                styles.dateTabText,
                dateFilter === 'today' && styles.dateTabTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Summary Banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryBannerItem}>
          <Text style={styles.summaryBannerVal}>
            {totalFuelConsumed.toFixed(1)} L
          </Text>
          <Text style={styles.summaryBannerLabel}>Diesel Consumed</Text>
        </View>
        <View style={styles.summaryBannerDivider} />
        <View style={styles.summaryBannerItem}>
          <Text style={styles.summaryBannerVal}>
            {totalHoursWorked.toFixed(1)} h
          </Text>
          <Text style={styles.summaryBannerLabel}>Working Hours</Text>
        </View>
      </View>

      {/* Transactions List */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransactionItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="water-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Diesel Logs Found</Text>
              <Text style={styles.emptySub}>
                {selectedTractorId !== 'all' || dateFilter !== 'all'
                  ? 'Try clearing active filters to see logs.'
                  : 'Start by logging your first fuel intake or machinery session.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  addBtn: {
    minWidth: Layout.touchTargetMin,
    minHeight: Layout.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  tractorFiltersScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.surface,
  },
  dateTabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dateTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  dateTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  dateTabText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeight.semibold,
  },
  dateTabTextActive: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  summaryBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Layout.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryBannerItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryBannerVal: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  summaryBannerLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  summaryBannerDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tractorName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deleteIconBtn: {
    padding: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  metricItem: {
    width: '48%',
    backgroundColor: Colors.background,
    padding: Spacing.xs,
    borderRadius: Layout.borderRadius.xs,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  timingsBreakdown: {
    backgroundColor: Colors.background,
    padding: Spacing.xs,
    borderRadius: Layout.borderRadius.xs,
    marginBottom: Spacing.sm,
  },
  timingsHeading: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  timingsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  timingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  timingChipText: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  cardFooterLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  cardFooterVal: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.black,
    color: Colors.primary,
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyBox: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 260,
  },
});
