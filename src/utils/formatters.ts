// ========================================================
// DSR TRACTORS — Formatting Utilities
// ========================================================

/**
 * Format currency with Indian rupee symbol and locale formatting (e.g. ₹12,500)
 */
export function formatCurrency(amount: number, forceDecimals = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }

  const hasDecimals = amount % 1 !== 0 || forceDecimals;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return `₹${formatted}`;
}

/**
 * Format fuel litres with 2 decimals
 */
export function formatLitres(litres: number): string {
  if (isNaN(litres) || litres === null || litres === undefined) {
    return '0.00 L';
  }
  return `${litres.toFixed(2)} L`;
}

/**
 * Format working hours
 */
export function formatHours(hours: number): string {
  if (isNaN(hours) || hours === null || hours === undefined) {
    return '0.00 hr';
  }
  return `${hours.toFixed(2)} hr`;
}

/**
 * Format friendly human date e.g. "10 Sep 2026"
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Format friendly date and time
 */
export function formatDateTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}
