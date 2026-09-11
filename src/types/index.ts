// ========================================================
// DSR TRACTORS — Core Type Definitions
// ========================================================

export type PaymentStatus = 'Pending' | 'Partially Paid' | 'Fully Settled';

export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';

export type ServiceUnit = 'hour' | 'load' | 'bundle';

export type SolamWorkerType = 'ஆள் உண்டு' | 'ஆள் இல்லை';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  location: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface CustomerBalanceInfo {
  totalAmount: number;
  totalPaid: number;
  balance: number;
  status: PaymentStatus;
  totalServices?: number;
}

export interface ServiceMaster {
  id: string;
  name: string;
  category: 'machinery' | 'crop';
  unit: ServiceUnit;
  rate: number;
  worker_type?: SolamWorkerType;
  active: boolean;
}

export interface ServiceTransactionItem {
  id?: string;
  transaction_id?: string;
  service_id: string;
  service_name: string;
  worker_type?: SolamWorkerType | null;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  created_at?: string;
}

export interface ServiceTransaction {
  id: string;
  customer_id: string;
  service_date: string;
  total_amount: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  items?: ServiceTransactionItem[];
  customer?: Customer;
}

export interface Payment {
  id: string;
  customer_id: string;
  service_transaction_id?: string | null;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  customer?: Customer;
}

export interface Tractor {
  id: string;
  name: string;
  active: boolean;
  current_fuel_litres: number;
  created_at: string;
  updated_at?: string;
}

export interface DieselTiming {
  id?: string;
  diesel_transaction_id?: string;
  timing_hours: number;
  created_at?: string;
}

export interface DieselTransaction {
  id: string;
  tractor_id: string;
  input_mode: 'amount' | 'litres';
  diesel_amount?: number;
  diesel_price: number;
  initial_fuel_litres: number;
  total_working_hours: number;
  consumption_rate: number;
  diesel_consumed: number;
  remaining_fuel: number;
  transaction_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  timings?: DieselTiming[];
  tractor?: Tractor;
}

export interface AppSettings {
  business_name: string;
  diesel_price: number;
  diesel_consumption_rate: number;
}

export interface UserProfile {
  id: string;
  user_id?: string;
  name: string;
  phone?: string;
  role: string;
  created_at?: string;
}

export interface ActivityItem {
  id: string;
  type: 'service' | 'payment' | 'diesel';
  title: string;
  subtitle: string;
  amountOrQuantity: string;
  date: string;
  timestamp: string;
}

export interface DashboardSummary {
  todayDate: string;
  todayServicesCount: number;
  todayRevenue: number;
  todayPayments: number;
  pendingAmount: number;
  totalCustomers: number;
  todayDieselUsed: number;
  tractorFuel: {
    id: string;
    name: string;
    remainingFuel: number;
  }[];
  recentActivities: ActivityItem[];
}
