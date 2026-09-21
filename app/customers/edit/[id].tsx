import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors, Spacing } from '@/constants/theme';
import { customerService } from '@/services/customerService';

export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    customerService.getCustomerById(id).then(({ data, error }) => {
      if (data) {
        setName(data.name);
        setPhone(data.phone || '');
        setVillage(data.village || '');
        setAddress(data.address || '');
        setNotes(data.notes || '');
      }
      setLoading(false);
    });
  }, [id]);

  const handleUpdate = async () => {
    if (!name.trim() || !village.trim()) {
      Alert.alert('Required Fields', 'Please enter customer name and village.');
      return;
    }

    setSaving(true);
    const { error } = await customerService.updateCustomer(id!, {
      name: name.trim(),
      phone: phone.trim(),
      village: village.trim(),
      address: address.trim(),
      notes: notes.trim(),
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to update customer.');
    } else {
      Alert.alert('Updated', 'Customer details saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${name}? This will also delete their related service and payment records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await customerService.deleteCustomer(id!);
            setDeleting(false);
            if (error) {
              Alert.alert('Error', error.message || 'Failed to delete customer.');
            } else {
              Alert.alert('Deleted', 'Customer record deleted.', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/customers' as any) },
              ]);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Edit Customer" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Edit Customer" subtitle={name} showBack />

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
              label="Customer Name *"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Village / Location *"
              value={village}
              onChangeText={setVillage}
              autoCapitalize="words"
            />

            <Input
              label="Address"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />

            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />

            <Button
              title="Save Changes"
              onPress={handleUpdate}
              loading={saving}
              style={{ marginTop: Spacing.sm }}
            />

            <Button
              title="Delete Customer"
              variant="danger"
              onPress={handleDelete}
              loading={deleting}
              style={{ marginTop: Spacing.md }}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
