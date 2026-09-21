import { supabase } from '@/lib/supabase';
import { DieselTransaction, DieselTiming, Tractor } from '@/types/database';
import { DIESEL_CONSUMPTION_RATE_PER_HOUR, DEFAULT_DIESEL_PRICE } from '@/utils/calculations';
import { getDatabase, generateUUID } from '@/lib/sqlite/database';
import { syncService } from './syncService';

export interface CreateDieselPayload {
  tractor_id: string;
  input_mode: 'amount' | 'litres';
  diesel_amount?: number | null;
  diesel_price: number;
  initial_fuel_litres: number;
  total_working_hours: number;
  consumption_rate?: number;
  diesel_consumed: number;
  remaining_fuel: number;
  transaction_date?: string;
  notes?: string;
  created_by?: string | null;
}

export interface FleetStats {
  total_fleet_fuel: number;
  total_diesel_consumed: number;
  total_working_hours: number;
  total_diesel_spent: number;
  active_tractors_count: number;
}

export const dieselService = {
  /**
   * Fetch all tractors with their live fuel balances (Supabase + SQLite offline fallback)
   */
  async getTractors(): Promise<{ data: Tractor[]; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('tractors')
            .select('*')
            .order('name', { ascending: true });

          if (!error && data) {
            // Cache to SQLite in background
            getDatabase().then(async (db) => {
              for (const t of data) {
                await db.runAsync(
                  `INSERT OR REPLACE INTO offline_tractors (id, name, current_fuel_litres, is_active, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [t.id, t.name, Number(t.current_fuel_litres) || 0, t.active !== false ? 1 : 0, t.created_at, t.updated_at]
                );
              }
            });

            return { data: (data as Tractor[]) || [], error: null };
          }
        } catch {
          // fallback to SQLite
        }
      }

      // SQLite Fallback
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>('SELECT * FROM offline_tractors ORDER BY name ASC');
      if (rows && rows.length > 0) {
        return {
          data: rows.map((r) => ({
            id: r.id,
            name: r.name,
            current_fuel_litres: Number(r.current_fuel_litres),
            active: Boolean(r.is_active),
            created_at: r.created_at || new Date().toISOString(),
            updated_at: r.updated_at || new Date().toISOString(),
          })),
          error: null,
        };
      }

      // Hardcoded fallback tractors if fresh installation has no data
      const defaultTractors: Tractor[] = [
        { id: '1', name: 'SWARAJ 50HP', current_fuel_litres: 30.0, active: true, created_at: '', updated_at: '' },
        { id: '2', name: 'SWARAJ 46HP', current_fuel_litres: 25.0, active: true, created_at: '', updated_at: '' },
        { id: '3', name: 'SWARAJ (OLD)', current_fuel_litres: 20.0, active: true, created_at: '', updated_at: '' },
      ];
      return { data: defaultTractors, error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Fetch single tractor by ID
   */
  async getTractorById(id: string): Promise<{ data: Tractor | null; error: Error | null }> {
    try {
      const tractorsRes = await this.getTractors();
      const tractor = tractorsRes.data.find((t) => t.id === id) || null;
      return { data: tractor, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Update tractor tank fuel balance
   */
  async updateTractorFuel(
    tractorId: string,
    newFuelLitres: number
  ): Promise<{ error: Error | null }> {
    try {
      const rounded = Math.round(newFuelLitres * 100) / 100;
      const now = new Date().toISOString();

      // 1. Update SQLite
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE offline_tractors SET current_fuel_litres = ?, updated_at = ? WHERE id = ?',
        [rounded, now, tractorId]
      );

      // 2. If online, attempt push
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error } = await supabase
            .from('tractors')
            .update({
              current_fuel_litres: rounded,
              updated_at: now,
            })
            .eq('id', tractorId);

          if (!error) return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('tractors', 'UPDATE', tractorId, {
        current_fuel_litres: rounded,
        updated_at: now,
      });

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Create a diesel transaction with working timings and update tractor fuel balance (Offline-First)
   */
  async createDieselTransaction(
    payload: CreateDieselPayload,
    timings: number[]
  ): Promise<{ data: DieselTransaction | null; error: Error | null }> {
    try {
      const txId = generateUUID();
      const now = new Date().toISOString();
      const transactionDate = payload.transaction_date || now.split('T')[0];

      const headerRecord: any = {
        id: txId,
        tractor_id: payload.tractor_id,
        input_mode: payload.input_mode,
        diesel_amount: payload.diesel_amount ?? null,
        diesel_price: payload.diesel_price || DEFAULT_DIESEL_PRICE,
        initial_fuel_litres: Math.round(payload.initial_fuel_litres * 100) / 100,
        total_working_hours: Math.round(payload.total_working_hours * 100) / 100,
        consumption_rate: payload.consumption_rate || DIESEL_CONSUMPTION_RATE_PER_HOUR,
        diesel_consumed: Math.round(payload.diesel_consumed * 100) / 100,
        remaining_fuel: Math.round(payload.remaining_fuel * 100) / 100,
        transaction_date: transactionDate,
        notes: (payload.notes || '').trim(),
        created_at: now,
      };

      if (payload.created_by) {
        headerRecord.created_by = payload.created_by;
        headerRecord.user_id = payload.created_by;
      }

      // 1. Insert header & timings into SQLite
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO offline_diesel_transactions (
          id, tractor_id, input_mode, diesel_amount, diesel_price, initial_fuel_litres,
          total_working_hours, consumption_rate, diesel_consumed, remaining_fuel,
          transaction_date, notes, user_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          headerRecord.tractor_id,
          headerRecord.input_mode,
          headerRecord.diesel_amount,
          headerRecord.diesel_price,
          headerRecord.initial_fuel_litres,
          headerRecord.total_working_hours,
          headerRecord.consumption_rate,
          headerRecord.diesel_consumed,
          headerRecord.remaining_fuel,
          headerRecord.transaction_date,
          headerRecord.notes,
          headerRecord.user_id || null,
          now,
        ]
      );

      const timingsPayload = timings.map((h) => ({
        id: generateUUID(),
        diesel_transaction_id: txId,
        timing_hours: Math.round(h * 100) / 100,
        created_at: now,
      }));

      for (const t of timingsPayload) {
        await db.runAsync(
          'INSERT INTO offline_diesel_timings (id, diesel_transaction_id, timing_hours, created_at) VALUES (?, ?, ?, ?)',
          [t.id, txId, t.timing_hours, now]
        );
      }

      // Update tractor tank in SQLite
      await this.updateTractorFuel(payload.tractor_id, payload.remaining_fuel);

      const tractorRow = await db.getFirstAsync<any>(
        'SELECT * FROM offline_tractors WHERE id = ?',
        [payload.tractor_id]
      );

      const createdTxn: DieselTransaction = {
        ...headerRecord,
        tractor: tractorRow ? { ...tractorRow, active: Boolean(tractorRow.is_active) } : undefined,
        timings: timingsPayload,
      };

      // 2. If online, attempt push
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data: txData, error: txError } = await supabase
            .from('diesel_transactions')
            .insert([headerRecord])
            .select('*, tractor:tractors(*)')
            .single();

          if (!txError && txData) {
            if (timingsPayload.length > 0) {
              await supabase.from('diesel_timings').insert(
                timingsPayload.map((t) => ({
                  diesel_transaction_id: txId,
                  timing_hours: t.timing_hours,
                }))
              );
            }
            return { data: txData as DieselTransaction, error: null };
          }
        } catch {
          // queue fallback
        }
      }

      // Enqueue header and child timings for sync
      await syncService.enqueueChange('diesel_transactions', 'INSERT', txId, headerRecord);
      for (const t of timingsPayload) {
        await syncService.enqueueChange('diesel_timings', 'INSERT', t.id, t);
      }

      return { data: createdTxn, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Fetch diesel transactions with optional tractor filter and pagination
   */
  async getDieselTransactions(
    limit: number = 50,
    tractorId?: string
  ): Promise<{ data: DieselTransaction[]; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          let query = supabase
            .from('diesel_transactions')
            .select('*, tractor:tractors(*), timings:diesel_timings(*)')
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit);

          if (tractorId) {
            query = query.eq('tractor_id', tractorId);
          }

          const { data, error } = await query;
          if (!error && data) {
            return { data: (data as DieselTransaction[]) || [], error: null };
          }
        } catch {
          // SQLite fallback
        }
      }

      // SQLite Fallback
      const db = await getDatabase();
      let queryStr = `
        SELECT d.*, t.name as tractor_name
        FROM offline_diesel_transactions d
        LEFT JOIN offline_tractors t ON d.tractor_id = t.id
      `;
      const queryParams: any[] = [];

      if (tractorId) {
        queryStr += ' WHERE d.tractor_id = ?';
        queryParams.push(tractorId);
      }

      queryStr += ' ORDER BY d.transaction_date DESC, d.created_at DESC LIMIT ?';
      queryParams.push(limit);

      const rows = await db.getAllAsync<any>(queryStr, queryParams);
      const results: DieselTransaction[] = [];

      for (const r of rows || []) {
        const timings = await db.getAllAsync<any>(
          'SELECT * FROM offline_diesel_timings WHERE diesel_transaction_id = ?',
          [r.id]
        );

        results.push({
          id: r.id,
          tractor_id: r.tractor_id,
          input_mode: r.input_mode,
          diesel_amount: r.diesel_amount !== null ? Number(r.diesel_amount) : null,
          diesel_price: Number(r.diesel_price),
          initial_fuel_litres: Number(r.initial_fuel_litres),
          total_working_hours: Number(r.total_working_hours),
          consumption_rate: Number(r.consumption_rate),
          diesel_consumed: Number(r.diesel_consumed),
          remaining_fuel: Number(r.remaining_fuel),
          transaction_date: r.transaction_date,
          notes: r.notes,
          created_at: r.created_at,
          tractor: r.tractor_name
            ? {
                id: r.tractor_id,
                name: r.tractor_name,
                current_fuel_litres: 0,
                active: true,
                created_at: '',
                updated_at: '',
              }
            : undefined,
          timings: timings || [],
        });
      }

      return { data: results, error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Delete a diesel transaction and revert tractor fuel
   */
  async deleteDieselTransaction(id: string): Promise<{ error: Error | null }> {
    try {
      const db = await getDatabase();
      const tx = await db.getFirstAsync<any>(
        'SELECT * FROM offline_diesel_transactions WHERE id = ?',
        [id]
      );

      if (tx) {
        await this.updateTractorFuel(tx.tractor_id, tx.initial_fuel_litres);
      }

      await db.runAsync('DELETE FROM offline_diesel_timings WHERE diesel_transaction_id = ?', [id]);
      await db.runAsync('DELETE FROM offline_diesel_transactions WHERE id = ?', [id]);

      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error } = await supabase
            .from('diesel_transactions')
            .delete()
            .eq('id', id);

          if (!error) return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('diesel_transactions', 'DELETE', id, {});
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Compute fleet statistics across all tractors and diesel logs
   */
  async getFleetStats(): Promise<{ data: FleetStats; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const [tractorsRes, txsRes] = await Promise.all([
            supabase.from('tractors').select('current_fuel_litres, active'),
            supabase.from('diesel_transactions').select('diesel_consumed, total_working_hours, diesel_amount'),
          ]);

          if (!tractorsRes.error && !txsRes.error) {
            const tractors = tractorsRes.data || [];
            const txs = txsRes.data || [];

            const totalFleetFuel = tractors.reduce((sum, t) => sum + (Number(t.current_fuel_litres) || 0), 0);
            const totalDieselConsumed = txs.reduce((sum, tx) => sum + (Number(tx.diesel_consumed) || 0), 0);
            const totalWorkingHours = txs.reduce((sum, tx) => sum + (Number(tx.total_working_hours) || 0), 0);
            const totalDieselSpent = txs.reduce((sum, tx) => sum + (Number(tx.diesel_amount) || 0), 0);
            const activeCount = tractors.filter((t) => t.active !== false).length;

            return {
              data: {
                total_fleet_fuel: Math.round(totalFleetFuel * 100) / 100,
                total_diesel_consumed: Math.round(totalDieselConsumed * 100) / 100,
                total_working_hours: Math.round(totalWorkingHours * 100) / 100,
                total_diesel_spent: Math.round(totalDieselSpent * 100) / 100,
                active_tractors_count: activeCount,
              },
              error: null,
            };
          }
        } catch {
          // SQLite fallback
        }
      }

      // SQLite Fallback
      const db = await getDatabase();
      const tractors = await db.getAllAsync<{ current_fuel_litres: number; is_active: number }>(
        'SELECT current_fuel_litres, is_active FROM offline_tractors'
      );
      const txs = await db.getAllAsync<{ diesel_consumed: number; total_working_hours: number; diesel_amount: number }>(
        'SELECT diesel_consumed, total_working_hours, diesel_amount FROM offline_diesel_transactions'
      );

      const totalFleetFuel = (tractors || []).reduce((sum, t) => sum + (Number(t.current_fuel_litres) || 0), 0);
      const totalDieselConsumed = (txs || []).reduce((sum, tx) => sum + (Number(tx.diesel_consumed) || 0), 0);
      const totalWorkingHours = (txs || []).reduce((sum, tx) => sum + (Number(tx.total_working_hours) || 0), 0);
      const totalDieselSpent = (txs || []).reduce((sum, tx) => sum + (Number(tx.diesel_amount) || 0), 0);
      const activeCount = (tractors || []).filter((t) => t.is_active !== 0).length || 3;

      return {
        data: {
          total_fleet_fuel: Math.round(totalFleetFuel * 100) / 100,
          total_diesel_consumed: Math.round(totalDieselConsumed * 100) / 100,
          total_working_hours: Math.round(totalWorkingHours * 100) / 100,
          total_diesel_spent: Math.round(totalDieselSpent * 100) / 100,
          active_tractors_count: activeCount,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: {
          total_fleet_fuel: 0,
          total_diesel_consumed: 0,
          total_working_hours: 0,
          total_diesel_spent: 0,
          active_tractors_count: 3,
        },
        error: err,
      };
    }
  },
};
