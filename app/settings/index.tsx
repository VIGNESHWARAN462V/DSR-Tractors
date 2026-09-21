import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { useSync } from '@/context/SyncContext';
import { machineryService } from '@/services/machineryService';
import { ServiceMaster } from '@/types/database';
import { DEFAULT_DIESEL_PRICE } from '@/utils/calculations';

interface EditableRate {
  id: string;
  name: string;
  unit: string;
  rate: string;
  worker_rate?: string;
  no_worker_rate?: string;
  has_worker_types?: boolean;
}

export default function SettingsScreen() {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow } = useSync();
  const [dieselPrice, setDieselPrice] = useState(DEFAULT_DIESEL_PRICE.toString());
  const [services, setServices] = useState<EditableRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDiesel, setSavingDiesel] = useState(false);
  const [savingServices, setSavingServices] = useState(false);

  const handleManualSync = async () => {
    const res = await syncNow();
    if (res.success) {
      Alert.alert(
        'Sync Complete',
        `Database is up to date with cloud.${res.syncedCount > 0 ? ` ${res.syncedCount} changes pushed to Supabase.` : ' No pending changes.'}`
      );
      loadSettingsData();
    } else {
      Alert.alert('Sync Failed', res.error || 'Could not sync with Supabase.');
    }
  };

  const loadSettingsData = async () => {
    try {
      const [servicesRes, settingsRes] = await Promise.all([
        machineryService.getServices(),
        machineryService.getSettings(),
      ]);

      if (settingsRes.data?.['diesel_price']) {
        setDieselPrice(settingsRes.data['diesel_price']);
      }

      if (servicesRes.data) {
        const editableList: EditableRate[] = servicesRes.data.map((s) => ({
          id: s.id,
          name: s.name,
          unit: s.unit,
          rate: s.rate.toString(),
          worker_rate: s.worker_rate?.toString() || '100',
          no_worker_rate: s.no_worker_rate?.toString() || '75',
          has_worker_types: s.has_worker_types,
        }));
        setServices(editableList);
      }
    } catch (e) {
      console.warn('Error loading settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  // Save Diesel Price
  const handleSaveDieselPrice = async () => {
    const priceNum = parseFloat(dieselPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid diesel price greater than 0.');
      return;
    }

    setSavingDiesel(true);
    const { error } = await machineryService.updateDieselPriceSetting(priceNum);
    setSavingDiesel(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to update diesel price.');
    } else {
      Alert.alert('Price Updated', `Default diesel rate set to ₹${priceNum.toFixed(2)}/L.`);
    }
  };

  // Update local state when editing a rate input
  const handleRateChange = (id: string, text: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, rate: text } : s))
    );
  };

  const handleSolamWorkerRateChange = (id: string, text: string, type: 'with' | 'without') => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (type === 'with') {
          return { ...s, worker_rate: text, rate: text };
        } else {
          return { ...s, no_worker_rate: text };
        }
      })
    );
  };

  // Save all service rates to Supabase
  const handleSaveAllRates = async () => {
    setSavingServices(true);
    let hasError = false;

    for (const item of services) {
      const isSolam = item.name.toLowerCase().includes('solam');
      if (isSolam) {
        const withRate = parseFloat(item.worker_rate || '100') || 100;
        const withoutRate = parseFloat(item.no_worker_rate || '75') || 75;
        const { error } = await machineryService.updateSolamWorkerRates(
          withRate,
          withoutRate,
          item.id
        );
        if (error) hasError = true;
      } else {
        const numRate = parseFloat(item.rate) || 0;
        const { error } = await machineryService.updateServiceRate(item.id, numRate);
        if (error) hasError = true;
      }
    }

    setSavingServices(false);

    if (hasError) {
      Alert.alert('Partial Error', 'Some rates could not be updated. Please try again.');
    } else {
      Alert.alert('Rates Saved', 'All machinery service rates have been updated successfully in Supabase!');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Settings"
        subtitle="Diesel pricing & machinery service rates"
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
          {/* OFFLINE STORAGE & CLOUD SYNC */}
          <Text style={styles.sectionHeading}>Offline Storage & Cloud Sync</Text>
          <Card style={{ marginBottom: Spacing.lg }}>
            <View style={styles.syncCardHeader}>
              <View style={styles.syncStatusLeft}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isOnline ? '#10B981' : '#F59E0B' },
                  ]}
                />
                <Text style={styles.syncStatusTitle}>
                  {isOnline ? 'Online (Supabase Connected)' : 'Offline (Local SQLite Cache)'}
                </Text>
              </View>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: pendingCount > 0 ? '#FEF3C7' : '#DCFCE7' },
                ]}
              >
                <Text
                  style={[
                    styles.badgePillText,
                    { color: pendingCount > 0 ? '#B45309' : '#15803D' },
                  ]}
                >
                  {pendingCount > 0 ? `${pendingCount} pending` : 'All Synced'}
                </Text>
              </View>
            </View>

            <Text style={styles.cardSubtitle}>
              All customers, service transactions, and diesel logs are cached locally in SQLite for full offline operation in farm fields.
            </Text>

            {lastSyncTime && (
              <Text style={styles.lastSyncText}>
                Last Synced: {lastSyncTime.toLocaleTimeString()} ({lastSyncTime.toLocaleDateString()})
              </Text>
            )}

            <Button
              title={isSyncing ? 'Syncing...' : 'Sync All with Cloud'}
              onPress={handleManualSync}
              loading={isSyncing}
              disabled={isSyncing}
              variant="outline"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>

          {/* FUEL PRICING CONFIGURATION */}
          <Text style={styles.sectionHeading}>Fuel Pricing Configuration</Text>
          <Card>
            <Text style={styles.cardTitle}>Default Diesel Rate</Text>
            <Text style={styles.cardSubtitle}>
              Used for auto-converting between Rupees and Litres in new fuel entries.
            </Text>

            <Input
              label="Diesel Rate (₹ per Litre)"
              placeholder="100.50"
              value={dieselPrice}
              onChangeText={setDieselPrice}
              keyboardType="decimal-pad"
              leftElement={<Text style={styles.currencyPrefix}>₹</Text>}
            />

            <Button
              title="Save Diesel Rate"
              onPress={handleSaveDieselPrice}
              loading={savingDiesel}
              style={{ marginTop: Spacing.xs }}
            />
          </Card>

          {/* MACHINERY RATES CONFIGURATION */}
          <View style={styles.ratesHeaderRow}>
            <Text style={styles.sectionHeading}>Machinery & Service Rates</Text>
          </View>

          <Card>
            <Text style={styles.cardTitle}>Base Rates & Pricing</Text>
            <Text style={styles.cardSubtitle}>
              Update the default unit rate for each tractor machinery service. These new rates will be used automatically in all future jobs and calculations.
            </Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading master rates...</Text>
              </View>
            ) : (
              services.map((item) => {
                const isSolam = item.name.toLowerCase().includes('solam');

                if (isSolam) {
                  return (
                    <View key={item.id} style={styles.solamRateBlock}>
                      <View style={styles.rateTitleRow}>
                        <Text style={styles.serviceNameBold}>{item.name}</Text>
                        <Text style={styles.unitBadge}>PER {item.unit.toUpperCase()}</Text>
                      </View>

                      <View style={styles.solamInputsRow}>
                        <View style={styles.solamInputCol}>
                          <Text style={styles.solamInputLabel}>ஆள் உண்டு (With Worker)</Text>
                          <View style={styles.currencyInputRow}>
                            <Text style={styles.subCurrency}>₹</Text>
                            <Input
                              value={item.worker_rate || '100'}
                              onChangeText={(t) =>
                                handleSolamWorkerRateChange(item.id, t, 'with')
                              }
                              keyboardType="decimal-pad"
                              containerStyle={styles.rateInputContainer}
                              inputStyle={styles.rateInputText}
                            />
                          </View>
                        </View>

                        <View style={styles.solamInputCol}>
                          <Text style={styles.solamInputLabel}>ஆள் இல்லை (No Worker)</Text>
                          <View style={styles.currencyInputRow}>
                            <Text style={styles.subCurrency}>₹</Text>
                            <Input
                              value={item.no_worker_rate || '75'}
                              onChangeText={(t) =>
                                handleSolamWorkerRateChange(item.id, t, 'without')
                              }
                              keyboardType="decimal-pad"
                              containerStyle={styles.rateInputContainer}
                              inputStyle={styles.rateInputText}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={item.id} style={styles.serviceRateRow}>
                    <View style={styles.serviceInfoCol}>
                      <Text style={styles.serviceName}>{item.name}</Text>
                      <Text style={styles.serviceUnitText}>Per {item.unit}</Text>
                    </View>

                    <View style={styles.currencyInputRow}>
                      <Text style={styles.subCurrency}>₹</Text>
                      <Input
                        value={item.rate}
                        onChangeText={(text) => handleRateChange(item.id, text)}
                        keyboardType="decimal-pad"
                        containerStyle={styles.rateInputContainer}
                        inputStyle={styles.rateInputText}
                      />
                    </View>
                  </View>
                );
              })
            )}

            <Button
              title="Save All Machinery Rates"
              onPress={handleSaveAllRates}
              loading={savingServices}
              style={{ marginTop: Spacing.md }}
            />
          </Card>

          {/* TRACTORS CONFIGURATION SNAPSHOT */}
          <Text style={styles.sectionHeading}>Registered Fleet</Text>
          <Card>
            <Text style={styles.cardTitle}>Fleet Tractors</Text>
            <View style={styles.tractorRow}>
              <Text style={styles.tractorName}>• SWARAJ 50HP</Text>
              <Text style={styles.tractorBadge}>Active</Text>
            </View>
            <View style={styles.tractorRow}>
              <Text style={styles.tractorName}>• SWARAJ 46HP</Text>
              <Text style={styles.tractorBadge}>Active</Text>
            </View>
            <View style={styles.tractorRow}>
              <Text style={styles.tractorName}>• SWARAJ (OLD)</Text>
              <Text style={styles.tractorBadge}>Active</Text>
            </View>
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
    marginBottom: Spacing.sm,
  },
  ratesHeaderRow: {
    marginTop: Spacing.sm,
  },
  cardTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  currencyPrefix: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    marginRight: 4,
  },
  loadingBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  loadingText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  serviceRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  serviceInfoCol: {
    flex: 1,
  },
  serviceName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  serviceUnitText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subCurrency: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  rateInputContainer: {
    width: 95,
    marginBottom: 0,
  },
  rateInputText: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    paddingVertical: 6,
    fontWeight: Typography.fontWeight.bold,
  },
  solamRateBlock: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rateTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  serviceNameBold: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  unitBadge: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  solamInputsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  solamInputCol: {
    flex: 1,
  },
  solamInputLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  tractorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tractorName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  tractorBadge: {
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
    fontWeight: Typography.fontWeight.bold,
  },
  syncCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.xs,
  },
  syncStatusTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  badgePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
  },
  lastSyncText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
});
