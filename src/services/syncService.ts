import { getDatabase, generateUUID } from '@/lib/sqlite/database';
import { supabase } from '@/lib/supabase';
import NetInfo from '@react-native-community/netinfo';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  error?: string | null;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  payload: string;
  status: 'pending' | 'syncing' | 'failed';
  retry_count: number;
  error_message?: string | null;
  created_at: string;
}

export const syncService = {
  /**
   * Check if device is connected to the internet
   */
  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return !!(state.isConnected && state.isInternetReachable !== false);
    } catch {
      return false;
    }
  },

  /**
   * Get the number of pending changes in the sync queue
   */
  async getPendingCount(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM sync_queue WHERE status != 'synced'"
      );
      return result?.count || 0;
    } catch {
      return 0;
    }
  },

  /**
   * Enqueue a database modification into the local sync queue
   */
  async enqueueChange(
    tableName: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    payload: any
  ): Promise<string> {
    const db = await getDatabase();
    const id = generateUUID();
    const now = new Date().toISOString();
    const payloadStr = JSON.stringify(payload);

    await db.runAsync(
      `INSERT INTO sync_queue (id, table_name, operation, record_id, payload, status, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [id, tableName, operation, recordId, payloadStr, now]
    );

    return id;
  },

  /**
   * Process all pending items in the sync queue sequentially
   */
  async processSyncQueue(): Promise<SyncResult> {
    const online = await this.isOnline();
    if (!online) {
      return { success: false, syncedCount: 0, error: 'Device is offline' };
    }

    const db = await getDatabase();
    // Reset any stalled 'syncing' items back to 'pending'
    await db.runAsync("UPDATE sync_queue SET status = 'pending' WHERE status = 'syncing'");

    const pendingItems = await db.getAllAsync<SyncQueueItem>(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC"
    );

    if (!pendingItems || pendingItems.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let syncedCount = 0;

    for (const item of pendingItems) {
      try {
        await db.runAsync("UPDATE sync_queue SET status = 'syncing' WHERE id = ?", [item.id]);
        const payload = JSON.parse(item.payload);

        let syncError: any = null;

        if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
          // Special handling for tables that might need specific upsert syntax
          const { error } = await supabase.from(item.table_name).upsert(payload);
          syncError = error;
        } else if (item.operation === 'DELETE') {
          const { error } = await supabase.from(item.table_name).delete().eq('id', item.record_id);
          syncError = error;
        }

        if (syncError) {
          console.warn(`Sync failed for ${item.table_name} record ${item.record_id}:`, syncError.message);
          await db.runAsync(
            "UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, error_message = ? WHERE id = ?",
            [syncError.message || 'Unknown sync error', item.id]
          );
        } else {
          // Success: Remove item from queue
          await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
          syncedCount++;
        }
      } catch (err: any) {
        console.warn(`Exception syncing item ${item.id}:`, err);
        await db.runAsync(
          "UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, error_message = ? WHERE id = ?",
          [err?.message || 'Sync exception', item.id]
        );
      }
    }

    return { success: true, syncedCount };
  },

  /**
   * Pull the latest data snapshots from Supabase and cache locally in SQLite
   */
  async pullSnapshotFromSupabase(): Promise<void> {
    const online = await this.isOnline();
    if (!online) return;

    const db = await getDatabase();

    try {
      // 1. Pull Customers
      const { data: customers } = await supabase.from('customers').select('*');
      if (customers && customers.length > 0) {
        for (const c of customers) {
          await db.runAsync(
            `INSERT OR REPLACE INTO offline_customers (id, user_id, name, phone, location, village, address, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              c.id,
              c.user_id || null,
              c.name,
              c.phone || null,
              c.location || c.village || null,
              c.village || c.location || null,
              c.address || null,
              c.notes || null,
              c.created_at || null,
              c.updated_at || null,
            ]
          );
        }
      }

      // 2. Pull Services Master
      const { data: services } = await supabase.from('services').select('*');
      if (services && services.length > 0) {
        for (const s of services) {
          await db.runAsync(
            `INSERT OR REPLACE INTO offline_services (id, name, unit, rate, has_worker_types, worker_rate, no_worker_rate, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id,
              s.name,
              s.unit,
              Number(s.rate) || 0,
              s.has_worker_types ? 1 : 0,
              s.worker_rate !== null ? Number(s.worker_rate) : null,
              s.no_worker_rate !== null ? Number(s.no_worker_rate) : null,
              s.is_active !== false ? 1 : 0,
              s.created_at || null,
              s.updated_at || null,
            ]
          );
        }
      }

      // 3. Pull Tractors
      const { data: tractors } = await supabase.from('tractors').select('*');
      if (tractors && tractors.length > 0) {
        for (const t of tractors) {
          await db.runAsync(
            `INSERT OR REPLACE INTO offline_tractors (id, name, current_fuel_litres, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              t.id,
              t.name,
              Number(t.current_fuel_litres) || 0,
              t.is_active !== false ? 1 : 0,
              t.created_at || null,
              t.updated_at || null,
            ]
          );
        }
      }

      // 4. Pull Recent Service Transactions (last 100)
      const { data: txns } = await supabase
        .from('service_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (txns && txns.length > 0) {
        for (const txn of txns) {
          await db.runAsync(
            `INSERT OR REPLACE INTO offline_service_transactions (id, customer_id, service_date, total_amount, notes, user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              txn.id,
              txn.customer_id,
              txn.service_date || txn.transaction_date,
              Number(txn.total_amount) || 0,
              txn.notes || null,
              txn.user_id || txn.created_by || null,
              txn.created_at || null,
              txn.updated_at || null,
            ]
          );
        }
      }

      // 5. Pull Recent Payments (last 100)
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (payments && payments.length > 0) {
        for (const p of payments) {
          await db.runAsync(
            `INSERT OR REPLACE INTO offline_payments (id, customer_id, service_transaction_id, amount, payment_method, payment_date, notes, user_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.customer_id,
              p.service_transaction_id || null,
              Number(p.amount) || 0,
              p.payment_method || 'Cash',
              p.payment_date || new Date().toISOString(),
              p.notes || null,
              p.user_id || p.created_by || null,
              p.created_at || null,
            ]
          );
        }
      }

      // 6. Pull Recent Diesel Transactions (last 100)
      const { data: dieselTxns } = await supabase
        .from('diesel_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (dieselTxns && dieselTxns.length > 0) {
        for (const d of dieselTxns) {
          await db.runAsync(
            `INSERT OR REPLACE INTO offline_diesel_transactions (
              id, tractor_id, input_mode, diesel_amount, diesel_price, initial_fuel_litres,
              total_working_hours, consumption_rate, diesel_consumed, remaining_fuel,
              transaction_date, notes, user_id, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              d.id,
              d.tractor_id,
              d.input_mode || 'amount',
              d.diesel_amount !== null ? Number(d.diesel_amount) : null,
              Number(d.diesel_price) || 100.5,
              Number(d.initial_fuel_litres) || 0,
              Number(d.total_working_hours) || 0,
              Number(d.consumption_rate) || 4.0,
              Number(d.diesel_consumed) || 0,
              Number(d.remaining_fuel) || 0,
              d.transaction_date || d.created_at,
              d.notes || null,
              d.user_id || d.created_by || null,
              d.created_at || null,
            ]
          );
        }
      }
    } catch (err) {
      console.warn('Error pulling snapshots from Supabase:', err);
    }
  },

  /**
   * Full bidirectional sync: Flushes local queue to cloud, then refreshes local cache
   */
  async fullBidirectionalSync(): Promise<SyncResult> {
    const queueResult = await this.processSyncQueue();
    await this.pullSnapshotFromSupabase();
    return queueResult;
  },
};
