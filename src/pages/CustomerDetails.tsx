// ========================================================
// Customer Details — Services & Payment Ledger
// ========================================================

import React, { useState, useEffect } from 'react';
import type { Customer, ServiceTransaction, Payment, CustomerBalanceInfo, PaymentMethod } from '../types';
import {
  getCustomerById,
  getServiceTransactions,
  getPayments,
  getCustomerStats,
  createPayment,
  subscribeToChanges,
} from '../lib/storage';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Button, Input, Select, Card, Modal, StatusBadge } from '../components/common';
import { useToast } from '../context/ToastContext';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Phone,
  MapPin,
  CreditCard,
  Plus,
  Receipt,
  Calendar,
} from 'lucide-react';

interface CustomerDetailsProps {
  customerId: string;
  onBack: () => void;
  onNewService: (customerId: string) => void;
}

export const CustomerDetails: React.FC<CustomerDetailsProps> = ({
  customerId,
  onBack,
  onNewService,
}) => {
  const { showToast } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [services, setServices] = useState<ServiceTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<CustomerBalanceInfo>({
    totalAmount: 0,
    totalPaid: 0,
    balance: 0,
    status: 'Fully Settled',
  });
  const [loading, setLoading] = useState(true);

  // Add Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [isSavingPay, setIsSavingPay] = useState(false);

  useEffect(() => {
    loadCustomerData();
    const unsubscribe = subscribeToChanges((table) => {
      if (['customers', 'payments', 'service_transactions', 'all'].includes(table)) {
        loadCustomerData();
      }
    });
    return () => unsubscribe();
  }, [customerId]);

  const loadCustomerData = async () => {
    setLoading(true);
    const [cust, txList, payList, balanceStats] = await Promise.all([
      getCustomerById(customerId),
      getServiceTransactions(customerId),
      getPayments(customerId),
      getCustomerStats(customerId),
    ]);

    setCustomer(cust);
    setServices(txList);
    setPayments(payList);
    setStats(balanceStats);
    setLoading(false);
  };

  const handleOpenPaymentModal = () => {
    // Default to the balance amount if positive
    setPayAmount(stats.balance > 0 ? String(stats.balance) : '');
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid payment amount greater than ₹0', 'error');
      return;
    }

    setIsSavingPay(true);
    try {
      await createPayment({
        customer_id: customerId,
        amount,
        payment_method: payMethod,
        payment_date: payDate,
        notes: payNotes.trim() || undefined,
        created_by: 'Admin',
      });

      showToast(`Payment of ${formatCurrency(amount)} recorded successfully!`, 'success');

      // If this payment fully settles or clears the balance, celebrate with confetti
      if (amount >= stats.balance && stats.balance > 0) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      setIsPaymentModalOpen(false);
      loadCustomerData();
    } catch {
      showToast('Failed to record payment', 'error');
    } finally {
      setIsSavingPay(false);
    }
  };

  if (loading || !customer) {
    return (
      <div className="page-container">
        <Button variant="secondary" onClick={onBack} icon={<ArrowLeft size={16} />}>
          Back to Customers
        </Button>
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          Loading customer ledger...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Back Button */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ArrowLeft size={18} />
        <span>Back to Customers</span>
      </button>

      {/* Customer Profile Header */}
      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>
                {customer.name}
              </h2>
              <StatusBadge status={stats.status} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
              <a
                href={`tel:${customer.phone}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                <Phone size={15} />
                {customer.phone}
              </a>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} color="var(--text-muted)" />
                {customer.location}
              </span>
            </div>

            {customer.address && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                {customer.address}
              </p>
            )}

            {customer.notes && (
              <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontStyle: 'italic' }}>
                Note: {customer.notes}
              </p>
            )}
          </div>
        </div>

        {/* Financial KPI Summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 18,
            backgroundColor: 'var(--bg-hover)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL BILLED</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>
              {formatCurrency(stats.totalAmount)}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL PAID</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>
              {formatCurrency(stats.totalPaid)}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>BALANCE DUE</span>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: stats.balance > 0 ? 'var(--danger)' : 'var(--primary)',
                fontFamily: 'Outfit, sans-serif',
                marginTop: 2,
              }}
            >
              {formatCurrency(stats.balance)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          <Button
            variant="primary"
            onClick={handleOpenPaymentModal}
            icon={<CreditCard size={18} />}
          >
            + Add Payment
          </Button>

          <Button
            variant="secondary"
            onClick={() => onNewService(customer.id)}
            icon={<Plus size={18} />}
          >
            + New Service
          </Button>
        </div>
      </Card>

      {/* SERVICE HISTORY */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Receipt size={20} color="var(--primary)" />
          Service History ({services.length})
        </h3>

        {services.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            No service records found for this customer.
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {services.map((tx) => (
              <Card key={tx.id} style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={14} />
                    {formatDate(tx.service_date)}
                  </span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
                    {formatCurrency(tx.total_amount)}
                  </span>
                </div>

                {/* Items breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, backgroundColor: 'var(--bg-hover)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  {tx.items?.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>
                        <strong>{item.service_name}</strong>
                        {item.worker_type ? ` (${item.worker_type})` : ''} — {item.quantity} {item.unit}s @ {formatCurrency(item.rate)}
                      </span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>

                {tx.notes && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    {tx.notes}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* PAYMENT HISTORY */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CreditCard size={20} color="var(--primary)" />
          Payment History ({payments.length})
        </h3>

        {payments.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            No payments recorded yet. Click <strong>"+ Add Payment"</strong> above.
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payments.map((p) => (
              <Card key={p.id} style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                      Received via {p.payment_method}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {formatDate(p.payment_date)} {p.notes ? `• ${p.notes}` : ''}
                    </div>
                  </div>

                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                    +{formatCurrency(p.amount)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Customer Payment"
        subtitle={`Receipt for ${customer.name} (Balance: ${formatCurrency(stats.balance)})`}
      >
        <form onSubmit={handleRecordPayment}>
          <Input
            label="Payment Amount"
            subLabel="தொகை"
            type="number"
            step="1"
            min="1"
            prefix="₹"
            placeholder="e.g. 2000"
            inputMode="decimal"
            className="large-number"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            required
          />

          <Select
            label="Payment Method"
            subLabel="செலுத்தும் முறை"
            options={[
              { value: 'Cash', label: 'Cash (ரொக்கம்)' },
              { value: 'UPI', label: 'UPI / GPay / PhonePe' },
              { value: 'Bank Transfer', label: 'Bank Transfer (வங்கி)' },
              { value: 'Other', label: 'Other' },
            ]}
            value={payMethod}
            onChange={(e: any) => setPayMethod(e.target.value)}
          />

          <Input
            label="Payment Date"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            required
          />

          <Input
            label="Notes (Optional)"
            placeholder="e.g. Received in field, advance payment"
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" fullWidth isLoading={isSavingPay}>
              Save Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
