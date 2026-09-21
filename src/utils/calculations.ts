import { PaymentStatus, ServiceTransactionItem, WorkerType } from '@/types/database';

export const CONSUMPTION_RATE_LITRES_PER_HOUR = 4.0;
export const DIESEL_CONSUMPTION_RATE_PER_HOUR = CONSUMPTION_RATE_LITRES_PER_HOUR;
export const DEFAULT_DIESEL_PRICE = 100.50;

export function formatLitres(litres: number): string {
  const l = Number(litres) || 0;
  return `${l.toFixed(2)} L`;
}

/**
 * Rates master reference (can be overridden by database values)
 */
export const DEFAULT_SERVICE_RATES: Record<
  string,
  { rate: number; unit: 'hour' | 'load' | 'bundle'; workerRates?: { with_worker: number; without_worker: number } }
> = {
  '5-Kalappai': { rate: 1200, unit: 'hour' },
  '9-Kalappai': { rate: 1200, unit: 'hour' },
  'Paar Kalappai': { rate: 1200, unit: 'hour' },
  'Rotavator': { rate: 1300, unit: 'hour' },
  'Tanker': { rate: 1000, unit: 'load' },
  'Solam': {
    rate: 0,
    unit: 'bundle',
    workerRates: {
      with_worker: 100,
      without_worker: 75,
    },
  },
  'Manjal': { rate: 1000, unit: 'load' },
};

/**
 * Calculate amount for a single service item.
 * Pure function:
 * - Hourly: hours * rate (e.g. 5-Kalappai: 5 * 1200 = 6000, Rotavator: 2 * 1300 = 2600)
 * - Tanker: loads * 1000
 * - Solam: with_worker (bundles * 100) or without_worker (bundles * 75)
 * - Manjal: loads * 1000
 */
export function calculateServiceAmount(
  serviceName: string,
  quantity: number,
  workerType?: WorkerType | null,
  customRate?: number | null
): { unitRate: number; totalAmount: number } {
  const qty = Number(quantity) || 0;
  if (qty < 0) return { unitRate: 0, totalAmount: 0 };

  const master = DEFAULT_SERVICE_RATES[serviceName];

  if (serviceName.toLowerCase().includes('solam')) {
    const isWithWorker = workerType === 'with_worker';
    const unitRate = customRate ?? (isWithWorker ? 100 : 75);
    const totalAmount = Math.round(qty * unitRate * 100) / 100;
    return { unitRate, totalAmount };
  }

  const unitRate = customRate ?? (master ? master.rate : 0);
  const totalAmount = Math.round(qty * unitRate * 100) / 100;
  return { unitRate, totalAmount };
}

/**
 * Calculate grand total from an array of service transaction items
 */
export function calculateGrandTotal(
  items: Array<{ total_amount: number } | ServiceTransactionItem>
): number {
  if (!items || items.length === 0) return 0;
  const total = items.reduce((acc, item) => acc + (Number(item.total_amount) || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Calculate balance for a customer: Total Charges - Total Payments
 */
export function calculateCustomerBalance(totalCharges: number, totalPayments: number): number {
  const charges = Number(totalCharges) || 0;
  const payments = Number(totalPayments) || 0;
  const balance = charges - payments;
  return Math.round(balance * 100) / 100;
}

/**
 * Determine payment status:
 * - Total payments = 0 (or no charges) => 'Pending'
 * - Total payments >= total charges => 'Fully Settled'
 * - In between => 'Partially Paid'
 */
export function getPaymentStatus(totalCharges: number, totalPayments: number): PaymentStatus {
  const charges = Math.round((Number(totalCharges) || 0) * 100) / 100;
  const payments = Math.round((Number(totalPayments) || 0) * 100) / 100;

  if (charges <= 0) {
    return payments > 0 ? 'Fully Settled' : 'Pending';
  }

  if (payments <= 0) {
    return 'Pending';
  }

  if (payments >= charges) {
    return 'Fully Settled';
  }

  return 'Partially Paid';
}

/**
 * Diesel: calculate litres from amount: Litres = Amount / Diesel Price
 * e.g. ₹3000 / 100.50 ≈ 29.85 L
 */
export function calculateDieselLitresFromAmount(amount: number, dieselPrice: number): number {
  const amt = Number(amount) || 0;
  const price = Number(dieselPrice) || DEFAULT_DIESEL_PRICE;
  if (amt <= 0 || price <= 0) return 0;
  const litres = amt / price;
  return Math.round(litres * 100) / 100;
}
export const calculateLitresFromAmount = calculateDieselLitresFromAmount;

/**
 * Diesel: calculate total working hours from multiple timings entries
 * e.g. [1.25, 1.25] => 2.50 hr
 */
export function calculateTotalWorkingHours(timings: Array<number | { hours: number }>): number {
  if (!timings || timings.length === 0) return 0;
  const total = timings.reduce<number>((acc: number, item) => {
    const hrs = typeof item === 'number' ? item : item.hours;
    return acc + (Number(hrs) || 0);
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Diesel: 1 working hour = 4 litres
 * Diesel Consumed = Total Working Hours * 4
 * e.g. 2.50 hr * 4 = 10.00 L
 */
export function calculateDieselConsumed(
  totalHours: number,
  ratePerHour: number = CONSUMPTION_RATE_LITRES_PER_HOUR
): number {
  const hrs = Number(totalHours) || 0;
  if (hrs <= 0) return 0;
  const consumed = hrs * ratePerHour;
  return Math.round(consumed * 100) / 100;
}

/**
 * Diesel: Remaining Fuel = Starting Fuel - Diesel Consumed
 * e.g. 30.11 L - 10.00 L = 20.11 L
 */
export function calculateRemainingFuel(
  startingLitres: number,
  dieselConsumed: number
): { remaining: number; isInsufficient: boolean } {
  const start = Number(startingLitres) || 0;
  const consumed = Number(dieselConsumed) || 0;
  const remaining = Math.round((start - consumed) * 100) / 100;
  const isInsufficient = remaining < 0;
  return {
    remaining: isInsufficient ? 0 : remaining,
    isInsufficient,
  };
}

/**
 * Format currency in Indian format (₹)
 */
export function formatCurrency(amount: number): string {
  const amt = Number(amount) || 0;
  return `₹${amt.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
