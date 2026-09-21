import { supabase } from '@/lib/supabase';
import { Customer, CustomerFinancialSummary, Payment, ServiceTransaction } from '@/types/database';
import { calculateCustomerBalance, getPaymentStatus } from '@/utils/calculations';
import { getDatabase, generateUUID } from '@/lib/sqlite/database';
import { syncService } from './syncService';

export const customerService = {
  /**
   * Fetch all customers with optional search query (Supabase + SQLite offline fallback)
   */
  async getCustomers(userId?: string, search?: string): Promise<{ data: Customer[]; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name', { ascending: true });

          if (!error && data) {
            let customers = data.map((c: any) => ({
              ...c,
              village: c.location || c.village || '',
              location: c.location || c.village || '',
            })) as Customer[];

            // Cache to SQLite in background
            getDatabase().then(async (db) => {
              for (const c of customers) {
                await db.runAsync(
                  `INSERT OR REPLACE INTO offline_customers (id, user_id, name, phone, location, village, address, notes, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [c.id, c.user_id || null, c.name, c.phone || null, c.location || null, c.village || null, c.address || null, c.notes || null, c.created_at || null, c.updated_at || null]
                );
              }
            });

            if (search && search.trim()) {
              const s = search.toLowerCase().trim();
              customers = customers.filter(
                (c) =>
                  c.name?.toLowerCase().includes(s) ||
                  (c.phone && c.phone.includes(s)) ||
                  (c.location && c.location.toLowerCase().includes(s)) ||
                  (c.village && c.village.toLowerCase().includes(s))
              );
            }

            return { data: customers, error: null };
          }
        } catch (onlineErr) {
          console.log('Online fetch failed, falling back to SQLite cache');
        }
      }

      // Offline / SQLite Cache fallback
      const db = await getDatabase();
      const localData = await db.getAllAsync<any>(
        'SELECT * FROM offline_customers ORDER BY name ASC'
      );

      let customers = (localData || []).map((c: any) => ({
        ...c,
        village: c.location || c.village || '',
        location: c.location || c.village || '',
      })) as Customer[];

      if (search && search.trim()) {
        const s = search.toLowerCase().trim();
        customers = customers.filter(
          (c) =>
            c.name?.toLowerCase().includes(s) ||
            (c.phone && c.phone.includes(s)) ||
            (c.location && c.location.toLowerCase().includes(s)) ||
            (c.village && c.village.toLowerCase().includes(s))
        );
      }

      return { data: customers, error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Fetch single customer by ID
   */
  async getCustomerById(id: string): Promise<{ data: Customer | null; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

          if (!error && data) {
            return {
              data: {
                ...data,
                village: data.location || data.village || '',
                location: data.location || data.village || '',
              } as Customer,
              error: null,
            };
          }
        } catch {
          // fallback to SQLite
        }
      }

      const db = await getDatabase();
      const row = await db.getFirstAsync<any>(
        'SELECT * FROM offline_customers WHERE id = ?',
        [id]
      );

      if (!row) return { data: null, error: null };

      return {
        data: {
          ...row,
          village: row.location || row.village || '',
          location: row.location || row.village || '',
        } as Customer,
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Create a new customer (Offline-First: saves locally, queues sync if offline)
   */
  async createCustomer(
    customer: {
      name: string;
      phone?: string;
      location?: string;
      village?: string;
      address?: string;
      notes?: string;
      user_id?: string;
    }
  ): Promise<{ data: Customer | null; error: Error | null }> {
    try {
      const id = generateUUID();
      const now = new Date().toISOString();
      const location = (customer.location || customer.village || '').trim();

      const payload = {
        id,
        name: customer.name.trim(),
        phone: (customer.phone || '').trim(),
        location,
        address: (customer.address || '').trim(),
        notes: (customer.notes || '').trim(),
        created_at: now,
        updated_at: now,
      };

      // 1. Save to local SQLite
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO offline_customers (id, user_id, name, phone, location, village, address, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, customer.user_id || null, payload.name, payload.phone, location, location, payload.address, payload.notes, now, now]
      );

      const localCustomer: Customer = {
        ...payload,
        village: location,
        user_id: customer.user_id,
      };

      // 2. If online, attempt push; if fails or offline, enqueue
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('customers')
            .insert([payload])
            .select()
            .single();

          if (!error && data) {
            return {
              data: { ...data, village: data.location } as Customer,
              error: null,
            };
          }
        } catch {
          // offline queue fallback
        }
      }

      // Enqueue to sync queue
      await syncService.enqueueChange('customers', 'INSERT', id, payload);

      return { data: localCustomer, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Update existing customer
   */
  async updateCustomer(
    id: string,
    updates: {
      name?: string;
      phone?: string;
      location?: string;
      village?: string;
      address?: string;
      notes?: string;
    }
  ): Promise<{ data: Customer | null; error: Error | null }> {
    try {
      const now = new Date().toISOString();
      const payload: any = {
        ...updates,
        updated_at: now,
      };

      if (updates.village !== undefined && updates.location === undefined) {
        payload.location = updates.village;
      }
      delete payload.village;

      // 1. Update SQLite
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE offline_customers
         SET name = COALESCE(?, name),
             phone = COALESCE(?, phone),
             location = COALESCE(?, location),
             village = COALESCE(?, village),
             address = COALESCE(?, address),
             notes = COALESCE(?, notes),
             updated_at = ?
         WHERE id = ?`,
        [payload.name || null, payload.phone || null, payload.location || null, payload.location || null, payload.address || null, payload.notes || null, now, id]
      );

      // 2. If online, attempt push
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('customers')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

          if (!error && data) {
            return {
              data: { ...data, village: data.location } as Customer,
              error: null,
            };
          }
        } catch {
          // queue fallback
        }
      }

      // Enqueue update
      await syncService.enqueueChange('customers', 'UPDATE', id, payload);

      const updatedRow = await db.getFirstAsync<any>('SELECT * FROM offline_customers WHERE id = ?', [id]);
      return {
        data: updatedRow ? ({ ...updatedRow, village: updatedRow.location } as Customer) : null,
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Delete customer
   */
  async deleteCustomer(id: string): Promise<{ error: Error | null }> {
    try {
      // 1. Delete from SQLite
      const db = await getDatabase();
      await db.runAsync('DELETE FROM offline_customers WHERE id = ?', [id]);

      // 2. If online, attempt push
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { error } = await supabase.from('customers').delete().eq('id', id);
          if (!error) return { error: null };
        } catch {
          // queue fallback
        }
      }

      await syncService.enqueueChange('customers', 'DELETE', id, {});
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Calculate financial summary and ledger balance for a customer
   */
  async getCustomerLedgerSummary(
    customerId: string
  ): Promise<{ data: CustomerFinancialSummary; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const { data: txs, error: txError } = await supabase
            .from('service_transactions')
            .select('total_amount')
            .eq('customer_id', customerId);

          if (!txError && txs) {
            const { data: payments, error: payError } = await supabase
              .from('payments')
              .select('amount')
              .eq('customer_id', customerId);

            if (!payError && payments) {
              const totalCharges = txs.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
              const totalPayments = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
              const balance = calculateCustomerBalance(totalCharges, totalPayments);
              const status = getPaymentStatus(totalCharges, totalPayments);

              return {
                data: {
                  customer_id: customerId,
                  customer_name: '',
                  total_charges: Math.round(totalCharges * 100) / 100,
                  total_payments: Math.round(totalPayments * 100) / 100,
                  balance,
                  status,
                },
                error: null,
              };
            }
          }
        } catch {
          // fallback to local SQLite
        }
      }

      // Offline SQLite computation
      const db = await getDatabase();
      const txRows = await db.getAllAsync<{ total_amount: number }>(
        'SELECT total_amount FROM offline_service_transactions WHERE customer_id = ?',
        [customerId]
      );
      const payRows = await db.getAllAsync<{ amount: number }>(
        'SELECT amount FROM offline_payments WHERE customer_id = ?',
        [customerId]
      );

      const totalCharges = (txRows || []).reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
      const totalPayments = (payRows || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const balance = calculateCustomerBalance(totalCharges, totalPayments);
      const status = getPaymentStatus(totalCharges, totalPayments);

      return {
        data: {
          customer_id: customerId,
          customer_name: '',
          total_charges: Math.round(totalCharges * 100) / 100,
          total_payments: Math.round(totalPayments * 100) / 100,
          balance,
          status,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: {
          customer_id: customerId,
          customer_name: '',
          total_charges: 0,
          total_payments: 0,
          balance: 0,
          status: 'Pending',
        },
        error: err,
      };
    }
  },

  /**
   * Fetch complete customer activity: transactions and payments
   */
  async getCustomerHistory(
    customerId: string
  ): Promise<{ transactions: ServiceTransaction[]; payments: Payment[]; error: Error | null }> {
    try {
      const isOnline = await syncService.isOnline();
      if (isOnline) {
        try {
          const [txResult, payResult] = await Promise.all([
            supabase
              .from('service_transactions')
              .select('*, items:service_transaction_items(*)')
              .eq('customer_id', customerId)
              .order('service_date', { ascending: false }),
            supabase
              .from('payments')
              .select('*')
              .eq('customer_id', customerId)
              .order('payment_date', { ascending: false }),
          ]);

          if (!txResult.error && !payResult.error) {
            return {
              transactions: (txResult.data as ServiceTransaction[]) || [],
              payments: (payResult.data as Payment[]) || [],
              error: null,
            };
          }
        } catch {
          // fallback to SQLite
        }
      }

      // SQLite Fallback
      const db = await getDatabase();
      const txRows = await db.getAllAsync<any>(
        'SELECT * FROM offline_service_transactions WHERE customer_id = ? ORDER BY service_date DESC',
        [customerId]
      );
      const payRows = await db.getAllAsync<any>(
        'SELECT * FROM offline_payments WHERE customer_id = ? ORDER BY payment_date DESC',
        [customerId]
      );

      // Fetch items for each transaction
      const transactionsWithItems: ServiceTransaction[] = [];
      for (const tx of txRows || []) {
        const items = await db.getAllAsync<any>(
          'SELECT * FROM offline_service_transaction_items WHERE transaction_id = ?',
          [tx.id]
        );
        transactionsWithItems.push({
          ...tx,
          items: items || [],
        });
      }

      return {
        transactions: transactionsWithItems,
        payments: (payRows as Payment[]) || [],
        error: null,
      };
    } catch (err: any) {
      return { transactions: [], payments: [], error: err };
    }
  },
};
