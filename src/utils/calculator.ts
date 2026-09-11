// ========================================================
// DSR TRACTORS — Business Calculation Utilities
// ========================================================

import type { CustomerBalanceInfo, PaymentStatus, SolamWorkerType } from '../types';

/**
 * Standard master service rates and calculation logic
 */
export const DEFAULT_SERVICE_RATES: Record<string, { rate: number; unit: string; isHourly?: boolean }> = {
  '5-Kalappai': { rate: 1200, unit: 'hour', isHourly: true },
  '9-Kalappai': { rate: 1200, unit: 'hour', isHourly: true },
  'Paar Kalappai': { rate: 1200, unit: 'hour', isHourly: true },
  'Rotavator': { rate: 1300, unit: 'hour', isHourly: true },
  'Tanker': { rate: 1000, unit: 'load' },
  'Solam': { rate: 100, unit: 'bundle' },
  'Solam – ஆள் உண்டு': { rate: 100, unit: 'bundle' },
  'Solam – ஆள் இல்லை': { rate: 75, unit: 'bundle' },
  'Solam (ஆள் உண்டு)': { rate: 100, unit: 'bundle' },
  'Solam (ஆள் இல்லை)': { rate: 75, unit: 'bundle' },
  'Manjal': { rate: 1000, unit: 'load' },
};

export const SOLAM_WORKER_RATES: Record<SolamWorkerType, number> = {
  'ஆள் உண்டு': 100,
  'ஆள் இல்லை': 75,
};

/**
 * Round safely to 2 decimal places to prevent floating point inaccuracies
 */
export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates the amount for a single service line item
 */
export function calculateServiceAmount(
  serviceName: string,
  quantity: number,
  workerType?: SolamWorkerType | null,
  customRate?: number
): { amount: number; rate: number; unit: string } {
  if (quantity < 0 || isNaN(quantity)) {
    return { amount: 0, rate: 0, unit: 'hour' };
  }

  // Solam has worker-type specific rates
  if (serviceName.toLowerCase().includes('solam')) {
    const isWithoutLabor = serviceName.includes('ஆள் இல்லை') || workerType === 'ஆள் இல்லை';
    const defaultRate = isWithoutLabor ? SOLAM_WORKER_RATES['ஆள் இல்லை'] : SOLAM_WORKER_RATES['ஆள் உண்டு'];
    const rate = (customRate !== undefined && customRate > 0) ? customRate : defaultRate;
    return {
      amount: roundToTwoDecimals(quantity * rate),
      rate,
      unit: 'bundle',
    };
  }

  // Find rate in default rates or fallback
  const master = DEFAULT_SERVICE_RATES[serviceName];
  const rate = customRate !== undefined ? customRate : (master?.rate ?? 0);
  const unit = master?.unit ?? (serviceName.toLowerCase().includes('load') ? 'load' : 'hour');

  return {
    amount: roundToTwoDecimals(quantity * rate),
    rate,
    unit,
  };
}

/**
 * Calculates grand total for multiple service items
 */
export function calculateGrandTotal(items: { amount: number }[]): number {
  if (!items || items.length === 0) return 0;
  const total = items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  return roundToTwoDecimals(total);
}

/**
 * Calculates customer balance and payment status
 * 
 * Rules:
 * Balance = Total Service Amount - Total Payments
 * Status:
 * If Total Service Amount <= 0 and Total Payments <= 0 -> 'Fully Settled'
 * If Paid <= 0 and Total Service Amount > 0 -> 'Pending'
 * If Paid > 0 and Paid < Total Service Amount -> 'Partially Paid'
 * If Paid >= Total Service Amount -> 'Fully Settled'
 */
export function calculateCustomerBalance(
  totalServicesAmount: number,
  totalPaymentsAmount: number
): CustomerBalanceInfo {
  const safeTotal = roundToTwoDecimals(Math.max(0, totalServicesAmount || 0));
  const safePaid = roundToTwoDecimals(Math.max(0, totalPaymentsAmount || 0));
  const balance = roundToTwoDecimals(Math.max(0, safeTotal - safePaid));

  let status: PaymentStatus;
  if (safeTotal === 0) {
    status = 'Fully Settled';
  } else if (safePaid <= 0) {
    status = 'Pending';
  } else if (safePaid < safeTotal) {
    status = 'Partially Paid';
  } else {
    status = 'Fully Settled';
  }

  return {
    totalAmount: safeTotal,
    balance,
    status,
    totalServices: safeTotal,
    totalPaid: safePaid,
  };
}

/**
 * Calculates litres from rupee amount and diesel price per litre
 * Litres = Amount / Diesel Price
 */
export function calculateDieselLitresFromAmount(
  amount: number,
  dieselPrice: number
): number {
  if (!amount || amount <= 0 || !dieselPrice || dieselPrice <= 0) {
    return 0;
  }
  return roundToTwoDecimals(amount / dieselPrice);
}

/**
 * Calculates total working hours from multiple timing entries
 */
export function calculateTotalWorkingHours(timings: number[]): number {
  if (!timings || timings.length === 0) return 0;
  const total = timings.reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  return roundToTwoDecimals(total);
}

/**
 * Calculates diesel consumed based on 4 litres per working hour
 */
export function calculateDieselConsumed(
  totalHours: number,
  consumptionRate = 4.0
): number {
  if (!totalHours || totalHours <= 0) return 0;
  return roundToTwoDecimals(totalHours * consumptionRate);
}

/**
 * Calculates remaining fuel in tank and checks for insufficient diesel condition
 */
export function calculateRemainingFuel(
  startingFuelLitres: number,
  dieselConsumedLitres: number
): { remainingFuel: number; isInsufficient: boolean } {
  const starting = roundToTwoDecimals(Math.max(0, startingFuelLitres || 0));
  const consumed = roundToTwoDecimals(Math.max(0, dieselConsumedLitres || 0));
  const remaining = roundToTwoDecimals(starting - consumed);
  const isInsufficient = consumed > starting;

  return {
    remainingFuel: isInsufficient ? 0 : remaining,
    isInsufficient,
  };
}
