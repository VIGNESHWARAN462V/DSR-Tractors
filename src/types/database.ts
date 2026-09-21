export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ServiceUnit = 'hour' | 'load' | 'bundle';
export type WorkerType = 'with_worker' | 'without_worker' | 'ஆள் உண்டு' | 'ஆள் இல்லை';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';
export type PaymentStatus = 'Pending' | 'Partially Paid' | 'Fully Settled';
export type DieselInputMode = 'amount' | 'litres';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id?: string;
  name: string;
  phone: string;
  location: string;
  village?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceMaster {
  id: string;
  user_id?: string | null;
  name: string;
  category?: string;
  unit: ServiceUnit;
  rate: number;
  worker_type?: string | null;
  has_worker_types?: boolean;
  worker_rate?: number | null;
  no_worker_rate?: number | null;
  active?: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceTransactionItem {
  id?: string;
  transaction_id?: string;
  service_id?: string | null;
  service_name: string;
  quantity: number;
  unit: ServiceUnit | string;
  worker_type?: string | null;
  rate: number;
  amount: number;
  unit_rate?: number;
  total_amount?: number;
  created_at?: string;
}

export interface ServiceTransaction {
  id: string;
  customer_id: string;
  service_date: string;
  transaction_date?: string;
  total_amount: number;
  notes?: string;
  created_by?: string | null;
  user_id?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: ServiceTransactionItem[];
}

export interface Payment {
  id: string;
  customer_id: string;
  service_transaction_id?: string | null;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes?: string;
  created_by?: string | null;
  user_id?: string;
  created_at: string;
  customer?: Customer;
}

export interface Tractor {
  id: string;
  user_id?: string | null;
  name: string;
  current_fuel_litres: number;
  active: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DieselTiming {
  id?: string;
  diesel_transaction_id?: string;
  timing_hours: number;
  hours?: number;
  timing_label?: string;
  created_at?: string;
}

export interface DieselTransaction {
  id: string;
  user_id?: string;
  created_by?: string | null;
  tractor_id: string;
  input_mode: DieselInputMode;
  diesel_amount?: number | null;
  amount_spent?: number | null;
  diesel_price: number;
  initial_fuel_litres: number;
  starting_litres?: number;
  total_working_hours: number;
  consumption_rate: number;
  diesel_consumed: number;
  remaining_fuel: number;
  transaction_date: string;
  notes?: string;
  created_at: string;
  tractor?: Tractor;
  timings?: DieselTiming[];
}

export interface CustomerFinancialSummary {
  customer_id: string;
  customer_name: string;
  total_charges: number;
  total_payments: number;
  balance: number;
  status: PaymentStatus;
}
