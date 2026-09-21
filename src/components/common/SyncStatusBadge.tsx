import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '@/context/SyncContext';
import { Colors, Spacing, Typography } from '@/constants/theme';

interface SyncStatusBadgeProps {
  showWhenSynced?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ showWhenSynced = false }) => {
  const { isOnline, isSyncing, pendingCount, syncNow } = useSync();

  if (isSyncing) {
    return (
      <View style={[styles.container, styles.syncingContainer]}>
        <ActivityIndicator size="small" color={Colors.primary} style={styles.icon} />
        <Text style={[styles.text, styles.syncingText]}>Syncing changes with cloud...</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.offlineContainer]}
        onPress={() => syncNow()}
        activeOpacity={0.8}
      >
        <Ionicons name="cloud-offline" size={16} color="#B45309" style={styles.icon} />
        <Text style={[styles.text, styles.offlineText]}>
          Offline Mode {pendingCount > 0 ? `• ${pendingCount} pending sync` : ''}
        </Text>
        <Ionicons name="refresh" size={14} color="#B45309" />
      </TouchableOpacity>
    );
  }

  if (pendingCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.pendingContainer]}
        onPress={() => syncNow()}
        activeOpacity={0.8}
      >
        <Ionicons name="cloud-upload" size={16} color={Colors.primary} style={styles.icon} />
        <Text style={[styles.text, styles.pendingText]}>
          {pendingCount} unsynced change{pendingCount > 1 ? 's' : ''} • Tap to sync
        </Text>
        <Ionicons name="refresh" size={14} color={Colors.primary} />
      </TouchableOpacity>
    );
  }

  if (showWhenSynced) {
    return (
      <View style={[styles.container, styles.syncedContainer]}>
        <Ionicons name="checkmark-circle" size={14} color="#15803D" style={styles.icon} />
        <Text style={[styles.text, styles.syncedText]}>Synced with cloud</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
    alignSelf: 'center',
    marginVertical: Spacing.xs,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    marginRight: Spacing.xs,
  },
  syncingContainer: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  syncingText: {
    color: Colors.primary,
  },
  offlineContainer: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  offlineText: {
    color: '#92400E',
  },
  pendingContainer: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    borderWidth: 1,
  },
  pendingText: {
    color: '#0369A1',
  },
  syncedContainer: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    borderWidth: 1,
  },
  syncedText: {
    color: '#166534',
  },
});
