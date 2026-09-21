import { formatCurrency } from './calculations';

export interface WhatsAppBillDetails {
  customerName: string;
  customerPhone?: string;
  date?: string;
  items: Array<{
    serviceName: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    workerType?: string | null;
  }>;
  totalAmount: number;
  paidAmount?: number;
  balanceAmount?: number;
  notes?: string;
}

export interface WhatsAppPaymentDetails {
  customerName: string;
  customerPhone?: string;
  date?: string;
  amount: number;
  paymentMethod: string;
  remainingBalance?: number;
  notes?: string;
}

/**
 * Format a machinery bill into a clean Tamil & English receipt message
 */
export function formatBillMessage(details: WhatsAppBillDetails): string {
  const dateStr = details.date || new Date().toLocaleDateString('en-IN');
  let text = `🚜 *DSR TRACTORS - BILL RECEIPT*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👤 *வாடிக்கையாளர் (Customer):* ${details.customerName}\n`;
  text += `📅 *தேதி (Date):* ${dateStr}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*சேவை விவரங்கள் (Services):*\n`;

  details.items.forEach((item, index) => {
    const workerLabel = item.workerType ? ` (${item.workerType})` : '';
    text += `${index + 1}. *${item.serviceName}*${workerLabel}\n`;
    text += `   ↳ ${item.quantity} ${item.unit} × ₹${item.rate} = *${formatCurrency(item.amount)}*\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💰 *மொத்த தொகை (Total):* ${formatCurrency(details.totalAmount)}\n`;

  if (details.paidAmount !== undefined && details.paidAmount > 0) {
    text += `💵 *செலுத்தியது (Paid):* ${formatCurrency(details.paidAmount)}\n`;
  }

  if (details.balanceAmount !== undefined) {
    text += `⚖️ *மீதி பாக்கி (Balance):* ${formatCurrency(details.balanceAmount)}\n`;
  }

  if (details.notes && details.notes.trim()) {
    text += `📝 *குறிப்பு:* ${details.notes.trim()}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `நன்றி! மேலான ஆதரவுக்கு வாழ்த்துகள்.\n`;
  text += `🚜 *DSR Tractors, Tamil Nadu*`;

  return text;
}

/**
 * Format a payment settlement receipt
 */
export function formatPaymentMessage(details: WhatsAppPaymentDetails): string {
  const dateStr = details.date || new Date().toLocaleDateString('en-IN');
  let text = `🚜 *DSR TRACTORS - PAYMENT RECEIPT*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👤 *வாடிக்கையாளர் (Customer):* ${details.customerName}\n`;
  text += `📅 *தேதி (Date):* ${dateStr}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💵 *பெறப்பட்ட தொகை (Amount Received):* *${formatCurrency(details.amount)}*\n`;
  text += `💳 *முறை (Mode):* ${details.paymentMethod}\n`;

  if (details.remainingBalance !== undefined) {
    text += `⚖️ *மீதி பாக்கி (Current Balance):* ${formatCurrency(details.remainingBalance)}\n`;
  }

  if (details.notes && details.notes.trim()) {
    text += `📝 *குறிப்பு:* ${details.notes.trim()}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `பணம் வெற்றிகரமாக பதிவு செய்யப்பட்டது. நன்றி!\n`;
  text += `🚜 *DSR Tractors*`;

  return text;
}

/**
 * Open WhatsApp with prefilled message and optional recipient phone
 */
export async function sendViaWhatsApp(text: string, phone?: string): Promise<boolean> {
  try {
    const { Linking, Alert } = require('react-native');

    let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const encodedText = encodeURIComponent(text);
    const nativeUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
      : `whatsapp://send?text=${encodedText}`;

    const webUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    const canOpen = await Linking.canOpenURL(nativeUrl);
    if (canOpen) {
      await Linking.openURL(nativeUrl);
      return true;
    } else {
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (err: any) {
    try {
      const { Alert } = require('react-native');
      Alert.alert(
        'WhatsApp Error',
        'Could not open WhatsApp on this device. Please make sure WhatsApp is installed.'
      );
    } catch {
      console.warn('Could not launch WhatsApp:', err);
    }
    return false;
  }
}
