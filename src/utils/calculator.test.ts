import { describe, it, expect } from 'vitest';
import {
  calculateServiceAmount,
  calculateGrandTotal,
  calculateDieselLitresFromAmount,
  calculateTotalWorkingHours,
  calculateDieselConsumed,
  calculateRemainingFuel,
  calculateCustomerBalance,
} from './calculator';

describe('DSR TRACTORS — Core Calculations Test Suite', () => {
  // TEST 1: 5-Kalappai 5 hr => ₹6,000
  it('TEST 1: 5-Kalappai for 5 hours should equal ₹6,000', () => {
    const result = calculateServiceAmount('5-Kalappai', 5);
    expect(result.rate).toBe(1200);
    expect(result.amount).toBe(6000);
    expect(result.unit).toBe('hour');
  });

  // TEST 2: Rotavator 2 hr => ₹2,600
  it('TEST 2: Rotavator for 2 hours should equal ₹2,600', () => {
    const result = calculateServiceAmount('Rotavator', 2);
    expect(result.rate).toBe(1300);
    expect(result.amount).toBe(2600);
    expect(result.unit).toBe('hour');
  });

  // TEST 3: Tanker 3 loads => ₹3,000
  it('TEST 3: Tanker for 3 loads should equal ₹3,000', () => {
    const result = calculateServiceAmount('Tanker', 3);
    expect(result.rate).toBe(1000);
    expect(result.amount).toBe(3000);
    expect(result.unit).toBe('load');
  });

  // TEST 4: Solam ஆள் உண்டு 10 bundles => ₹1,000
  it('TEST 4: Solam with labor (ஆள் உண்டு) 10 bundles should equal ₹1,000', () => {
    const result = calculateServiceAmount('Solam', 10, 'ஆள் உண்டு');
    expect(result.rate).toBe(100);
    expect(result.amount).toBe(1000);
    expect(result.unit).toBe('bundle');
  });

  // TEST 5: Solam ஆள் இல்லை 10 bundles => ₹750
  it('TEST 5: Solam without labor (ஆள் இல்லை) 10 bundles should equal ₹750', () => {
    const result = calculateServiceAmount('Solam', 10, 'ஆள் இல்லை');
    expect(result.rate).toBe(75);
    expect(result.amount).toBe(750);
    expect(result.unit).toBe('bundle');
  });

  // TEST 6: Manjal 4 loads => ₹4,000
  it('TEST 6: Manjal for 4 loads should equal ₹4,000', () => {
    const result = calculateServiceAmount('Manjal', 4);
    expect(result.rate).toBe(1000);
    expect(result.amount).toBe(4000);
    expect(result.unit).toBe('load');
  });

  // Grand Total calculation test
  it('Calculates grand total across multiple services accurately', () => {
    const item1 = calculateServiceAmount('5-Kalappai', 5); // 6000
    const item2 = calculateServiceAmount('Rotavator', 2); // 2600
    const grandTotal = calculateGrandTotal([item1, item2]);
    expect(grandTotal).toBe(8600);
  });

  // TEST 7: ₹3,000 diesel @ ₹100.50/L => ≈29.85 L
  it('TEST 7: ₹3,000 diesel at ₹100.50/L should calculate to approx 29.85 L', () => {
    const litres = calculateDieselLitresFromAmount(3000, 100.50);
    expect(litres).toBe(29.85);
  });

  // TEST 8: 1.25 + 1.25 hours => 2.50 hr, 2.50 × 4 = 10 L
  it('TEST 8: 1.25 + 1.25 hours total 2.50 hr and consume 10 L', () => {
    const totalHours = calculateTotalWorkingHours([1.25, 1.25]);
    expect(totalHours).toBe(2.50);

    const consumed = calculateDieselConsumed(totalHours, 4.0);
    expect(consumed).toBe(10.00);

    // If starting fuel was 29.85 L, remaining should be 19.85 L
    const remaining = calculateRemainingFuel(29.85, consumed);
    expect(remaining.remainingFuel).toBe(19.85);
    expect(remaining.isInsufficient).toBe(false);
  });

  // TEST 9: 30.11 L starting fuel, 10 L consumed => 20.11 L remaining
  it('TEST 9: 30.11 L starting fuel with 10 L consumed leaves 20.11 L remaining', () => {
    const result = calculateRemainingFuel(30.11, 10.00);
    expect(result.remainingFuel).toBe(20.11);
    expect(result.isInsufficient).toBe(false);
  });

  // Insufficient fuel test
  it('Detects insufficient diesel condition when consumption exceeds tank fuel', () => {
    const result = calculateRemainingFuel(5.00, 10.00);
    expect(result.isInsufficient).toBe(true);
  });

  // TEST 10: Customer total ₹4,600, Paid ₹2,000 => Balance ₹2,600, Partially Paid
  it('TEST 10: Customer total ₹4,600 and paid ₹2,000 should have balance ₹2,600 and Partially Paid status', () => {
    const balanceInfo = calculateCustomerBalance(4600, 2000);
    expect(balanceInfo.totalServices).toBe(4600);
    expect(balanceInfo.totalPaid).toBe(2000);
    expect(balanceInfo.balance).toBe(2600);
    expect(balanceInfo.status).toBe('Partially Paid');
  });

  // TEST 11: Customer total ₹4,600, Paid ₹4,600 => Balance ₹0, Fully Settled
  it('TEST 11: Customer total ₹4,600 and paid ₹4,600 should have balance ₹0 and Fully Settled status', () => {
    const balanceInfo = calculateCustomerBalance(4600, 4600);
    expect(balanceInfo.totalServices).toBe(4600);
    expect(balanceInfo.totalPaid).toBe(4600);
    expect(balanceInfo.balance).toBe(0);
    expect(balanceInfo.status).toBe('Fully Settled');
  });

  // Customer pending test (Paid = 0)
  it('Customer with ₹4,600 and ₹0 paid should have Pending status', () => {
    const balanceInfo = calculateCustomerBalance(4600, 0);
    expect(balanceInfo.balance).toBe(4600);
    expect(balanceInfo.status).toBe('Pending');
  });
});
