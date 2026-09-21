import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { ServiceTransaction } from '@/types/database';
import { machineryService } from '@/services/machineryService';
import { formatCurrency } from '@/utils/calculations';
import { formatBillMessage, sendViaWhatsApp } from '@/utils/whatsapp';

export default function ServiceTransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [tx, setTx] = useState<ServiceTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    machineryService.getTransactionById(id).then(({ data }) => {
      setTx(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Service Invoice" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Service Invoice" showBack />
        <View style={styles.center}>
          <Text style={styles.errorText}>Service record not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Service Invoice" subtitle={`Bill #${tx.id.substring(0, 8)}`} showBack />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Customer & Date Card */}
        <Card>
          <View style={styles.invoiceHeaderRow}>
            <View>
              <Text style={styles.billToLabel}>BILL TO CUSTOMER:</Text>
              <Text style={styles.customerName}>{tx.customer?.name || 'Customer'}</Text>
              <Text style={styles.customerSub}>
                {tx.customer?.village || ''} • {tx.customer?.phone || ''}
              </Text>
            </View>

            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>DATE</Text>
              <Text style={styles.dateValue}>{tx.transaction_date}</Text>
            </View>
          </View>
        </Card>

        {/* Itemized Services Breakdown */}
        <Text style={styles.sectionHeading}>Machinery Services Rendered</Text>
        <Card>
          {tx.items?.map((item, index) => (
            <View key={item.id || index} style={styles.itemRow}>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>
                  {index + 1}. {item.service_name}
                </Text>
                <Text style={styles.itemSub}>
                  {item.quantity} {item.unit}s × ₹{item.rate ?? item.unit_rate ?? 0}
                  {item.worker_type === 'with_worker'
                    ? ' (ஆள் உண்டு)'
                    : item.worker_type === 'without_worker'
                    ? ' (ஆள் இல்லை)'
                    : ''}
                </Text>
              </View>

              <Text style={styles.itemAmount}>
                {formatCurrency(item.amount ?? item.total_amount ?? 0)}
              </Text>
            </View>
          ))}

          <View style={styles.totalDivider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL AMOUNT:</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(tx.total_amount)}
            </Text>
          </View>
        </Card>

        {tx.notes ? (
          <Card>
            <Text style={styles.notesHeading}>Work Notes:</Text>
            <Text style={styles.notesText}>{tx.notes}</Text>
          </Card>
        ) : null}

        {/* Share via WhatsApp */}
        <Button
          title="Share Invoice via WhatsApp"
          onPress={() => {
            const billMsg = formatBillMessage({
              customerName: tx.customer?.name || 'Customer',
              customerPhone: tx.customer?.phone,
              date: tx.transaction_date,
              items: (tx.items || []).map((it) => ({
                serviceName: it.service_name,
                quantity: it.quantity,
                unit: it.unit,
                rate: it.rate ?? it.unit_rate ?? 0,
                amount: it.amount ?? it.total_amount ?? 0,
                workerType: it.worker_type,
              })),
              totalAmount: tx.total_amount,
              notes: tx.notes,
            });
            sendViaWhatsApp(billMsg, tx.customer?.phone);
          }}
          style={{ marginTop: Spacing.md, backgroundColor: '#25D366' }}
        />

        {/* Quick Navigate to Customer Ledger */}
        <Button
          title={`View ${tx.customer?.name || 'Customer'}'s Balance & Ledger`}
          onPress={() => router.push(`/customers/${tx.customer_id}` as any)}
          variant="secondary"
          style={{ marginTop: Spacing.sm }}
        />
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    color: Colors.danger,
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  billToLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  customerName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginTop: 2,
  },
  customerSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dateBox: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
  },
  dateValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  itemSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  grandTotalLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.primary,
  },
  grandTotalValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.primary,
  },
  notesHeading: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  notesText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
  },
});
