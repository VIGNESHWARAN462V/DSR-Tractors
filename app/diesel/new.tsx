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
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { Tractor } from '@/types/database';
import { dieselService } from '@/services/dieselService';
import { useAuth } from '@/context/AuthContext';
import {
  calculateDieselConsumed,
  calculateLitresFromAmount,
  calculateRemainingFuel,
  DEFAULT_DIESEL_PRICE,
  DIESEL_CONSUMPTION_RATE_PER_HOUR,
  formatCurrency,
  formatLitres,
} from '@/utils/calculations';

interface TimingItem {
  id: string;
  hours: string;
  label?: string;
}

export default function NewDieselScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { tractorId } = useLocalSearchParams<{ tractorId?: string }>();

  // Tractors
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [selectedTractorId, setSelectedTractorId] = useState<string>(tractorId || '');

  // Fuel Input Mode: 'amount' or 'litres'
  const [inputMode, setInputMode] = useState<'amount' | 'litres'>('amount');
  const [amountInput, setAmountInput] = useState<string>('');
  const [litresInput, setLitresInput] = useState<string>('');
  const [dieselPriceInput, setDieselPriceInput] = useState<string>(
    DEFAULT_DIESEL_PRICE.toString()
  );

  // Timings
  const [timings, setTimings] = useState<TimingItem[]>([
    { id: '1', hours: '1.25', label: 'Morning Session' },
  ]);

  // Notes & Saving state
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Load Tractors
  useEffect(() => {
    dieselService.getTractors().then(({ data }) => {
      if (data && data.length > 0) {
        setTractors(data);
        if (!selectedTractorId) {
          setSelectedTractorId(data[0].id);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (tractorId) {
      setSelectedTractorId(tractorId);
    }
  }, [tractorId]);

  const selectedTractor = tractors.find((t) => t.id === selectedTractorId);
  const startingFuel = selectedTractor ? Number(selectedTractor.current_fuel_litres) || 0 : 0;
  const dieselPrice = parseFloat(dieselPriceInput) || DEFAULT_DIESEL_PRICE;

  // Compute fuel added in litres & cost in rupees
  let addedLitres = 0;
  let totalCost = 0;

  if (inputMode === 'amount') {
    const amt = parseFloat(amountInput) || 0;
    totalCost = amt;
    addedLitres = amt > 0 ? calculateLitresFromAmount(amt, dieselPrice) : 0;
  } else {
    const ltr = parseFloat(litresInput) || 0;
    addedLitres = ltr;
    totalCost = Math.round(ltr * dieselPrice * 100) / 100;
  }

  // Sum working hours from all timing intervals
  const totalWorkingHours = timings.reduce((sum, item) => {
    const h = parseFloat(item.hours) || 0;
    return sum + h;
  }, 0);

  // Calculate diesel consumed at 4.00 L/hr
  const dieselConsumed = calculateDieselConsumed(totalWorkingHours);

  // Calculate remaining fuel
  const fuelCalc = calculateRemainingFuel(
    startingFuel + addedLitres,
    dieselConsumed
  );
  const remainingFuel = fuelCalc.remaining;
  const isFuelDeficit = fuelCalc.isInsufficient;

  // Add another timing row
  const handleAddTiming = () => {
    const nextIndex = timings.length + 1;
    setTimings([
      ...timings,
      {
        id: Date.now().toString(),
        hours: '',
        label: nextIndex === 2 ? 'Evening Session' : `Session ${nextIndex}`,
      },
    ]);
  };

  // Remove timing row
  const handleRemoveTiming = (id: string) => {
    if (timings.length === 1) {
      setTimings([{ id: '1', hours: '0', label: 'Session 1' }]);
      return;
    }
    setTimings(timings.filter((t) => t.id !== id));
  };

  // Update timing duration
  const handleTimingChange = (id: string, text: string) => {
    setTimings(
      timings.map((t) => (t.id === id ? { ...t, hours: text } : t))
    );
  };

  // Save Transaction
  const handleSave = async () => {
    if (!selectedTractorId) {
      Alert.alert('Select Tractor', 'Please select a tractor for this diesel record.');
      return;
    }

    if (totalWorkingHours <= 0 && addedLitres <= 0) {
      Alert.alert(
        'Empty Entry',
        'Please enter either fuel added or working hours for the tractor.'
      );
      return;
    }

    if (isFuelDeficit) {
      Alert.alert(
        'Insufficient Fuel',
        `This tractor cannot complete ${totalWorkingHours.toFixed(
          2
        )} hours of work. Total available fuel is ${formatLitres(
          startingFuel + addedLitres
        )}, but ${formatLitres(dieselConsumed)} is consumed at 4.00 L/hr.`
      );
      return;
    }

    setSaving(true);

    const timingDurations = timings
      .map((t) => parseFloat(t.hours) || 0)
      .filter((h) => h > 0);

    const { data, error } = await dieselService.createDieselTransaction(
      {
        tractor_id: selectedTractorId,
        input_mode: inputMode,
        diesel_amount: totalCost > 0 ? totalCost : null,
        diesel_price: dieselPrice,
        initial_fuel_litres: startingFuel,
        total_working_hours: totalWorkingHours,
        consumption_rate: DIESEL_CONSUMPTION_RATE_PER_HOUR,
        diesel_consumed: dieselConsumed,
        remaining_fuel: remainingFuel,
        notes: notes.trim(),
        created_by: user?.id,
      },
      timingDurations
    );

    setSaving(false);

    if (error || !data) {
      Alert.alert('Error', error?.message || 'Failed to save diesel record.');
    } else {
      Alert.alert(
        'Diesel Record Saved',
        `${selectedTractor?.name} tank balance updated to ${formatLitres(
          remainingFuel
        )}.`,
        [
          {
            text: 'View History',
            onPress: () => router.replace('/diesel/history'),
          },
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Log Diesel & Timings"
        subtitle="Fuel intake & machinery hours"
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: SELECT TRACTOR */}
          <Text style={styles.stepTitle}>Step 1: Select Tractor</Text>
          <View style={styles.tractorSelectorRow}>
            {tractors.map((tractor) => {
              const isSelected = tractor.id === selectedTractorId;
              const fuel = Number(tractor.current_fuel_litres) || 0;
              return (
                <TouchableOpacity
                  key={tractor.id}
                  style={[
                    styles.tractorSelectCard,
                    isSelected && styles.tractorSelectCardActive,
                  ]}
                  onPress={() => setSelectedTractorId(tractor.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tractorSelectName,
                      isSelected && styles.tractorSelectNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {tractor.name}
                  </Text>
                  <Text
                    style={[
                      styles.tractorSelectFuel,
                      isSelected && styles.tractorSelectFuelActive,
                    ]}
                  >
                    {fuel.toFixed(1)} L
                  </Text>
                  <Text style={styles.tractorSelectSub}>in tank</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* STEP 2: FUEL ADDED (DUAL INPUT MODES) */}
          <Text style={styles.stepTitle}>Step 2: Fuel Added (Optional)</Text>
          <Card>
            {/* Mode Toggle Bar */}
            <View style={styles.modeToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  inputMode === 'amount' && styles.modeButtonActive,
                ]}
                onPress={() => setInputMode('amount')}
              >
                <Ionicons
                  name="cash-outline"
                  size={16}
                  color={inputMode === 'amount' ? Colors.surface : Colors.text}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    inputMode === 'amount' && styles.modeButtonTextActive,
                  ]}
                >
                  Amount Mode (₹)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  inputMode === 'litres' && styles.modeButtonActive,
                ]}
                onPress={() => setInputMode('litres')}
              >
                <Ionicons
                  name="water-outline"
                  size={16}
                  color={inputMode === 'litres' ? Colors.surface : Colors.text}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    inputMode === 'litres' && styles.modeButtonTextActive,
                  ]}
                >
                  Litres Mode (L)
                </Text>
              </TouchableOpacity>
            </View>

            {inputMode === 'amount' ? (
              <View>
                <Input
                  label="Fuel Amount Paid (₹)"
                  placeholder="e.g. 3000"
                  value={amountInput}
                  onChangeText={setAmountInput}
                  keyboardType="decimal-pad"
                  leftElement={<Text style={styles.inputPrefix}>₹</Text>}
                />

                <View style={styles.calcPreviewRow}>
                  <Text style={styles.calcPreviewLabel}>
                    At ₹{dieselPrice.toFixed(2)}/L &rarr; Added Fuel:
                  </Text>
                  <Text style={styles.calcPreviewVal}>
                    +{formatLitres(addedLitres)}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Input
                  label="Litres Added (L)"
                  placeholder="e.g. 30"
                  value={litresInput}
                  onChangeText={setLitresInput}
                  keyboardType="decimal-pad"
                  leftElement={
                    <Ionicons name="water" size={18} color={Colors.primary} />
                  }
                />

                <View style={styles.calcPreviewRow}>
                  <Text style={styles.calcPreviewLabel}>
                    At ₹{dieselPrice.toFixed(2)}/L &rarr; Estimated Cost:
                  </Text>
                  <Text style={styles.calcPreviewVal}>
                    {formatCurrency(totalCost)}
                  </Text>
                </View>
              </View>
            )}

            {/* Configurable Diesel Price Accordion / Row */}
            <View style={styles.priceConfigRow}>
              <Text style={styles.priceConfigLabel}>Diesel Rate / Litre:</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>₹</Text>
                <Input
                  value={dieselPriceInput}
                  onChangeText={setDieselPriceInput}
                  keyboardType="decimal-pad"
                  containerStyle={styles.inlinePriceInputContainer}
                  inputStyle={styles.inlinePriceInput}
                />
              </View>
            </View>
          </Card>

          {/* STEP 3: WORKING TIMINGS (SUMMATION) */}
          <Text style={styles.stepTitle}>Step 3: Working Timings</Text>

          <Card>
            {timings.map((item, index) => (
              <View key={item.id} style={styles.timingRow}>
                <View style={styles.timingInfo}>
                  <Text style={styles.timingLabel}>
                    Interval #{index + 1}
                  </Text>
                  <Text style={styles.timingSub}>
                    {item.label || 'Work Session'}
                  </Text>
                </View>

                <View style={styles.timingInputBox}>
                  <Input
                    placeholder="e.g. 1.25"
                    value={item.hours}
                    onChangeText={(text) => handleTimingChange(item.id, text)}
                    keyboardType="decimal-pad"
                    containerStyle={styles.timingInputContainer}
                    inputStyle={styles.timingInputField}
                  />
                  <Text style={styles.timingUnit}>hrs</Text>
                </View>

                <TouchableOpacity
                  style={styles.removeTimingBtn}
                  onPress={() => handleRemoveTiming(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Quick Add Timing Slot inside Card */}
            <TouchableOpacity
              style={styles.addTimingCardBtn}
              onPress={handleAddTiming}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.addTimingCardBtnText}>+ Add Another Timing Slot</Text>
            </TouchableOpacity>

            <View style={styles.timingsTotalRow}>
              <Text style={styles.timingsTotalLabel}>TOTAL WORKING HOURS:</Text>
              <Text style={styles.timingsTotalValue}>
                {totalWorkingHours.toFixed(2)} hrs
              </Text>
            </View>
          </Card>

          {/* STEP 4: REAL-TIME FUEL CALCULATION & GUARD CARD */}
          <Text style={styles.stepTitle}>Step 4: Fuel Consumption & Balance</Text>
          <Card
            style={
              isFuelDeficit
                ? [styles.summaryCard, styles.summaryCardDeficit]
                : styles.summaryCard
            }
          >
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Starting Tank Balance</Text>
              <Text style={styles.summaryVal}>{formatLitres(startingFuel)}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: Colors.primary }]}>
                + Diesel Added
              </Text>
              <Text style={[styles.summaryVal, { color: Colors.primary }]}>
                +{formatLitres(addedLitres)}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: Colors.danger }]}>
                - Diesel Consumed (4.00 L/h × {totalWorkingHours.toFixed(2)}h)
              </Text>
              <Text style={[styles.summaryVal, { color: Colors.danger }]}>
                -{formatLitres(dieselConsumed)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.remainingBalanceRow}>
              <View>
                <Text style={styles.remainingBalanceLabel}>
                  REMAINING FUEL IN TANK
                </Text>
                <Text style={styles.remainingBalanceSub}>
                  {selectedTractor?.name}
                </Text>
              </View>
              <Text
                style={[
                  styles.remainingBalanceVal,
                  isFuelDeficit && { color: Colors.danger },
                ]}
              >
                {formatLitres(remainingFuel)}
              </Text>
            </View>

            {isFuelDeficit && (
              <View style={styles.deficitWarningBox}>
                <Ionicons name="warning" size={18} color={Colors.danger} />
                <Text style={styles.deficitWarningText}>
                  Insufficient fuel! Consuming {dieselConsumed.toFixed(2)} L
                  requires at least {dieselConsumed.toFixed(2)} L available, but
                  only {(startingFuel + addedLitres).toFixed(2)} L is in the
                  tank.
                </Text>
              </View>
            )}
          </Card>

          {/* Notes */}
          <Input
            label="Work Notes (Optional)"
            placeholder="Field details, implement used, or operator notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          {/* Save Button */}
          <Button
            title={
              isFuelDeficit
                ? 'Cannot Save: Insufficient Fuel'
                : 'Save Diesel Record'
            }
            onPress={handleSave}
            loading={saving}
            disabled={isFuelDeficit}
            style={{
              marginTop: Spacing.md,
              backgroundColor: isFuelDeficit ? Colors.textMuted : Colors.primary,
            }}
          />
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
  addTimingCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: '#F0FDF4',
    borderRadius: Layout.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderStyle: 'dashed',
    gap: 6,
  },
  addTimingCardBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  tractorSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tractorSelectCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  tractorSelectCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#ECFDF5',
  },
  tractorSelectName: {
    fontSize: 12,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  tractorSelectNameActive: {
    color: Colors.primary,
  },
  tractorSelectFuel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.black,
    color: Colors.text,
    marginTop: 4,
  },
  tractorSelectFuelActive: {
    color: Colors.primary,
  },
  tractorSelectSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Layout.borderRadius.sm,
    padding: 3,
    marginBottom: Spacing.md,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Layout.borderRadius.xs,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeButtonText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  modeButtonTextActive: {
    color: Colors.surface,
  },
  inputPrefix: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
  },
  calcPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: Layout.borderRadius.xs,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  calcPreviewLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  calcPreviewVal: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  priceConfigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  priceConfigLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlinePriceInputContainer: {
    width: 80,
    marginBottom: 0,
  },
  inlinePriceInput: {
    fontSize: Typography.fontSize.xs,
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timingInfo: {
    flex: 1,
  },
  timingLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  timingSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  timingInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timingInputContainer: {
    width: 75,
    marginBottom: 0,
  },
  timingInputField: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    paddingVertical: 6,
  },
  timingUnit: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  removeTimingBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  timingsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  timingsTotalLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  timingsTotalValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.black,
    color: Colors.primary,
  },
  summaryCard: {
    padding: Spacing.md,
  },
  summaryCardDeficit: {
    borderColor: Colors.danger,
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  summaryVal: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  remainingBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  remainingBalanceLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  remainingBalanceSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  remainingBalanceVal: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.black,
    color: Colors.primary,
  },
  deficitWarningBox: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    padding: Spacing.sm,
    borderRadius: Layout.borderRadius.xs,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  deficitWarningText: {
    flex: 1,
    fontSize: 11,
    color: Colors.danger,
    lineHeight: 15,
  },
});
