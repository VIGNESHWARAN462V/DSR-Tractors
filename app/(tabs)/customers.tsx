import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { Customer, CustomerFinancialSummary } from '@/types/database';
import { customerService } from '@/services/customerService';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/calculations';

interface CustomerWithSummary extends Customer {
  summary?: CustomerFinancialSummary;
}

export default function CustomersTab() {
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCustomers = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await customerService.getCustomers(user.id, searchQuery);
      if (!error && data) {
        // Fetch financial summary for each customer in parallel
        const enriched = await Promise.all(
          data.map(async (c) => {
            const { data: summary } = await customerService.getCustomerLedgerSummary(c.id);
            return {
              ...c,
              summary,
            };
          })
        );
        setCustomers(enriched);
      }
    } catch (e) {
      console.warn('Error loading customers:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [user, searchQuery])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCustomers();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Customers"
        subtitle={`${customers.length} Farmer Accounts`}
        rightAction={
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => router.push('/customers/new' as any)}
            accessibilityLabel="Add Customer"
          >
            <Ionicons name="person-add" size={22} color={Colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <Input
          placeholder="Search by name, phone, or village..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchBar}
          leftElement={
            <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
          }
          rightElement={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null
          }
        />

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : customers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Customers Match Search' : 'No Customers Registered'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try searching with a different name, village, or phone number.'
                : 'Add farmer accounts to track machinery services, calculate charges, and record payments.'}
            </Text>
            {!searchQuery && (
              <Button
                title="+ Add First Customer"
                onPress={() => router.push('/customers/new' as any)}
                style={styles.emptyBtn}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const balance = item.summary?.balance ?? 0;
              const status = item.summary?.status ?? 'Pending';

              return (
                <Card style={styles.customerCard}>
                  <TouchableOpacity
                    onPress={() => router.push(`/customers/${item.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.customerRow}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarLetter}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.customerInfo}>
                        <View style={styles.nameBadgeRow}>
                          <Text style={styles.customerName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Badge label={status} variant={status} />
                        </View>

                        <View style={styles.detailsRow}>
                          <Text style={styles.customerSub} numberOfLines={1}>
                            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />{' '}
                            {item.village || 'No village'} •{' '}
                            <Ionicons name="call-outline" size={12} color={Colors.textMuted} />{' '}
                            {item.phone || 'No phone'}
                          </Text>
                        </View>

                        <View style={styles.financialRow}>
                          <Text style={styles.balanceLabel}>Outstanding Balance:</Text>
                          <Text
                            style={[
                              styles.balanceAmount,
                              balance > 0 ? styles.positiveBalance : styles.settledBalance,
                            ]}
                          >
                            {formatCurrency(balance)}
                          </Text>
                        </View>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={Colors.textMuted}
                        style={{ marginLeft: Spacing.xs }}
                      />
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            }}
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
  searchBar: {
    marginBottom: Spacing.md,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    width: '100%',
    maxWidth: 260,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  customerCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarLetter: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  customerInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  customerName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.xs,
  },
  detailsRow: {
    marginBottom: Spacing.xs,
  },
  customerSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  financialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Layout.borderRadius.sm,
    marginTop: 4,
  },
  balanceLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeight.semibold,
  },
  balanceAmount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  positiveBalance: {
    color: Colors.danger,
  },
  settledBalance: {
    color: Colors.success,
  },
});
