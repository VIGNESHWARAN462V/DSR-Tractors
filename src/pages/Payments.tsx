// ========================================================
// Payments Management Module
// ========================================================

import React, { useState, useEffect } from 'react';
import type { Customer, Payment, PaymentMethod } from '../types';
import {
  getPayments,
  getCustomers,
  createPayment,
  getDashboardSummary,
  subscribeToChanges,
} from '../lib/storage';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Button, Input, Select, Card, Modal, EmptyState } from '../components/common';
import { useToast } from '../context/ToastContext';
import { CreditCard, Plus, User } from 'lucide-react';

interface PaymentsProps {
  onSelectCustomer: (customerId: string) => void;
}

export const Payments: React.FC<PaymentsProps> = ({ onSelectCustomer }) => {
  const { showToast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filterMethod, setFilterMethod] = useState<string>('All');
  const [filterCustomer, setFilterCustomer] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  // Summary figures
  const [todayPaymentsTotal, setTodayPaymentsTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);

  // Add Payment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges((table) => {
      if (['payments', 'customers', 'service_transactions', 'all'].includes(table)) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [payList, custList, summary] = await Promise.all([
      getPayments(),
      getCustomers(),
      getDashboardSummary(),
    ]);

    setPayments(payList);
    setCustomers(custList);
    setTodayPaymentsTotal(summary.todayPayments);
    setPendingTotal(summary.pendingAmount);
    setLoading(false);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      showToast('Please select a customer', 'error');
      return;
    }
    const payNum = parseFloat(amount);
    if (isNaN(payNum) || payNum <= 0) {
      showToast('Please enter a valid amount greater than ₹0', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await createPayment({
        customer_id: selectedCustomerId,
        amount: payNum,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: notes.trim() || undefined,
        created_by: 'Admin',
      });

      showToast(`Payment of ${formatCurrency(payNum)} recorded!`, 'success');
      setIsModalOpen(false);
      setAmount('');
      setNotes('');
      loadData();
    } catch {
      showToast('Failed to save payment', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchMethod = filterMethod === 'All' || p.payment_method === filterMethod;
    const matchCustomer = filterCustomer === 'All' || p.customer_id === filterCustomer;
    return matchMethod && matchCustomer;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard color="var(--primary)" size={24} />
            Payments
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Track customer receipts, cash, and UPI collections
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsModalOpen(true)} icon={<Plus size={18} />}>
          + Add Payment
        </Button>
      </div>

      {/* KPI Overview */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card style={{ backgroundColor: 'var(--bg-surface)' }}>
          <span className="stat-label">TODAY'S COLLECTIONS</span>
          <div className="stat-number" style={{ color: 'var(--primary)', marginTop: 4 }}>
            {formatCurrency(todayPaymentsTotal)}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Received today</span>
        </Card>

        <Card style={{ backgroundColor: 'var(--bg-surface)' }}>
          <span className="stat-label">TOTAL PENDING RECEIVABLES</span>
          <div className="stat-number" style={{ color: 'var(--danger)', marginTop: 4 }}>
            {formatCurrency(pendingTotal)}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Across all customers</span>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Select
          label="Filter by Payment Method"
          options={[
            { value: 'All', label: 'All Payment Methods' },
            { value: 'Cash', label: 'Cash Only' },
            { value: 'UPI', label: 'UPI / GPay / PhonePe' },
            { value: 'Bank Transfer', label: 'Bank Transfer' },
            { value: 'Other', label: 'Other' },
          ]}
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
        />

        <Select
          label="Filter by Customer"
          options={[
            { value: 'All', label: 'All Customers' },
            ...customers.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
        />
      </div>

      {/* Payments List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          Loading payments...
        </div>
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={48} />}
          title="No payments found"
          description="No payments match your selected filters or none have been recorded yet"
          actionText="+ Record Payment"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredPayments.map((p) => (
            <Card
              key={p.id}
              onClick={() => onSelectCustomer(p.customer_id)}
              style={{ padding: '16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={15} color="var(--primary)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                      {p.customer?.name || 'Customer'}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.payment_method}</span>
                    <span>•</span>
                    <span>{formatDate(p.payment_date)}</span>
                  </div>

                  {p.notes && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {p.notes}
                    </p>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: 20,
                      fontWeight: 800,
                      color: 'var(--primary)',
                    }}
                  >
                    +{formatCurrency(p.amount)}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Tap to view ledger
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Customer Payment"
        subtitle="Receipt entry linked to customer ledger"
      >
        <form onSubmit={handleSavePayment}>
          <Select
            label="Customer"
            options={[
              { value: '', label: '-- Select Customer --' },
              ...customers.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.location})`,
              })),
            ]}
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            required
          />

          <Input
            label="Amount (₹)"
            type="number"
            step="1"
            min="1"
            prefix="₹"
            placeholder="e.g. 3000"
            className="large-number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <Select
            label="Payment Method"
            options={[
              { value: 'Cash', label: 'Cash (ரொக்கம்)' },
              { value: 'UPI', label: 'UPI / GPay / PhonePe' },
              { value: 'Bank Transfer', label: 'Bank Transfer (வங்கி)' },
              { value: 'Other', label: 'Other' },
            ]}
            value={paymentMethod}
            onChange={(e: any) => setPaymentMethod(e.target.value)}
          />

          <Input
            label="Payment Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />

          <Input
            label="Notes (Optional)"
            placeholder="Payment details, bill number, reference"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
              Save Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
