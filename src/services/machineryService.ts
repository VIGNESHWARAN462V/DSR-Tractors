import { supabase } from '@/lib/supabase';
import {
  ServiceMaster,
  ServiceTransaction,
  ServiceTransactionItem,
} from '@/types/database';
import { DEFAULT_DIESEL_PRICE, DEFAULT_SERVICE_RATES } from '@/utils/calculations';
import { getDatabase, generateUUID } from '@/lib/sqlite/database';
import { syncService } from './syncService';

export const machineryService = {
  /**
   * Fetch active services master data from database or fallback to defaults
   */
  async getServices(): Promise<{ data: ServiceMaster[]; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const [servicesRes, settingsRes] = await Promise.all([
            supabase.from('services').select('*').order('name', { ascending: true }),
            supabase.from('settings').select('*'),
          ]);

          const data = servicesRes.data;
          const settingsMap: Record<string, string> = {};
          (settingsRes.data || []).forEach((row: any) => {
            settingsMap[row.key] = row.value;
          });

          const solamWithWorker = settingsMap['solam_with_worker_rate']
            ? parseFloat(settingsMap['solam_with_worker_rate'])
            : 100;
          const solamNoWorker = settingsMap['solam_without_worker_rate']
            ? parseFloat(settingsMap['solam_without_worker_rate'])
            : 75;

          if (data && data.length > 0) {
            const seenNames = new Set<string>();
            const masters: ServiceMaster[] = [];

            for (const s of data) {
              const isSolam = s.name?.toLowerCase().includes('solam');
              const normalizedName = isSolam ? 'Solam' : s.name;

              if (seenNames.has(normalizedName)) continue;
              seenNames.add(normalizedName);

              masters.push({
                id: s.id,
                name: normalizedName,
                category: s.category,
                unit: isSolam ? 'bundle' : s.unit,
                rate: isSolam ? solamWithWorker : Number(s.rate),
                worker_type: s.worker_type,
                has_worker_types: Boolean(isSolam || s.has_worker_types || s.worker_type),
                worker_rate: isSolam ? solamWithWorker : (s.worker_rate ?? null),
                no_worker_rate: isSolam ? solamNoWorker : (s.no_worker_rate ?? null),
                is_active: s.active !== false && s.is_active !== false,
                created_at: s.created_at,
                updated_at: s.updated_at,
              });
            }

            // Cache to SQLite in background
            getDatabase().then(async (db) => {
              for (const m of masters) {
                await db.runAsync(
                  `INSERT OR REPLACE INTO offline_services (id, name, unit, rate, has_worker_types, worker_rate, no_worker_rate, is_active, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    m.id,
                    m.name,
                    m.unit,
                    m.rate,
                    m.has_worker_types ? 1 : 0,
                    m.worker_rate ?? null,
                    m.no_worker_rate ?? null,
                    m.is_active ? 1 : 0,
                    m.created_at,
                    m.updated_at,
                  ]
                );
              }
            });

            return { data: masters, error: null };
          }
        } catch {
          // offline fallback
        }
      }

      // SQLite Fallback
      const db = await getDatabase();
      const localRows = await db.getAllAsync<any>('SELECT * FROM offline_services ORDER BY name ASC');

      if (localRows && localRows.length > 0) {
        const masters: ServiceMaster[] = localRows.map((s: any) => ({
          id: s.id,
          name: s.name,
          unit: s.unit,
          rate: Number(s.rate),
          has_worker_types: Boolean(s.has_worker_types),
          worker_rate: s.worker_rate !== null ? Number(s.worker_rate) : null,
          no_worker_rate: s.no_worker_rate !== null ? Number(s.no_worker_rate) : null,
          is_active: Boolean(s.is_active),
          created_at: s.created_at || new Date().toISOString(),
          updated_at: s.updated_at || new Date().toISOString(),
        }));
        return { data: masters, error: null };
      }

      // Default fallback
      const fallback: ServiceMaster[] = Object.entries(DEFAULT_SERVICE_RATES).map(
        ([name, config], index) => ({
          id: `default-${index}`,
          name,
          unit: config.unit,
          rate: name === 'Solam' ? 100 : config.rate,
          has_worker_types: Boolean(config.workerRates),
          worker_rate: name === 'Solam' ? 100 : config.workerRates?.with_worker,
          no_worker_rate: name === 'Solam' ? 75 : config.workerRates?.without_worker,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      );

      return { data: fallback, error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Update a standard service rate in database
   */
  async updateServiceRate(
    id: string,
    newRate: number
  ): Promise<{ error: Error | null }> {
    try {
      const now = new Date().toISOString();
      const rateVal = Math.round(newRate * 100) / 100;

      // 1. Update SQLite
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE offline_services SET rate = ?, updated_at = ? WHERE id = ?',
        [rateVal, now, id]
      );

      // 2. If online, attempt push
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error } = await supabase
            .from('services')
            .update({
              rate: rateVal,
              updated_at: now,
            })
            .eq('id', id);

          if (!error) return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('services', 'UPDATE', id, { rate: rateVal, updated_at: now });
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Update Solam worker rates in settings table
   */
  async updateSolamWorkerRates(
    withWorkerRate: number,
    withoutWorkerRate: number,
    solamServiceId?: string
  ): Promise<{ error: Error | null }> {
    try {
      const now = new Date().toISOString();
      const db = await getDatabase();

      if (solamServiceId) {
        await db.runAsync(
          'UPDATE offline_services SET rate = ?, worker_rate = ?, no_worker_rate = ?, updated_at = ? WHERE id = ?',
          [withWorkerRate, withWorkerRate, withoutWorkerRate, now, solamServiceId]
        );
      }

      await db.runAsync(
        `INSERT OR REPLACE INTO offline_settings (key, value, updated_at) VALUES ('solam_with_worker_rate', ?, ?)`,
        [String(withWorkerRate), now]
      );
      await db.runAsync(
        `INSERT OR REPLACE INTO offline_settings (key, value, updated_at) VALUES ('solam_without_worker_rate', ?, ?)`,
        [String(withoutWorkerRate), now]
      );

      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          if (solamServiceId) {
            await supabase
              .from('services')
              .update({
                rate: Math.round(withWorkerRate * 100) / 100,
                updated_at: now,
              })
              .eq('id', solamServiceId);
          }

          await Promise.all([
            supabase.from('settings').upsert(
              {
                key: 'solam_with_worker_rate',
                value: String(withWorkerRate),
                updated_at: now,
              },
              { onConflict: 'key' }
            ),
            supabase.from('settings').upsert(
              {
                key: 'solam_without_worker_rate',
                value: String(withoutWorkerRate),
                updated_at: now,
              },
              { onConflict: 'key' }
            ),
          ]);

          return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('settings', 'UPDATE', 'solam_with_worker_rate', {
        key: 'solam_with_worker_rate',
        value: String(withWorkerRate),
        updated_at: now,
      });
      await syncService.enqueueChange('settings', 'UPDATE', 'solam_without_worker_rate', {
        key: 'solam_without_worker_rate',
        value: String(withoutWorkerRate),
        updated_at: now,
      });

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Update diesel price setting
   */
  async updateDieselPriceSetting(price: number): Promise<{ error: Error | null }> {
    try {
      const now = new Date().toISOString();
      const db = await getDatabase();
      await db.runAsync(
        `INSERT OR REPLACE INTO offline_settings (key, value, updated_at) VALUES ('diesel_price', ?, ?)`,
        [String(price), now]
      );

      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error } = await supabase.from('settings').upsert(
            {
              key: 'diesel_price',
              value: String(price),
              updated_at: now,
            },
            { onConflict: 'key' }
          );

          if (!error) return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('settings', 'UPDATE', 'diesel_price', {
        key: 'diesel_price',
        value: String(price),
        updated_at: now,
      });

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Fetch settings key-value pairs
   */
  async getSettings(): Promise<{ data: Record<string, string>; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase.from('settings').select('*');
          if (!error && data) {
            const map: Record<string, string> = {};
            data.forEach((row: any) => {
              map[row.key] = row.value;
            });
            return { data: map, error: null };
          }
        } catch {
          // SQLite fallback
        }
      }

      const db = await getDatabase();
      const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT * FROM offline_settings');
      const map: Record<string, string> = {};
      (rows || []).forEach((row) => {
        map[row.key] = row.value;
      });
      return { data: map, error: null };
    } catch (err: any) {
      return { data: {}, error: err };
    }
  },

  /**
   * Create a new service transaction with multiple line items (Offline-First)
   */
  async createServiceTransaction(
    transaction: {
      user_id?: string;
      customer_id: string;
      total_amount: number;
      transaction_date?: string;
      service_date?: string;
      notes?: string;
    },
    items: Array<{
      service_name: string;
      quantity: number;
      unit: string;
      worker_type?: string | null;
      rate?: number;
      unit_rate?: number;
      amount?: number;
      total_amount?: number;
      service_id?: string | null;
    }>
  ): Promise<{ data: ServiceTransaction | null; error: Error | null }> {
    try {
      const txId = generateUUID();
      const now = new Date().toISOString();
      const serviceDate =
        transaction.service_date ||
        transaction.transaction_date ||
        now.split('T')[0];

      const headerPayload: any = {
        id: txId,
        customer_id: transaction.customer_id,
        service_date: serviceDate,
        total_amount: transaction.total_amount,
        notes: (transaction.notes || '').trim(),
        created_at: now,
        updated_at: now,
      };

      if (transaction.user_id) {
        headerPayload.created_by = transaction.user_id;
        headerPayload.user_id = transaction.user_id;
      }

      // 1. Insert header & items into local SQLite
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO offline_service_transactions (id, customer_id, service_date, total_amount, notes, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, headerPayload.customer_id, serviceDate, headerPayload.total_amount, headerPayload.notes, headerPayload.user_id || null, now, now]
      );

      const itemsPayload = items.map((item) => {
        const itemId = generateUUID();
        const rate = item.rate ?? item.unit_rate ?? 0;
        const amount = item.amount ?? item.total_amount ?? 0;
        return {
          id: itemId,
          transaction_id: txId,
          service_id: item.service_id || null,
          service_name: item.service_name,
          worker_type: item.worker_type || null,
          quantity: item.quantity,
          unit: item.unit,
          rate,
          amount,
          created_at: now,
        };
      });

      for (const item of itemsPayload) {
        await db.runAsync(
          `INSERT INTO offline_service_transaction_items (id, transaction_id, service_id, service_name, quantity, unit, worker_type, rate, amount, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.id, txId, item.service_id, item.service_name, item.quantity, item.unit, item.worker_type, item.rate, item.amount, now]
        );
      }

      const createdTxn: ServiceTransaction = {
        id: txId,
        customer_id: headerPayload.customer_id,
        service_date: serviceDate,
        transaction_date: serviceDate,
        total_amount: headerPayload.total_amount,
        notes: headerPayload.notes,
        created_at: now,
        updated_at: now,
        items: itemsPayload,
      };

      // 2. If online, attempt push
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error: txError } = await supabase
            .from('service_transactions')
            .insert([headerPayload]);

          if (!txError) {
            await supabase.from('service_transaction_items').insert(itemsPayload);
            return { data: createdTxn, error: null };
          }
        } catch {
          // queue fallback
        }
      }

      // Enqueue header and items for cloud sync
      await syncService.enqueueChange('service_transactions', 'INSERT', txId, headerPayload);
      for (const item of itemsPayload) {
        await syncService.enqueueChange('service_transaction_items', 'INSERT', item.id, item);
      }

      return { data: createdTxn, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Fetch recent service transactions with customer details
   */
  async getRecentTransactions(
    userId?: string,
    limit: number = 20
  ): Promise<{ data: ServiceTransaction[]; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('service_transactions')
            .select('*, customer:customers(*), items:service_transaction_items(*)')
            .order('service_date', { ascending: false })
            .limit(limit);

          if (!error && data) {
            const formatted = data.map((t: any) => ({
              ...t,
              transaction_date: t.service_date,
              customer: t.customer
                ? {
                    ...t.customer,
                    village: t.customer.location || t.customer.village || '',
                  }
                : undefined,
            }));

            return { data: formatted as ServiceTransaction[], error: null };
          }
        } catch {
          // SQLite fallback
        }
      }

      // SQLite Fallback
      const db = await getDatabase();
      const txRows = await db.getAllAsync<any>(
        `SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.location as customer_location
         FROM offline_service_transactions t
         LEFT JOIN offline_customers c ON t.customer_id = c.id
         ORDER BY t.service_date DESC
         LIMIT ?`,
        [limit]
      );

      const results: ServiceTransaction[] = [];
      for (const row of txRows || []) {
        const items = await db.getAllAsync<any>(
          'SELECT * FROM offline_service_transaction_items WHERE transaction_id = ?',
          [row.id]
        );

        results.push({
          id: row.id,
          customer_id: row.customer_id,
          service_date: row.service_date,
          transaction_date: row.service_date,
          total_amount: Number(row.total_amount),
          notes: row.notes,
          created_at: row.created_at,
          updated_at: row.updated_at,
          customer: row.customer_name
            ? {
                id: row.customer_id,
                name: row.customer_name,
                phone: row.customer_phone || '',
                location: row.customer_location || '',
                village: row.customer_location || '',
                created_at: '',
                updated_at: '',
              }
            : undefined,
          items: items || [],
        });
      }

      return { data: results, error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Fetch transaction by ID with complete breakdown
   */
  async getTransactionById(
    id: string
  ): Promise<{ data: ServiceTransaction | null; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('service_transactions')
            .select('*, customer:customers(*), items:service_transaction_items(*)')
            .eq('id', id)
            .single();

          if (!error && data) {
            const formatted: ServiceTransaction = {
              ...data,
              transaction_date: data.service_date,
              customer: data.customer
                ? {
                    ...data.customer,
                    village: data.customer.location || data.customer.village || '',
                  }
                : undefined,
              items: (data.items || []).map((it: any) => ({
                ...it,
                unit_rate: it.rate,
                total_amount: it.amount,
              })),
            };

            return { data: formatted, error: null };
          }
        } catch {
          // SQLite fallback
        }
      }

      const db = await getDatabase();
      const row = await db.getFirstAsync<any>(
        `SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.location as customer_location
         FROM offline_service_transactions t
         LEFT JOIN offline_customers c ON t.customer_id = c.id
         WHERE t.id = ?`,
        [id]
      );

      if (!row) return { data: null, error: null };

      const items = await db.getAllAsync<any>(
        'SELECT * FROM offline_service_transaction_items WHERE transaction_id = ?',
        [id]
      );

      const formatted: ServiceTransaction = {
        id: row.id,
        customer_id: row.customer_id,
        service_date: row.service_date,
        transaction_date: row.service_date,
        total_amount: Number(row.total_amount),
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        customer: row.customer_name
          ? {
              id: row.customer_id,
              name: row.customer_name,
              phone: row.customer_phone || '',
              location: row.customer_location || '',
              village: row.customer_location || '',
              created_at: '',
              updated_at: '',
            }
          : undefined,
        items: (items || []).map((it: any) => ({
          ...it,
          unit_rate: it.rate,
          total_amount: it.amount,
        })),
      };

      return { data: formatted, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<{ error: Error | null }> {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM offline_service_transaction_items WHERE transaction_id = ?', [id]);
      await db.runAsync('DELETE FROM offline_service_transactions WHERE id = ?', [id]);

      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error } = await supabase
            .from('service_transactions')
            .delete()
            .eq('id', id);

          if (!error) return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('service_transactions', 'DELETE', id, {});
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },
};
