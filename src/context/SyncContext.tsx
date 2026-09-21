import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncService, SyncResult } from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<SyncResult>;
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const isSyncingRef = useRef<boolean>(false);
  const hasInitialSyncedRef = useRef<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await syncService.getPendingCount();
      setPendingCount(count);
    } catch (err) {
      if (__DEV__) {
        console.warn('Error refreshing pending count:', err);
      }
    }
  }, []);

  // Stable syncNow function with session verification & timeout protection
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    // Only perform network sync if user is authenticated
    if (!session?.user) {
      return { success: false, syncedCount: 0, error: 'User not authenticated' };
    }

    if (isSyncingRef.current) {
      return { success: false, syncedCount: 0, error: 'Sync already in progress' };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      // Safety timeout of 10s to ensure syncing can never hang indefinitely
      const syncPromise = syncService.fullBidirectionalSync();
      const timeoutPromise = new Promise<SyncResult>((_, reject) =>
        setTimeout(() => reject(new Error('Sync timed out')), 10000)
      );

      const result = await Promise.race([syncPromise, timeoutPromise]);
      const count = await syncService.getPendingCount();
      setPendingCount(count);

      if (result.success) {
        setLastSyncTime(new Date());
      }
      return result;
    } catch (err: any) {
      if (__DEV__) {
        console.warn('SyncNow exception:', err?.message);
      }
      return { success: false, syncedCount: 0, error: err?.message || 'Sync failed' };
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    // Only run online check and initial sync when authenticated
    if (session?.user) {
      syncService.isOnline().then((online) => {
        if (!isMounted) return;
        setIsOnline(online);
        if (online && !hasInitialSyncedRef.current) {
          hasInitialSyncedRef.current = true;
          syncNow();
        }
      });
    }

    refreshPendingCount();

    // Subscribe to network state transitions
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (!isMounted) return;
      const online = !!(state.isConnected && state.isInternetReachable !== false);

      setIsOnline((prevOnline) => {
        // Only trigger sync on actual transition from offline to online when authenticated
        if (!prevOnline && online && session?.user) {
          syncNow();
        }
        return online;
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [session, syncNow, refreshPendingCount]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncTime,
        syncNow,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextType {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
