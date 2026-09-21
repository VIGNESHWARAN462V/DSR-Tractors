import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors, Spacing } from '@/constants/theme';
import { customerService } from '@/services/customerService';
import { useAuth } from '@/context/AuthContext';

export default function NewCustomerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter customer name.');
      return;
    }
    if (!village.trim()) {
      setError('Please enter village or location.');
      return;
    }

    if (!user) {
      Alert.alert('Session Error', 'Please sign in to save customers.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: saveError } = await customerService.createCustomer({
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim(),
      village: village.trim(),
      address: address.trim(),
      notes: notes.trim(),
    });

    setLoading(false);

    if (saveError || !data) {
      Alert.alert('Error', saveError?.message || 'Failed to save customer.');
    } else {
      Alert.alert('Customer Added', `${data.name} has been added successfully!`, [
        {
          text: 'View Details',
          onPress: () => router.replace(`/customers/${data.id}` as any),
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Add Customer" subtitle="New farmer account" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Card>
            <Input
              label="Customer / Farmer Name *"
              placeholder="e.g. Murugan"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError(null);
              }}
              autoCapitalize="words"
              leftElement={
                <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
              }
            />

            <Input
              label="Phone Number"
              placeholder="e.g. 9842100000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftElement={
                <Ionicons name="call-outline" size={20} color={Colors.textMuted} />
              }
            />

            <Input
              label="Village / Location *"
              placeholder="e.g. Thoppur"
              value={village}
              onChangeText={(t) => {
                setVillage(t);
                setError(null);
              }}
              autoCapitalize="words"
              leftElement={
                <Ionicons name="location-outline" size={20} color={Colors.textMuted} />
              }
            />

            <Input
              label="Address"
              placeholder="Door No, Street or landmark"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />

            <Input
              label="Notes"
              placeholder="Land acreage, soil details, or instructions"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              title="Save Customer"
              onPress={handleSave}
              loading={loading}
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    padding: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
  },
});
