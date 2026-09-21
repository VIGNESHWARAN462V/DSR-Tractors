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
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { Customer, ServiceMaster, ServiceTransactionItem, WorkerType } from '@/types/database';
import { customerService } from '@/services/customerService';
import { machineryService } from '@/services/machineryService';
import { useAuth } from '@/context/AuthContext';
import {
  calculateGrandTotal,
  calculateServiceAmount,
  DEFAULT_SERVICE_RATES,
  formatCurrency,
} from '@/utils/calculations';
import { formatBillMessage, sendViaWhatsApp } from '@/utils/whatsapp';

interface DraftItem {
  id: string;
  service_name: string;
  quantity: number;
  unit: 'hour' | 'load' | 'bundle';
  worker_type?: WorkerType | null;
  unit_rate: number;
  total_amount: number;
}

export default function NewServiceTransactionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId || '');
  const [showCustomerPicker, setShowCustomerPicker] = useState(!customerId);

  // Available services
  const [serviceMasters, setServiceMasters] = useState<ServiceMaster[]>([]);

  // Current line item being configured
  const [selectedService, setSelectedService] = useState<string>('5-Kalappai');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [solamWorkerType, setSolamWorkerType] = useState<WorkerType>('with_worker');

  // Multi-item cart
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Load customers and services
  useEffect(() => {
    if (user) {
      customerService.getCustomers(user.id).then(({ data }) => {
        setCustomers(data || []);
      });
      machineryService.getServices().then(({ data }) => {
        setServiceMasters(data || []);
      });
    }
  }, [user]);

  // When customerId param changes
  useEffect(() => {
    if (customerId) {
      setSelectedCustomerId(customerId);
      setShowCustomerPicker(false);
    }
  }, [customerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Get current active service master definition
  const currentServiceConfig =
    serviceMasters.find((s) => s.name === selectedService) || {
      name: selectedService,
      unit: (DEFAULT_SERVICE_RATES[selectedService]?.unit as any) || 'hour',
      rate: DEFAULT_SERVICE_RATES[selectedService]?.rate || 1200,
      has_worker_types: selectedService === 'Solam',
      worker_rate: DEFAULT_SERVICE_RATES[selectedService]?.workerRates?.with_worker ?? 100,
      no_worker_rate: DEFAULT_SERVICE_RATES[selectedService]?.workerRates?.without_worker ?? 75,
    };

  const isSolam = selectedService.toLowerCase().includes('solam');
  const currentUnit = isSolam ? 'bundle' : currentServiceConfig.unit;

  // Calculate live amount for the current input
  const currentQty = parseFloat(quantityInput) || 0;
  const activeRate = isSolam
    ? solamWorkerType === 'with_worker'
      ? (currentServiceConfig.worker_rate ?? 100)
      : (currentServiceConfig.no_worker_rate ?? 75)
    : (currentServiceConfig.rate ?? 1200);

  const currentLineCalc = calculateServiceAmount(
    selectedService,
    currentQty,
    isSolam ? solamWorkerType : null,
    activeRate
  );

  // Add line item to the bill
  const handleAddServiceItem = () => {
    if (currentQty <= 0) {
      Alert.alert('Invalid Quantity', `Please enter valid ${currentUnit}s.`);
      return;
    }

    const newItem: DraftItem = {
      id: Math.random().toString(36).substring(2, 9),
      service_name: selectedService,
      quantity: currentQty,
      unit: currentUnit,
      worker_type: isSolam ? solamWorkerType : null,
      unit_rate: currentLineCalc.unitRate,
      total_amount: currentLineCalc.totalAmount,
    };

    setItems([...items, newItem]);
    setQuantityInput('');
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
  };

  // Grand total
  const grandTotal = calculateGrandTotal(items);

  // Save full transaction
  const handleSaveTransaction = async (shareWhatsApp = false) => {
    if (!selectedCustomerId) {
      Alert.alert('Select Customer', 'Please select a customer for this service job.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Empty Bill', 'Please add at least one machinery service to the bill.');
      return;
    }

    if (!user) return;

    setSaving(true);
    const { data, error } = await machineryService.createServiceTransaction(
      {
        user_id: user.id,
        customer_id: selectedCustomerId,
        total_amount: grandTotal,
        transaction_date: new Date().toISOString().split('T')[0],
        notes: notes.trim(),
      },
      items.map((item) => ({
        service_name: item.service_name,
        quantity: item.quantity,
        unit: item.unit,
        worker_type: item.worker_type,
        unit_rate: item.unit_rate,
        total_amount: item.total_amount,
      }))
    );
    setSaving(false);

    if (error || !data) {
      Alert.alert('Error', error?.message || 'Failed to save transaction.');
    } else {
      if (shareWhatsApp) {
        const billMsg = formatBillMessage({
          customerName: selectedCustomer?.name || 'Valued Farmer',
          customerPhone: selectedCustomer?.phone,
          date: new Date().toLocaleDateString('en-IN'),
          items: items.map((item) => ({
            serviceName: item.service_name,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.unit_rate,
            amount: item.total_amount,
            workerType: item.worker_type,
          })),
          totalAmount: grandTotal,
          notes: notes.trim(),
        });
        await sendViaWhatsApp(billMsg, selectedCustomer?.phone);
        router.replace(`/services/${data.id}` as any);
        return;
      }

      Alert.alert(
        'Transaction Saved',
        `Service bill of ${formatCurrency(grandTotal)} saved for ${selectedCustomer?.name}.`,
        [
          {
            text: 'Share WhatsApp',
            onPress: async () => {
              const billMsg = formatBillMessage({
                customerName: selectedCustomer?.name || 'Valued Farmer',
                customerPhone: selectedCustomer?.phone,
                date: new Date().toLocaleDateString('en-IN'),
                items: items.map((item) => ({
                  serviceName: item.service_name,
                  quantity: item.quantity,
                  unit: item.unit,
                  rate: item.unit_rate,
                  amount: item.total_amount,
                  workerType: item.worker_type,
                })),
                totalAmount: grandTotal,
                notes: notes.trim(),
              });
              await sendViaWhatsApp(billMsg, selectedCustomer?.phone);
              router.replace(`/services/${data.id}` as any);
            },
          },
          {
            text: 'View Invoice',
            onPress: () => router.replace(`/services/${data.id}` as any),
          },
        ]
      );
    }
  };

  const serviceOptions = [
    '5-Kalappai',
    '9-Kalappai',
    'Paar Kalappai',
    'Rotavator',
    'Tanker',
    'Solam',
    'Manjal',
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Machinery Calculator" subtitle="Service billing & invoice" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: SELECT CUSTOMER */}
          <Text style={styles.stepTitle}>Step 1: Customer</Text>
          <Card>
            {selectedCustomer ? (
              <View style={styles.customerSelectedRow}>
                <View style={styles.customerSelectedInfo}>
                  <Text style={styles.customerSelectedName}>{selectedCustomer.name}</Text>
                  <Text style={styles.customerSelectedSub}>
                    {selectedCustomer.village} • {selectedCustomer.phone}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeCustomerBtn}
                  onPress={() => setShowCustomerPicker(true)}
                >
                  <Text style={styles.changeCustomerText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.promptText}>No customer selected yet.</Text>
                <Button
                  title="Choose Customer"
                  variant="outline"
                  onPress={() => setShowCustomerPicker(true)}
                  style={{ marginTop: Spacing.xs }}
                />
              </View>
            )}

            {showCustomerPicker && (
              <View style={styles.customerPickerBox}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Customer</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/customers/new' as any)}
                  >
                    <Text style={styles.addCustomerInlineText}>+ Add New</Text>
                  </TouchableOpacity>
                </View>

                {customers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.customerOption,
                      selectedCustomerId === c.id && styles.customerOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedCustomerId(c.id);
                      setShowCustomerPicker(false);
                    }}
                  >
                    <Text style={styles.customerOptionName}>{c.name}</Text>
                    <Text style={styles.customerOptionVillage}>
                      {c.village || 'No village'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>

          {/* STEP 2: MACHINERY SERVICE PICKER */}
          <Text style={styles.stepTitle}>Step 2: Add Machinery Service</Text>
          <Card>
            <Text style={styles.inputLabel}>Select Machinery Service:</Text>
            <View style={styles.serviceChipsContainer}>
              {serviceOptions.map((srv) => (
                <TouchableOpacity
                  key={srv}
                  style={[
                    styles.serviceChip,
                    selectedService === srv && styles.serviceChipActive,
                  ]}
                  onPress={() => {
                    setSelectedService(srv);
                    setQuantityInput('');
                  }}
                >
                  <Text
                    style={[
                      styles.serviceChipText,
                      selectedService === srv && styles.serviceChipTextActive,
                    ]}
                  >
                    {srv}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Solam Worker Toggle if Solam is chosen */}
            {isSolam ? (
              <View style={styles.solamToggleContainer}>
                <Text style={styles.inputLabel}>Worker Type (வேலை ஆட்கள்):</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      solamWorkerType === 'with_worker' && styles.toggleBtnActive,
                    ]}
                    onPress={() => setSolamWorkerType('with_worker')}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        solamWorkerType === 'with_worker' && styles.toggleBtnTextActive,
                      ]}
                    >
                      ஆள் உண்டு (₹{currentServiceConfig.worker_rate || 100}/bundle)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      solamWorkerType === 'without_worker' && styles.toggleBtnActive,
                    ]}
                    onPress={() => setSolamWorkerType('without_worker')}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        solamWorkerType === 'without_worker' && styles.toggleBtnTextActive,
                      ]}
                    >
                      ஆள் இல்லை (₹{currentServiceConfig.no_worker_rate || 75}/bundle)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Quantity Input */}
            <View style={styles.qtyRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label={`Quantity (${currentUnit.toUpperCase()}S)`}
                  placeholder={currentUnit === 'hour' ? 'e.g. 5 or 2.5' : 'e.g. 2'}
                  value={quantityInput}
                  onChangeText={setQuantityInput}
                  keyboardType="decimal-pad"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <View style={styles.ratePreviewBox}>
                <Text style={styles.ratePreviewLabel}>Unit Rate</Text>
                <Text style={styles.ratePreviewValue}>
                  ₹{currentLineCalc.unitRate}/{currentUnit}
                </Text>
              </View>
            </View>

            {/* Live Line Amount preview */}
            <View style={styles.lineTotalPreview}>
              <Text style={styles.lineTotalLabel}>Service Item Amount:</Text>
              <Text style={styles.lineTotalValue}>
                {formatCurrency(currentLineCalc.totalAmount)}
              </Text>
            </View>

            <Button
              title="+ Add This Service to Bill"
              onPress={handleAddServiceItem}
              style={{ marginTop: Spacing.md }}
            />
          </Card>

          {/* STEP 3: ITEM LIST & BILL REVIEW */}
          <Text style={styles.stepTitle}>
            Step 3: Service Items ({items.length})
          </Text>

          {items.length === 0 ? (
            <Card style={styles.emptyItemsCard}>
              <Ionicons name="cart-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyItemsText}>
                No service items added yet. Choose a machine above and tap "+ Add This Service to Bill".
              </Text>
            </Card>
          ) : (
            items.map((item, index) => (
              <Card key={item.id} style={styles.billItemCard}>
                <View style={styles.billItemRow}>
                  <View style={styles.billItemInfo}>
                    <Text style={styles.billItemName}>
                      {index + 1}. {item.service_name}
                    </Text>
                    <Text style={styles.billItemSub}>
                      {item.quantity} {item.unit}s × ₹{item.unit_rate}
                      {item.worker_type === 'with_worker'
                        ? ' (ஆள் உண்டு)'
                        : item.worker_type === 'without_worker'
                        ? ' (ஆள் இல்லை)'
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.billItemActionCol}>
                    <Text style={styles.billItemTotal}>
                      {formatCurrency(item.total_amount)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))
          )}

          {/* Additional Notes */}
          <Card style={{ marginTop: Spacing.md }}>
            <Input
              label="Work Notes (Optional)"
              placeholder="e.g. Field near canal, wet soil, driver: Selvam"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              containerStyle={{ marginBottom: 0 }}
            />
          </Card>

          {/* GRAND TOTAL SUMMARY & SAVE */}
          <Card style={styles.grandTotalCard}>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>GRAND TOTAL:</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(grandTotal)}
              </Text>
            </View>

            <Button
              title="Save & Share via WhatsApp"
              onPress={() => handleSaveTransaction(true)}
              loading={saving}
              disabled={items.length === 0 || !selectedCustomerId}
              style={{ marginTop: Spacing.md, backgroundColor: '#25D366' }}
            />

            <Button
              title="Save Service Transaction"
              onPress={() => handleSaveTransaction(false)}
              loading={saving}
              variant="outline"
              disabled={items.length === 0 || !selectedCustomerId}
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
  stepTitle: {
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
  customerSelectedInfo: {
    flex: 1,
  },
  customerSelectedName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  customerSelectedSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  changeCustomerBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Layout.borderRadius.sm,
  },
  changeCustomerText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  promptText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  customerPickerBox: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  pickerTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
  },
  addCustomerInlineText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  customerOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customerOptionSelected: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Layout.borderRadius.sm,
  },
  customerOptionName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  customerOptionVillage: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  inputLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  serviceChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  serviceChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Layout.borderRadius.round,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serviceChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  serviceChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  serviceChipTextActive: {
    color: Colors.surface,
  },
  solamToggleContainer: {
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.sm,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    textAlign: 'center',
  },
  toggleBtnTextActive: {
    color: Colors.surface,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  ratePreviewBox: {
    width: 110,
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: Layout.borderRadius.md,
    alignItems: 'center',
  },
  ratePreviewLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  ratePreviewValue: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    marginTop: 2,
  },
  lineTotalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius.md,
    marginVertical: Spacing.xs,
  },
  lineTotalLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  lineTotalValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  emptyItemsCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyItemsText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  billItemCard: {
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billItemInfo: {
    flex: 1,
  },
  billItemName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  billItemSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  billItemActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  billItemTotal: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  grandTotalCard: {
    backgroundColor: Colors.dark,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
  },
  grandTotalLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.accent,
    letterSpacing: 1,
  },
  grandTotalValue: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.surface,
  },
});
