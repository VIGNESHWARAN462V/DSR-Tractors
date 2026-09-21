import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SyncProvider } from '@/context/SyncContext';
import { Colors } from '@/constants/theme';

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const currentSegments = segments as string[];
    const inAuthGroup = currentSegments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect to the login screen if unauthenticated
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      // Redirect to dashboard if already authenticated
      router.replace('/(tabs)' as any);
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="customers"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="services"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="payments"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="diesel"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="settings/index"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <StatusBar style="dark" />
          <RootLayoutNav />
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
