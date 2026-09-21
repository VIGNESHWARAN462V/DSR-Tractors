import {
  calculateServiceAmount,
  calculateGrandTotal,
  calculateCustomerBalance,
  getPaymentStatus,
  calculateDieselLitresFromAmount,
  calculateTotalWorkingHours,
  calculateDieselConsumed,
  calculateRemainingFuel,
} from './calculations';

function runTests() {
  console.log('--- RUNNING DSR TRACTORS CALCULATION TESTS ---');

  // Test 1: 5-Kalappai 5 hr
  const t1 = calculateServiceAmount('5-Kalappai', 5);
  console.assert(t1.totalAmount === 6000, `Test 1 Failed: Expected 6000, got ${t1.totalAmount}`);
  console.log('✓ 5-Kalappai (5 hr * 1200):', t1.totalAmount);

  // Test 2: Rotavator 2 hr
  const t2 = calculateServiceAmount('Rotavator', 2);
  console.assert(t2.totalAmount === 2600, `Test 2 Failed: Expected 2600, got ${t2.totalAmount}`);
  console.log('✓ Rotavator (2 hr * 1300):', t2.totalAmount);

  // Test 3: Tanker 3 loads
  const t3 = calculateServiceAmount('Tanker', 3);
  console.assert(t3.totalAmount === 3000, `Test 3 Failed: Expected 3000, got ${t3.totalAmount}`);
  console.log('✓ Tanker (3 loads * 1000):', t3.totalAmount);

  // Test 4: Solam with worker (ஆள் உண்டு) 10 bundles
  const t4 = calculateServiceAmount('Solam', 10, 'with_worker');
  console.assert(t4.totalAmount === 1000, `Test 4 Failed: Expected 1000, got ${t4.totalAmount}`);
  console.log('✓ Solam with worker (10 * 100):', t4.totalAmount);

  // Test 5: Solam without worker (ஆள் இல்லை) 10 bundles
  const t5 = calculateServiceAmount('Solam', 10, 'without_worker');
  console.assert(t5.totalAmount === 750, `Test 5 Failed: Expected 750, got ${t5.totalAmount}`);
  console.log('✓ Solam without worker (10 * 75):', t5.totalAmount);

  // Test 6: Manjal 4 loads
  const t6 = calculateServiceAmount('Manjal', 4);
  console.assert(t6.totalAmount === 4000, `Test 6 Failed: Expected 4000, got ${t6.totalAmount}`);
  console.log('✓ Manjal (4 loads * 1000):', t6.totalAmount);

  // Grand Total Example from prompt: 6000 + 2600 + 2000 = 10600
  const grandTotal = calculateGrandTotal([
    { total_amount: 6000 },
    { total_amount: 2600 },
    { total_amount: 2000 },
  ]);
  console.assert(grandTotal === 10600, `Grand total failed: Expected 10600, got ${grandTotal}`);
  console.log('✓ Grand Total (6000 + 2600 + 2000):', grandTotal);

  // Test 7: Customer Partial Payment
  const bal1 = calculateCustomerBalance(4600, 2000);
  const status1 = getPaymentStatus(4600, 2000);
  console.assert(bal1 === 2600, `Customer Bal 1 failed: Expected 2600, got ${bal1}`);
  console.assert(status1 === 'Partially Paid', `Customer Status 1 failed: got ${status1}`);
  console.log('✓ Customer Partial (4600 - 2000): Balance =', bal1, 'Status =', status1);

  // Test 7b: Full Settlement
  const bal2 = calculateCustomerBalance(4600, 4600);
  const status2 = getPaymentStatus(4600, 4600);
  console.assert(bal2 === 0, `Customer Bal 2 failed: Expected 0, got ${bal2}`);
  console.assert(status2 === 'Fully Settled', `Customer Status 2 failed: got ${status2}`);
  console.log('✓ Customer Full (4600 - 4600): Balance =', bal2, 'Status =', status2);

  // Test 8: Diesel
  const totalHrs = calculateTotalWorkingHours([1.25, 1.25]);
  console.assert(totalHrs === 2.50, `Working hours failed: Expected 2.50, got ${totalHrs}`);
  const consumed = calculateDieselConsumed(totalHrs);
  console.assert(consumed === 10.00, `Consumed failed: Expected 10, got ${consumed}`);
  const fuel = calculateRemainingFuel(30.11, consumed);
  console.assert(fuel.remaining === 20.11, `Remaining fuel failed: Expected 20.11, got ${fuel.remaining}`);
  console.assert(!fuel.isInsufficient, `Should not be insufficient`);
  console.log('✓ Diesel (30.11L starting, 2.50 hrs, 10L consumed): Remaining =', fuel.remaining);

  // Test 9: Amount mode (3000 @ 100.50)
  const litresFromAmt = calculateDieselLitresFromAmount(3000, 100.50);
  console.assert(litresFromAmt === 29.85, `Amount mode failed: Expected 29.85, got ${litresFromAmt}`);
  console.log('✓ Diesel Amount Mode (3000 / 100.50): Litres =', litresFromAmt);

  console.log('ALL SECTION 29 CALCULATION TESTS PASSED!');
}

runTests();
