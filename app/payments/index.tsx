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
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { Payment } from '@/types/database';
import { paymentService } from '@/services/paymentService';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/calculations';

export default function PaymentsIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = async () => {
    if (!user) return;
    try {
      const { data } = await paymentService.getPayments(user.id);
      setPayments(data || []);
    } catch (e) {
      console.warn('Error loading payments:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  const totalCollected = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'UPI':
        return 'phone-portrait-outline';
      case 'Bank Transfer':
        return 'business-outline';
      case 'Cash':
      default:
        return 'cash-outline';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Customer Payments"
        subtitle="Receipts & settlement logs"
        showBack
        rightAction={
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => router.push('/payments/new' as any)}
          >
            <Ionicons name="add" size={26} color={Colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {/* Total Collected Banner */}
        <Card style={styles.collectedCard}>
          <Text style={styles.collectedLabel}>TOTAL PAYMENTS COLLECTED</Text>
          <Text style={styles.collectedAmount}>{formatCurrency(totalCollected)}</Text>
        </Card>

        <Button
          title="+ Record New Payment"
          onPress={() => router.push('/payments/new' as any)}
          style={{ marginBottom: Spacing.md }}
        />

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Payments Recorded Yet</Text>
            <Text style={styles.emptySubtitle}>
              When farmers make payments (Cash, UPI, Bank Transfer), record them here to update balances automatically.
            </Text>
          </View>
        ) : (
          <FlatList
            data={payments}
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
              <Card style={styles.paymentCard}>
                <TouchableOpacity
                  onPress={() => {
                    if (item.customer_id) {
                      router.push(`/customers/${item.customer_id}` as any);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentRow}>
                    <View
                      style={[
                        styles.methodIconBox,
                        {
                          backgroundColor:
                            item.payment_method === 'Cash'
                              ? Colors.successLight
                              : Colors.infoLight,
                        },
                      ]}
                    >
                      <Ionicons
                        name={getMethodIcon(item.payment_method) as any}
                        size={22}
                        color={
                          item.payment_method === 'Cash' ? Colors.success : Colors.info
                        }
                      />
                    </View>

                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentCustomerName}>
                        {item.customer?.name || 'Customer'}
                      </Text>
                      <Text style={styles.paymentSub}>
                        {item.payment_date} • {item.payment_method}
                        {item.notes ? ` • ${item.notes}` : ''}
                      </Text>
                    </View>

                    <Text style={styles.paymentAmount}>
                      +{formatCurrency(item.amount)}
                    </Text>
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
  collectedCard: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  collectedLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
    letterSpacing: 1,
  },
  collectedAmount: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.surface,
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  paymentCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentCustomerName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  paymentSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success,
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
