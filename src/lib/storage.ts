// ========================================================
// DSR TRACTORS — Adaptive Data Repository Layer
// Supports Supabase PostgreSQL + Local Offline Fallback
// ========================================================

import type {
  Customer,
  CustomerBalanceInfo,
  ServiceMaster,
  ServiceTransaction,
  ServiceTransactionItem,
  Payment,
  Tractor,
  DieselTransaction,
  DieselTiming,
  AppSettings,
  DashboardSummary,
  ActivityItem,
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { calculateCustomerBalance, calculateGrandTotal, roundToTwoDecimals } from '../utils/calculator';

const LOCAL_STORAGE_KEY_PREFIX = 'dsr_tractors_';

// Event emitter for local reactivity
type StorageListener = (table: string, payload: any) => void;
const listeners: Set<StorageListener> = new Set();

export function notifyChange(table: string, payload?: any) {
  listeners.forEach((listener) => listener(table, payload));
}

export function subscribeToChanges(callback: StorageListener): () => void {
  listeners.add(callback);

  // If Supabase is configured, also attach Supabase Realtime channel
  let supabaseChannel: any = null;
  if (isSupabaseConfigured() && supabase) {
    const channelId = 'schema-db-changes-' + Math.random().toString(36).substring(2, 9);
    supabaseChannel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        callback(payload.table, payload);
      })
      .subscribe();
  }

  return () => {
    listeners.delete(callback);
    if (supabaseChannel && supabase) {
      supabase.removeChannel(supabaseChannel);
    }
  };
}

// Default Seed Data
const DEFAULT_TRACTORS: Tractor[] = [
  { id: 'trac-1', name: 'SWARAJ 50HP', active: true, current_fuel_litres: 28.50, created_at: new Date().toISOString() },
  { id: 'trac-2', name: 'SWARAJ 46HP', active: true, current_fuel_litres: 17.25, created_at: new Date().toISOString() },
  { id: 'trac-3', name: 'SWARAJ (OLD)', active: true, current_fuel_litres: 12.40, created_at: new Date().toISOString() },
];

const DEFAULT_SERVICES: ServiceMaster[] = [
  { id: 'srv-1', name: '5-Kalappai', category: 'machinery', unit: 'hour', rate: 1200, active: true },
  { id: 'srv-2', name: '9-Kalappai', category: 'machinery', unit: 'hour', rate: 1200, active: true },
  { id: 'srv-3', name: 'Paar Kalappai', category: 'machinery', unit: 'hour', rate: 1200, active: true },
  { id: 'srv-4', name: 'Rotavator', category: 'machinery', unit: 'hour', rate: 1300, active: true },
  { id: 'srv-5', name: 'Tanker', category: 'machinery', unit: 'load', rate: 1000, active: true },
  { id: 'srv-6', name: 'Solam – ஆள் உண்டு', category: 'crop', unit: 'bundle', rate: 100, worker_type: 'ஆள் உண்டு', active: true },
  { id: 'srv-7', name: 'Solam – ஆள் இல்லை', category: 'crop', unit: 'bundle', rate: 75, worker_type: 'ஆள் இல்லை', active: true },
  { id: 'srv-8', name: 'Manjal', category: 'crop', unit: 'load', rate: 1000, active: true },
];

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'K. Ramesh',
    phone: '9842154321',
    location: 'Kovilur',
    address: 'North Street, Near Mariamman Temple',
    notes: 'Regular customer for Rotavator and Kalappai work',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'cust-2',
    name: 'M. Suresh',
    phone: '9789123456',
    location: 'Alangudi',
    address: 'Main Road',
    notes: 'Paddy field work',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'cust-3',
    name: 'P. Murugan',
    phone: '9443219876',
    location: 'Pudukkottai',
    address: 'Bypass Road',
    notes: 'Needs 5-Kalappai and Tanker water supply',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'cust-4',
    name: 'S. Anbarasan',
    phone: '9865432109',
    location: 'Karambakkudi',
    address: 'East Field',
    notes: 'Solam harvest season customer',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'cust-5',
    name: 'V. Palanisamy',
    phone: '9944112233',
    location: 'Gandarvakottai',
    address: 'Thottam 4th cross',
    notes: 'Turmeric (Manjal) transport',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  business_name: 'DSR TRACTORS',
  diesel_price: 100.50,
  diesel_consumption_rate: 4.0,
};

// Initial sample transactions & payments for demo fidelity
const INITIAL_SERVICE_TRANSACTIONS: ServiceTransaction[] = [
  {
    id: 'tx-1',
    customer_id: 'cust-1',
    service_date: new Date().toISOString().split('T')[0],
    total_amount: 8600,
    notes: 'Paddy land preparation',
    created_at: new Date(Date.now() - 1200000).toISOString(),
    items: [
      {
        id: 'item-1',
        transaction_id: 'tx-1',
        service_id: 'srv-1',
        service_name: '5-Kalappai',
        quantity: 5,
        unit: 'hour',
        rate: 1200,
        amount: 6000,
      },
      {
        id: 'item-2',
        transaction_id: 'tx-1',
        service_id: 'srv-4',
        service_name: 'Rotavator',
        quantity: 2,
        unit: 'hour',
        rate: 1300,
        amount: 2600,
      },
    ],
  },
  {
    id: 'tx-2',
    customer_id: 'cust-2',
    service_date: new Date().toISOString().split('T')[0],
    total_amount: 4000,
    notes: 'Turmeric load transport',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    items: [
      {
        id: 'item-3',
        transaction_id: 'tx-2',
        service_id: 'srv-8',
        service_name: 'Manjal',
        quantity: 4,
        unit: 'load',
        rate: 1000,
        amount: 4000,
      },
    ],
  },
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    customer_id: 'cust-1',
    service_transaction_id: 'tx-1',
    amount: 5000,
    payment_method: 'UPI',
    payment_date: new Date().toISOString().split('T')[0],
    notes: 'GPay advance transfer',
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'pay-2',
    customer_id: 'cust-2',
    service_transaction_id: 'tx-2',
    amount: 4000,
    payment_method: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    notes: 'Cash received on field settlement',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

const INITIAL_DIESEL_TRANSACTIONS: DieselTransaction[] = [
  {
    id: 'dtx-1',
    tractor_id: 'trac-1',
    input_mode: 'amount',
    diesel_amount: 3000,
    diesel_price: 100.50,
    initial_fuel_litres: 38.50,
    total_working_hours: 2.50,
    consumption_rate: 4.0,
    diesel_consumed: 10.00,
    remaining_fuel: 28.50,
    transaction_date: new Date().toISOString().split('T')[0],
    notes: 'Kalappai and Rotavator work in Kovilur',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    timings: [
      { timing_hours: 1.25 },
      { timing_hours: 1.25 },
    ],
  },
];

// LocalStorage Helper
function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key);
    if (!raw) {
      setLocal(key, defaultVal);
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.error('LocalStorage error:', e);
  }
}

// ----------------------------------------------------
// SETTINGS
// ----------------------------------------------------
export async function getSettings(): Promise<AppSettings> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (!error && data && data.length > 0) {
        const settingsMap: Record<string, string> = {};
        data.forEach((row: any) => {
          settingsMap[row.key] = row.value;
        });
        return {
          business_name: settingsMap.business_name || DEFAULT_SETTINGS.business_name,
          diesel_price: parseFloat(settingsMap.diesel_price) || DEFAULT_SETTINGS.diesel_price,
          diesel_consumption_rate: parseFloat(settingsMap.diesel_consumption_rate) || DEFAULT_SETTINGS.diesel_consumption_rate,
        };
      }
    } catch (e) {
      console.warn('Supabase settings fetch error, falling back:', e);
    }
  }
  return getLocal<AppSettings>('settings', DEFAULT_SETTINGS);
}

export async function updateSetting(key: keyof AppSettings, value: string | number): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, [key]: value };
  setLocal('settings', updated);

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() });
    } catch (e) {
      console.error('Supabase setting update error:', e);
    }
  }

  notifyChange('settings', updated);
}

// ----------------------------------------------------
// CUSTOMERS
// ----------------------------------------------------
export async function getCustomers(): Promise<Customer[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setLocal('customers', data);
        return data as Customer[];
      }
    } catch (e) {
      console.warn('Supabase customer fetch error:', e);
    }
  }
  return getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const customers = await getCustomers();
  return customers.find((c) => c.id === id) || null;
}

export async function createCustomer(data: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
  const newCustomer: Customer = {
    id: 'cust-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: inserted, error } = await supabase
        .from('customers')
        .insert([{
          name: data.name,
          phone: data.phone,
          location: data.location,
          address: data.address || null,
          notes: data.notes || null,
        }])
        .select()
        .single();
      if (!error && inserted) {
        const existing = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);
        const updated = [inserted as Customer, ...existing.filter((c) => c.id !== (inserted as any).id)];
        setLocal('customers', updated);
        notifyChange('customers', inserted);
        return inserted as Customer;
      }
    } catch (e) {
      console.warn('Supabase insert error, falling back:', e);
    }
  }

  const existing = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);
  const updated = [newCustomer, ...existing];
  setLocal('customers', updated);
  notifyChange('customers', newCustomer);
  return newCustomer;
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer | null> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: updatedRow, error } = await supabase
        .from('customers')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (!error && updatedRow) {
        const existing = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);
        const updated = existing.map((c) => (c.id === id ? (updatedRow as Customer) : c));
        setLocal('customers', updated);
        notifyChange('customers', updatedRow);
        return updatedRow as Customer;
      }
    } catch (e) {
      console.warn('Supabase update customer error:', e);
    }
  }

  const existing = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);
  const index = existing.findIndex((c) => c.id === id);
  if (index === -1) return null;

  existing[index] = {
    ...existing[index],
    ...data,
    updated_at: new Date().toISOString(),
  };
  setLocal('customers', existing);
  notifyChange('customers', existing[index]);
  return existing[index];
}

export async function deleteCustomer(id: string): Promise<boolean> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (!error) {
        const existing = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);
        setLocal('customers', existing.filter((c) => c.id !== id));
        notifyChange('customers', { id });
        return true;
      }
    } catch (e) {
      console.warn('Supabase delete customer error:', e);
    }
  }

  const existing = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);
  const filtered = existing.filter((c) => c.id !== id);
  setLocal('customers', filtered);

  // Also clean up local transactions & payments for customer
  const txs = getLocal<ServiceTransaction[]>('service_transactions', INITIAL_SERVICE_TRANSACTIONS).filter((t) => t.customer_id !== id);
  setLocal('service_transactions', txs);

  const pays = getLocal<Payment[]>('payments', INITIAL_PAYMENTS).filter((p) => p.customer_id !== id);
  setLocal('payments', pays);

  notifyChange('customers', { id });
  return true;
}

// ----------------------------------------------------
// SERVICES MASTER
// ----------------------------------------------------
export async function getServices(): Promise<ServiceMaster[]> {
  let srvList: ServiceMaster[] = [];
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
      if (!error && data && data.length > 0) srvList = data as ServiceMaster[];
    } catch (e) {
      console.warn('Supabase services fetch error:', e);
    }
  }

  if (srvList.length === 0) {
    srvList = getLocal<ServiceMaster[]>('services', DEFAULT_SERVICES);
  }

  // Normalize Solam naming to match "Solam – ஆள் உண்டு" & "Solam – ஆள் இல்லை"
  const normalized = srvList.map((s) => {
    if (s.name.includes('Solam') && (s.name.includes('ஆள் உண்டு') || s.worker_type === 'ஆள் உண்டு')) {
      return { ...s, name: 'Solam – ஆள் உண்டு', rate: s.rate || 100, unit: 'bundle' as const, worker_type: 'ஆள் உண்டு' as const };
    }
    if (s.name.includes('Solam') && (s.name.includes('ஆள் இல்லை') || s.worker_type === 'ஆள் இல்லை')) {
      return { ...s, name: 'Solam – ஆள் இல்லை', rate: s.rate || 75, unit: 'bundle' as const, worker_type: 'ஆள் இல்லை' as const };
    }
    return s;
  });

  return normalized;
}

export async function updateServiceRate(id: string, rate: number): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('services').update({ rate, updated_at: new Date().toISOString() }).eq('id', id);
    } catch (e) {
      console.warn('Supabase update service rate error:', e);
    }
  }

  const services = getLocal<ServiceMaster[]>('services', DEFAULT_SERVICES);
  const updated = services.map((s) => (s.id === id ? { ...s, rate } : s));
  setLocal('services', updated);
  notifyChange('services', updated);
}

// ----------------------------------------------------
// SERVICE TRANSACTIONS
// ----------------------------------------------------
export async function getServiceTransactions(customerId?: string): Promise<ServiceTransaction[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('service_transactions')
        .select('*, customer:customers(*), items:service_transaction_items(*)')
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (!error && data) return data as ServiceTransaction[];
    } catch (e) {
      console.warn('Supabase fetch transactions error:', e);
    }
  }

  let txs = getLocal<ServiceTransaction[]>('service_transactions', INITIAL_SERVICE_TRANSACTIONS);
  const customers = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);

  if (customerId) {
    txs = txs.filter((t) => t.customer_id === customerId);
  }

  // Attach customer details to local txs
  return txs.map((t) => ({
    ...t,
    customer: customers.find((c) => c.id === t.customer_id),
  }));
}

export async function createServiceTransaction(
  txData: {
    customer_id: string;
    service_date: string;
    notes?: string;
    created_by?: string;
  },
  items: Omit<ServiceTransactionItem, 'id' | 'transaction_id' | 'created_at'>[]
): Promise<ServiceTransaction> {
  const totalAmount = calculateGrandTotal(items);
  const txId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  const formattedItems: ServiceTransactionItem[] = items.map((item, idx) => ({
    id: `item-${Date.now()}-${idx}`,
    transaction_id: txId,
    ...item,
    created_at: new Date().toISOString(),
  }));

  const newTx: ServiceTransaction = {
    id: txId,
    customer_id: txData.customer_id,
    service_date: txData.service_date || new Date().toISOString().split('T')[0],
    total_amount: totalAmount,
    notes: txData.notes || '',
    created_by: txData.created_by || 'Staff',
    created_at: new Date().toISOString(),
    items: formattedItems,
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: savedTx, error: txError } = await supabase
        .from('service_transactions')
        .insert([{
          customer_id: txData.customer_id,
          service_date: txData.service_date,
          total_amount: totalAmount,
          notes: txData.notes,
          created_by: txData.created_by || 'Staff',
        }])
        .select()
        .single();

      if (!txError && savedTx) {
        const dbItems = items.map((i) => ({
          transaction_id: savedTx.id,
          service_id: i.service_id,
          service_name: i.service_name,
          worker_type: i.worker_type || null,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          amount: i.amount,
        }));
        await supabase.from('service_transaction_items').insert(dbItems);
        notifyChange('service_transactions', savedTx);
        return { ...savedTx, items: dbItems };
      }
    } catch (e) {
      console.warn('Supabase create transaction error, falling back:', e);
    }
  }

  const existing = getLocal<ServiceTransaction[]>('service_transactions', INITIAL_SERVICE_TRANSACTIONS);
  const updated = [newTx, ...existing];
  setLocal('service_transactions', updated);

  notifyChange('service_transactions', newTx);
  return newTx;
}

// ----------------------------------------------------
// PAYMENTS
// ----------------------------------------------------
export async function getPayments(customerId?: string): Promise<Payment[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('payments')
        .select('*, customer:customers(*)')
        .order('payment_date', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (!error && data) return data as Payment[];
    } catch (e) {
      console.warn('Supabase get payments error:', e);
    }
  }

  let payments = getLocal<Payment[]>('payments', INITIAL_PAYMENTS);
  const customers = getLocal<Customer[]>('customers', DEFAULT_CUSTOMERS);

  if (customerId) {
    payments = payments.filter((p) => p.customer_id === customerId);
  }

  return payments.map((p) => ({
    ...p,
    customer: customers.find((c) => c.id === p.customer_id),
  }));
}

export async function createPayment(
  data: Omit<Payment, 'id' | 'created_at'>
): Promise<Payment> {
  const newPayment: Payment = {
    id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    ...data,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: savedPayment, error } = await supabase
        .from('payments')
        .insert([{
          customer_id: data.customer_id,
          service_transaction_id: data.service_transaction_id || null,
          amount: data.amount,
          payment_method: data.payment_method,
          payment_date: data.payment_date,
          notes: data.notes || null,
          created_by: data.created_by || 'Staff',
        }])
        .select()
        .single();
      if (!error && savedPayment) {
        notifyChange('payments', savedPayment);
        return savedPayment as Payment;
      }
    } catch (e) {
      console.warn('Supabase create payment error:', e);
    }
  }

  const existing = getLocal<Payment[]>('payments', INITIAL_PAYMENTS);
  const updated = [newPayment, ...existing];
  setLocal('payments', updated);

  notifyChange('payments', newPayment);
  return newPayment;
}

// ----------------------------------------------------
// CUSTOMER STATS & BALANCES
// ----------------------------------------------------
export async function getCustomerStats(customerId: string): Promise<CustomerBalanceInfo> {
  const transactions = await getServiceTransactions(customerId);
  const payments = await getPayments(customerId);

  const totalServices = roundToTwoDecimals(
    transactions.reduce((sum, tx) => sum + (Number(tx.total_amount) || 0), 0)
  );
  const totalPaid = roundToTwoDecimals(
    payments.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0)
  );

  return calculateCustomerBalance(totalServices, totalPaid);
}

// ----------------------------------------------------
// TRACTORS
// ----------------------------------------------------
export async function getTractors(): Promise<Tractor[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('tractors')
        .select('*')
        .eq('active', true)
        .order('name');
      if (!error && data && data.length > 0) return data as Tractor[];
    } catch (e) {
      console.warn('Supabase tractors error:', e);
    }
  }
  return getLocal<Tractor[]>('tractors', DEFAULT_TRACTORS);
}

export async function updateTractorFuel(tractorId: string, newFuelLitres: number): Promise<void> {
  const safeFuel = roundToTwoDecimals(Math.max(0, newFuelLitres));

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('tractors')
        .update({ current_fuel_litres: safeFuel, updated_at: new Date().toISOString() })
        .eq('id', tractorId);
    } catch (e) {
      console.warn('Supabase update tractor fuel error:', e);
    }
  }

  const tractors = getLocal<Tractor[]>('tractors', DEFAULT_TRACTORS);
  const updated = tractors.map((t) => (t.id === tractorId ? { ...t, current_fuel_litres: safeFuel } : t));
  setLocal('tractors', updated);

  notifyChange('tractors', { id: tractorId, current_fuel_litres: safeFuel });
}

// ----------------------------------------------------
// DIESEL TRANSACTIONS & TIMINGS
// ----------------------------------------------------
export async function getDieselTransactions(tractorId?: string): Promise<DieselTransaction[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('diesel_transactions')
        .select('*, tractor:tractors(*), timings:diesel_timings(*)')
        .order('created_at', { ascending: false });

      if (tractorId) {
        query = query.eq('tractor_id', tractorId);
      }

      const { data, error } = await query;
      if (!error && data) return data as DieselTransaction[];
    } catch (e) {
      console.warn('Supabase get diesel transactions error:', e);
    }
  }

  let txs = getLocal<DieselTransaction[]>('diesel_transactions', INITIAL_DIESEL_TRANSACTIONS);
  const tractors = getLocal<Tractor[]>('tractors', DEFAULT_TRACTORS);

  if (tractorId) {
    txs = txs.filter((t) => t.tractor_id === tractorId);
  }

  return txs.map((t) => ({
    ...t,
    tractor: tractors.find((trac) => trac.id === t.tractor_id),
  }));
}

export async function createDieselTransaction(
  data: Omit<DieselTransaction, 'id' | 'created_at' | 'timings'>,
  timings: { timing_hours: number }[]
): Promise<DieselTransaction> {
  const dtxId = 'dtx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  const formattedTimings: DieselTiming[] = timings.map((t, i) => ({
    id: `dtiming-${Date.now()}-${i}`,
    diesel_transaction_id: dtxId,
    timing_hours: t.timing_hours,
    created_at: new Date().toISOString(),
  }));

  const newDtx: DieselTransaction = {
    id: dtxId,
    ...data,
    created_at: new Date().toISOString(),
    timings: formattedTimings,
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: savedDtx, error } = await supabase
        .from('diesel_transactions')
        .insert([{
          tractor_id: data.tractor_id,
          input_mode: data.input_mode,
          diesel_amount: data.diesel_amount || null,
          diesel_price: data.diesel_price,
          initial_fuel_litres: data.initial_fuel_litres,
          total_working_hours: data.total_working_hours,
          consumption_rate: data.consumption_rate,
          diesel_consumed: data.diesel_consumed,
          remaining_fuel: data.remaining_fuel,
          transaction_date: data.transaction_date,
          notes: data.notes || null,
          created_by: data.created_by || 'Staff',
        }])
        .select()
        .single();

      if (!error && savedDtx) {
        if (timings.length > 0) {
          const timingRows = timings.map((t) => ({
            diesel_transaction_id: savedDtx.id,
            timing_hours: t.timing_hours,
          }));
          await supabase.from('diesel_timings').insert(timingRows);
        }

        // Update tractor fuel balance
        await updateTractorFuel(data.tractor_id, data.remaining_fuel);

        notifyChange('diesel_transactions', savedDtx);
        return savedDtx as DieselTransaction;
      }
    } catch (e) {
      console.warn('Supabase create diesel transaction error:', e);
    }
  }

  const existing = getLocal<DieselTransaction[]>('diesel_transactions', INITIAL_DIESEL_TRANSACTIONS);
  const updated = [newDtx, ...existing];
  setLocal('diesel_transactions', updated);

  // Update tractor fuel balance
  await updateTractorFuel(data.tractor_id, data.remaining_fuel);

  notifyChange('diesel_transactions', newDtx);
  return newDtx;
}

// ----------------------------------------------------
// DASHBOARD SUMMARY
// ----------------------------------------------------
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const todayStr = new Date().toISOString().split('T')[0];

  const [allCustomers, allServices, allPayments, allTractors, allDiesel] = await Promise.all([
    getCustomers(),
    getServiceTransactions(),
    getPayments(),
    getTractors(),
    getDieselTransactions(),
  ]);

  // Today's service metrics
  const todayServices = allServices.filter((s) => s.service_date === todayStr);
  const todayServicesCount = todayServices.length;
  const todayRevenue = roundToTwoDecimals(
    todayServices.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0)
  );

  // Today's payments
  const todayPaymentsRows = allPayments.filter((p) => p.payment_date === todayStr);
  const todayPayments = roundToTwoDecimals(
    todayPaymentsRows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );

  // Total Pending Amount across all customers
  const totalBilledAllTime = allServices.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  const totalPaidAllTime = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const pendingAmount = roundToTwoDecimals(Math.max(0, totalBilledAllTime - totalPaidAllTime));

  // Today's diesel consumption
  const todayDieselRows = allDiesel.filter((d) => d.transaction_date === todayStr);
  const todayDieselUsed = roundToTwoDecimals(
    todayDieselRows.reduce((sum, d) => sum + (Number(d.diesel_consumed) || 0), 0)
  );

  // Tractor Fuel summary
  const tractorFuel = allTractors.map((t) => ({
    id: t.id,
    name: t.name,
    remainingFuel: t.current_fuel_litres,
  }));

  // Build Recent Activity Feed (merged & sorted by timestamp)
  const activities: ActivityItem[] = [];

  allServices.slice(0, 5).forEach((s) => {
    activities.push({
      id: `act-s-${s.id}`,
      type: 'service',
      title: `${s.customer?.name || 'Customer'} Service`,
      subtitle: `${s.items?.map((i) => i.service_name).join(', ') || 'Service'}`,
      amountOrQuantity: `₹${s.total_amount.toLocaleString('en-IN')}`,
      date: s.service_date,
      timestamp: s.created_at,
    });
  });

  allPayments.slice(0, 5).forEach((p) => {
    activities.push({
      id: `act-p-${p.id}`,
      type: 'payment',
      title: `Payment Received (${p.payment_method})`,
      subtitle: `${p.customer?.name || 'Customer'}`,
      amountOrQuantity: `₹${p.amount.toLocaleString('en-IN')}`,
      date: p.payment_date,
      timestamp: p.created_at,
    });
  });

  allDiesel.slice(0, 5).forEach((d) => {
    activities.push({
      id: `act-d-${d.id}`,
      type: 'diesel',
      title: `${d.tractor?.name || 'Tractor'} Diesel Usage`,
      subtitle: `${d.total_working_hours} hr work • ${d.remaining_fuel} L remaining`,
      amountOrQuantity: `${d.diesel_consumed} L`,
      date: d.transaction_date,
      timestamp: d.created_at,
    });
  });

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    todayDate: todayStr,
    todayServicesCount,
    todayRevenue,
    todayPayments,
    pendingAmount,
    totalCustomers: allCustomers.length,
    todayDieselUsed,
    tractorFuel,
    recentActivities: activities.slice(0, 8),
  };
}

// Reset data to initial demo state
export function resetToDemoData(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'customers');
  localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'services');
  localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'service_transactions');
  localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'payments');
  localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'tractors');
  localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'diesel_transactions');
  localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'settings');

  setLocal('customers', DEFAULT_CUSTOMERS);
  setLocal('services', DEFAULT_SERVICES);
  setLocal('service_transactions', INITIAL_SERVICE_TRANSACTIONS);
  setLocal('payments', INITIAL_PAYMENTS);
  setLocal('tractors', DEFAULT_TRACTORS);
  setLocal('diesel_transactions', INITIAL_DIESEL_TRANSACTIONS);
  setLocal('settings', DEFAULT_SETTINGS);

  notifyChange('all');
}
