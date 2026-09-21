import { supabase } from '@/lib/supabase';
import { Payment } from '@/types/database';
import { getDatabase, generateUUID } from '@/lib/sqlite/database';
import { syncService } from './syncService';

export const paymentService = {
  /**
   * Fetch all payments with customer details (Supabase + SQLite offline fallback)
   */
  async getPayments(
    userId?: string,
    limit: number = 50
  ): Promise<{ data: Payment[]; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('payments')
            .select('*, customer:customers(*)')
            .order('payment_date', { ascending: false })
            .limit(limit);

          if (!error && data) {
            const formatted = data.map((p: any) => ({
              ...p,
              customer: p.customer
                ? {
                    ...p.customer,
                    village: p.customer.location || p.customer.village || '',
                  }
                : undefined,
            }));

            // Background cache to SQLite
            getDatabase().then(async (db) => {
              for (const p of formatted) {
                await db.runAsync(
                  `INSERT OR REPLACE INTO offline_payments (id, customer_id, service_transaction_id, amount, payment_method, payment_date, notes, user_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [p.id, p.customer_id, p.service_transaction_id || null, p.amount, p.payment_method, p.payment_date, p.notes || null, p.user_id || p.created_by || null, p.created_at]
                );
              }
            });

            return { data: formatted as Payment[], error: null };
          }
        } catch {
          // SQLite fallback
        }
      }

      // SQLite Fallback
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT p.*, c.name as customer_name, c.phone as customer_phone, c.location as customer_location
         FROM offline_payments p
         LEFT JOIN offline_customers c ON p.customer_id = c.id
         ORDER BY p.payment_date DESC
         LIMIT ?`,
        [limit]
      );

      const formatted: Payment[] = (rows || []).map((row) => ({
        id: row.id,
        customer_id: row.customer_id,
        service_transaction_id: row.service_transaction_id,
        amount: Number(row.amount),
        payment_method: row.payment_method,
        payment_date: row.payment_date,
        notes: row.notes,
        created_at: row.created_at,
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
      }));

      return { data: formatted, error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Record a new customer payment (Offline-First)
   */
  async recordPayment(
    payment: {
      customer_id: string;
      amount: number;
      payment_method: string;
      payment_date?: string;
      notes?: string;
      service_transaction_id?: string | null;
      user_id?: string;
      created_by?: string | null;
    }
  ): Promise<{ data: Payment | null; error: Error | null }> {
    try {
      const payId = generateUUID();
      const now = new Date().toISOString();
      const paymentDate = payment.payment_date || now.split('T')[0];

      const payload: any = {
        id: payId,
        customer_id: payment.customer_id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_date: paymentDate,
        notes: (payment.notes || '').trim(),
        created_at: now,
      };

      if (payment.service_transaction_id) {
        payload.service_transaction_id = payment.service_transaction_id;
      }
      if (payment.user_id || payment.created_by) {
        payload.created_by = payment.user_id || payment.created_by;
        payload.user_id = payment.user_id || payment.created_by;
      }

      // 1. Save to SQLite
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO offline_payments (id, customer_id, service_transaction_id, amount, payment_method, payment_date, notes, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [payId, payload.customer_id, payload.service_transaction_id || null, payload.amount, payload.payment_method, paymentDate, payload.notes, payload.user_id || null, now]
      );

      const customerRow = await db.getFirstAsync<any>(
        'SELECT * FROM offline_customers WHERE id = ?',
        [payload.customer_id]
      );

      const createdPayment: Payment = {
        ...payload,
        customer: customerRow
          ? {
              ...customerRow,
              village: customerRow.location || customerRow.village || '',
            }
          : undefined,
      };

      // 2. If online, attempt push
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('payments')
            .insert([payload])
            .select('*, customer:customers(*)')
            .single();

          if (!error && data) {
            return {
              data: {
                ...data,
                customer: data.customer
                  ? {
                      ...data.customer,
                      village: data.customer.location || data.customer.village || '',
                    }
                  : undefined,
              },
              error: null,
            };
          }
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('payments', 'INSERT', payId, payload);
      return { data: createdPayment, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Delete a payment
   */
  async deletePayment(id: string): Promise<{ error: Error | null }> {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM offline_payments WHERE id = ?', [id]);

      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error } = await supabase.from('payments').delete().eq('id', id);
          if (!error) return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('payments', 'DELETE', id, {});
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },
};
