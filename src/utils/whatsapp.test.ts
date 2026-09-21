import { formatBillMessage, formatPaymentMessage } from './whatsapp';

function runTests() {
  console.log('--- TESTING WHATSAPP RECEIPT GENERATION ---');

  const sampleBill = {
    customerName: 'முருகேசன் (Murugesan)',
    customerPhone: '9876543210',
    date: '12/09/2026',
    items: [
      {
        serviceName: '5-Kalappai',
        quantity: 2.5,
        unit: 'hour',
        rate: 1200,
        amount: 3000,
      },
      {
        serviceName: 'Solam',
        quantity: 50,
        unit: 'bundle',
        rate: 100,
        amount: 5000,
        workerType: 'ஆள் உண்டு',
      },
    ],
    totalAmount: 8000,
    paidAmount: 5000,
    balanceAmount: 3000,
    notes: 'Near river field',
  };

  const billMessage = formatBillMessage(sampleBill);
  if (!billMessage.includes('DSR TRACTORS - BILL RECEIPT')) throw new Error('Header missing');
  if (!billMessage.includes('Murugesan')) throw new Error('Customer missing');
  if (!billMessage.includes('5-Kalappai')) throw new Error('Item 1 missing');
  if (!billMessage.includes('*Solam* (ஆள் உண்டு)')) throw new Error('Item 2 missing');
  if (!billMessage.includes('₹8,000')) throw new Error('Total missing');
  if (!billMessage.includes('₹3,000')) throw new Error('Balance missing');
  console.log('✓ formatBillMessage generated valid bilingual receipt');

  const samplePayment = {
    customerName: 'கந்தசாமி (Kanthasamy)',
    amount: 2500,
    paymentMethod: 'Cash',
    remainingBalance: 1500,
  };

  const paymentMessage = formatPaymentMessage(samplePayment);
  if (!paymentMessage.includes('DSR TRACTORS - PAYMENT RECEIPT')) throw new Error('Payment header missing');
  if (!paymentMessage.includes('₹2,500')) throw new Error('Payment amount missing');
  if (!paymentMessage.includes('₹1,500')) throw new Error('Remaining balance missing');
  console.log('✓ formatPaymentMessage generated valid payment receipt');

  console.log('ALL WHATSAPP FORMAT TESTS PASSED!');
}

runTests();
