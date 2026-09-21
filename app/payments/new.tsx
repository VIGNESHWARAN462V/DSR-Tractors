import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { Customer, CustomerFinancialSummary, PaymentMethod } from '@/types/database';
import { customerService } from '@/services/customerService';
import { paymentService } from '@/services/paymentService';
import { useAuth } from '@/context/AuthContext';
import {
  calculateCustomerBalance,
  formatCurrency,
  getPaymentStatus,
} from '@/utils/calculations';
import { formatPaymentMessage, sendViaWhatsApp } from '@/utils/whatsapp';

export default function NewPaymentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId || '');
  const [showPicker, setShowPicker] = useState(!customerId);
  const [customerSummary, setCustomerSummary] = useState<CustomerFinancialSummary | null>(null);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      customerService.getCustomers(user.id).then(({ data }) => {
        setCustomers(data || []);
      });
    }
  }, [user]);

  useEffect(() => {
    if (customerId) {
      setSelectedCustomerId(customerId);
      setShowPicker(false);
    }
  }, [customerId]);

  // Load summary for selected customer
  useEffect(() => {
    if (selectedCustomerId) {
      customerService.getCustomerLedgerSummary(selectedCustomerId).then(({ data }) => {
        setCustomerSummary(data);
      });
    } else {
      setCustomerSummary(null);
    }
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const paymentAmountNum = parseFloat(amount) || 0;
  const currentBalance = customerSummary?.balance ?? 0;
  const remainingBalanceAfterPay = calculateCustomerBalance(
    customerSummary?.total_charges ?? 0,
    (customerSummary?.total_payments ?? 0) + paymentAmountNum
  );
  const newStatusAfterPay = getPaymentStatus(
    customerSummary?.total_charges ?? 0,
    (customerSummary?.total_payments ?? 0) + paymentAmountNum
  );

  const handleSavePayment = async (shareWhatsApp = false) => {
    if (!selectedCustomerId) {
      Alert.alert('Select Customer', 'Please select a customer for this payment receipt.');
      return;
    }

    if (paymentAmountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
      return;
    }

    if (!user) return;

    setSaving(true);
    const { data, error } = await paymentService.recordPayment({
      user_id: user.id,
      customer_id: selectedCustomerId,
      amount: paymentAmountNum,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod,
      notes: notes.trim(),
    });
    setSaving(false);

    if (error || !data) {
      Alert.alert('Error', error?.message || 'Failed to record payment.');
    } else {
      if (shareWhatsApp) {
        const receiptMsg = formatPaymentMessage({
          customerName: selectedCustomer?.name || 'Customer',
          customerPhone: selectedCustomer?.phone,
          date: new Date().toLocaleDateString('en-IN'),
          amount: paymentAmountNum,
          paymentMethod,
          remainingBalance: remainingBalanceAfterPay,
          notes: notes.trim(),
        });
        await sendViaWhatsApp(receiptMsg, selectedCustomer?.phone);
        router.replace(`/customers/${selectedCustomerId}` as any);
        return;
      }

      Alert.alert(
        'Payment Recorded',
        `Received ${formatCurrency(paymentAmountNum)} via ${paymentMethod}.\nNew Balance: ${formatCurrency(
          remainingBalanceAfterPay
        )} (${newStatusAfterPay})`,
        [
          {
            text: 'Share WhatsApp',
            onPress: async () => {
              const receiptMsg = formatPaymentMessage({
                customerName: selectedCustomer?.name || 'Customer',
                customerPhone: selectedCustomer?.phone,
                date: new Date().toLocaleDateString('en-IN'),
                amount: paymentAmountNum,
                paymentMethod,
                remainingBalance: remainingBalanceAfterPay,
                notes: notes.trim(),
              });
              await sendViaWhatsApp(receiptMsg, selectedCustomer?.phone);
              router.replace(`/customers/${selectedCustomerId}` as any);
            },
          },
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  const methods: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer', 'Other'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Record Payment" subtitle="Customer payment receipt" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* CUSTOMER SELECTION */}
          <Text style={styles.sectionHeading}>Customer</Text>
          <Card>
            {selectedCustomer ? (
              <View style={styles.customerSelectedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                  <Text style={styles.customerSub}>
                    {selectedCustomer.village} • {selectedCustomer.phone}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => setShowPicker(true)}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Button
                title="Select Customer"
                variant="outline"
                onPress={() => setShowPicker(true)}
              />
            )}

            {showPicker && (
              <View style={styles.pickerBox}>
                <Text style={styles.pickerTitle}>Choose Farmer Account:</Text>
                {customers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.customerOption,
                      selectedCustomerId === c.id && styles.customerOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedCustomerId(c.id);
                      setShowPicker(false);
                    }}
                  >
                    <Text style={styles.optionName}>{c.name}</Text>
                    <Text style={styles.optionVillage}>{c.village}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Current Balance Display */}
            {customerSummary ? (
              <View style={styles.balanceInfoBox}>
                <View style={styles.balanceInfoRow}>
                  <Text style={styles.balanceInfoLabel}>Current Balance:</Text>
                  <Text style={styles.balanceInfoAmount}>
                    {formatCurrency(currentBalance)}
                  </Text>
                </View>
                <Badge
                  label={customerSummary.status}
                  variant={customerSummary.status}
                />
              </View>
            ) : null}
          </Card>

          {/* PAYMENT DETAILS */}
          <Text style={styles.sectionHeading}>Payment Details</Text>
          <Card>
            <Input
              label="Amount Received (₹) *"
              placeholder="e.g. 5000"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              leftElement={
                <Text style={{ fontWeight: 'bold', color: Colors.primary, fontSize: 18 }}>
                  ₹
                </Text>
              }
            />

            {/* Payment Method Selector */}
            <Text style={styles.methodLabel}>Payment Method:</Text>
            <View style={styles.methodsRow}>
              {methods.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodChip,
                    paymentMethod === m && styles.methodChipActive,
                  ]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Ionicons
                    name={
                      m === 'Cash'
                        ? 'cash'
                        : m === 'UPI'
                        ? 'phone-portrait'
                        : 'business'
                    }
                    size={16}
                    color={paymentMethod === m ? Colors.surface : Colors.text}
                  />
                  <Text
                    style={[
                      styles.methodChipText,
                      paymentMethod === m && styles.methodChipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Payment Notes / Reference No"
              placeholder="e.g. Google Pay / Cash given by son"
              value={notes}
              onChangeText={setNotes}
              containerStyle={{ marginTop: Spacing.md }}
            />

            {/* Impact Calculation Preview */}
            {paymentAmountNum > 0 ? (
              <View style={styles.previewBox}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>New Balance After Payment:</Text>
                  <Text style={styles.previewValue}>
                    {formatCurrency(remainingBalanceAfterPay)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>New Account Status:</Text>
                  <Badge label={newStatusAfterPay} variant={newStatusAfterPay} />
                </View>
              </View>
            ) : null}

            <Button
              title="Record & Share via WhatsApp"
              onPress={() => handleSavePayment(true)}
              loading={saving}
              disabled={!selectedCustomerId || paymentAmountNum <= 0}
              style={{ marginTop: Spacing.md, backgroundColor: '#25D366' }}
            />

            <Button
              title="Record Payment Receipt"
              onPress={() => handleSavePayment(false)}
              loading={saving}
              variant="outline"
              disabled={!selectedCustomerId || paymentAmountNum <= 0}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionHeading: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  customerSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  customerSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  changeBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Layout.borderRadius.sm,
  },
  changeBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  pickerBox: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  pickerTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  customerOption: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customerOptionSelected: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Layout.borderRadius.sm,
  },
  optionName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  optionVillage: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  balanceInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius.md,
    marginTop: Spacing.md,
  },
  balanceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  balanceInfoLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  balanceInfoAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.danger,
  },
  methodLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  methodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  methodChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  methodChipTextActive: {
    color: Colors.surface,
  },
  previewBox: {
    backgroundColor: Colors.primarySoft,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  previewValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});
