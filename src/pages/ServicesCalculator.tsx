// ========================================================
// Section 1 — Machinery Usage Calculator
// ========================================================

import React, { useState, useEffect } from 'react';
import type {
  Customer,
  ServiceMaster,
  ServiceTransactionItem,
  SolamWorkerType,
} from '../types';
import {
  getServices,
  getCustomers,
  createCustomer,
  createServiceTransaction,
  createPayment,
} from '../lib/storage';
import {
  calculateServiceAmount,
  calculateGrandTotal,
} from '../utils/calculator';
import { formatCurrency } from '../utils/formatters';
import { Button, Input, Select, Card, Modal } from '../components/common';
import { useToast } from '../context/ToastContext';
import {
  Plus,
  Trash2,
  Check,
  UserPlus,
  Calculator as CalcIcon,
  Receipt,
  RotateCcw,
} from 'lucide-react';

const SERVICE_CATALOG = [
  { name: '5-Kalappai', rate: 1200, unit: 'hour', displayRate: '₹1,200/hr', unitLabel: 'hours' },
  { name: '9-Kalappai', rate: 1200, unit: 'hour', displayRate: '₹1,200/hr', unitLabel: 'hours' },
  { name: 'Paar Kalappai', rate: 1200, unit: 'hour', displayRate: '₹1,200/hr', unitLabel: 'hours' },
  { name: 'Rotavator', rate: 1300, unit: 'hour', displayRate: '₹1,300/hr', unitLabel: 'hours' },
  { name: 'Tanker', rate: 1000, unit: 'load', displayRate: '₹1,000/load', unitLabel: 'loads' },
  { name: 'Solam – ஆள் உண்டு', rate: 100, unit: 'bundle', displayRate: '₹100/bundle', unitLabel: 'bundles', worker_type: 'ஆள் உண்டு' as SolamWorkerType },
  { name: 'Solam – ஆள் இல்லை', rate: 75, unit: 'bundle', displayRate: '₹75/bundle', unitLabel: 'bundles', worker_type: 'ஆள் இல்லை' as SolamWorkerType },
  { name: 'Manjal', rate: 1000, unit: 'load', displayRate: '₹1,000/load', unitLabel: 'loads' },
];

export const ServicesCalculator: React.FC<{
  onGoToCustomer?: (customerId: string) => void;
  initialCustomerId?: string;
}> = ({ onGoToCustomer, initialCustomerId }) => {
  const { showToast } = useToast();

  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');

  // Line Items in current calculation
  const [items, setItems] = useState<Omit<ServiceTransactionItem, 'id' | 'transaction_id'>[]>([]);

  // Current item being configured
  const [currentServiceId, setCurrentServiceId] = useState<string>('5-Kalappai');
  const [quantity, setQuantity] = useState<string>('1');
  const [solamWorkerType, setSolamWorkerType] = useState<SolamWorkerType>('ஆள் உண்டு');

  // Customer modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLocation, setNewCustLocation] = useState('');

  // Save Transaction options
  const [serviceDate, setServiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [immediatePayment, setImmediatePayment] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Other'>('Cash');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [srvList, custList] = await Promise.all([getServices(), getCustomers()]);
    setServices(srvList);
    setCustomers(custList);
    if (srvList.length > 0 && !currentServiceId) {
      setCurrentServiceId(srvList[0].name);
    }
  };

  // Find active service object matching selection
  const selectedServiceObj = (() => {
    const foundInServices = services.find((s) => s.name === currentServiceId || s.id === currentServiceId);
    if (foundInServices) return foundInServices;

    const foundInCatalog = SERVICE_CATALOG.find((s) => s.name === currentServiceId);
    if (foundInCatalog) return foundInCatalog;

    if (currentServiceId.toLowerCase().includes('solam')) {
      const isWithout = currentServiceId.includes('ஆள் இல்லை') || solamWorkerType === 'ஆள் இல்லை';
      return SERVICE_CATALOG.find((s) => s.name.includes(isWithout ? 'ஆள் இல்லை' : 'ஆள் உண்டு')) || SERVICE_CATALOG[5];
    }

    return services[0] || SERVICE_CATALOG[0];
  })();

  const isSolam = selectedServiceObj.name.toLowerCase().includes('solam');

  // Preview calculation for currently selected machine
  const numQty = parseFloat(quantity) || 0;
  const currentCalculated = calculateServiceAmount(
    selectedServiceObj.name,
    numQty,
    isSolam ? solamWorkerType : null,
    selectedServiceObj.rate
  );

  // Grand Total for all items
  const grandTotal = calculateGrandTotal(items);

  // Add Item to calculation list
  const handleAddItem = () => {
    if (numQty <= 0 || isNaN(numQty)) {
      showToast('Please enter a valid quantity greater than 0', 'error');
      return;
    }

    const finalServiceName = isSolam
      ? (solamWorkerType === 'ஆள் இல்லை' ? 'Solam – ஆள் இல்லை' : 'Solam – ஆள் உண்டு')
      : selectedServiceObj.name;

    const newItem: Omit<ServiceTransactionItem, 'id' | 'transaction_id'> = {
      service_id: (selectedServiceObj as any).id || finalServiceName,
      service_name: finalServiceName,
      worker_type: isSolam ? solamWorkerType : null,
      quantity: numQty,
      unit: currentCalculated.unit,
      rate: currentCalculated.rate,
      amount: currentCalculated.amount,
    };

    setItems((prev) => [...prev, newItem]);
    setQuantity('1');
    showToast(`Added ${finalServiceName} (${formatCurrency(currentCalculated.amount)})`, 'success');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setItems([]);
  };

  // Create Quick Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim() || !newCustLocation.trim()) {
      showToast('Name, phone, and village/location are required', 'error');
      return;
    }

    try {
      const created = await createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        location: newCustLocation.trim(),
      });
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomerId(created.id);
      setIsCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustLocation('');
      showToast(`Customer ${created.name} added!`, 'success');
    } catch {
      showToast('Failed to create customer', 'error');
    }
  };

  // Save Transaction
  const handleSaveTransaction = async () => {
    if (items.length === 0) {
      showToast('Please add at least one service to the list', 'error');
      return;
    }
    if (!selectedCustomerId) {
      showToast('Please select or create a customer to link this service', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const savedTx = await createServiceTransaction(
        {
          customer_id: selectedCustomerId,
          service_date: serviceDate,
          notes,
          created_by: 'Admin',
        },
        items
      );

      // Handle immediate payment if entered
      const payAmount = parseFloat(immediatePayment);
      if (!isNaN(payAmount) && payAmount > 0) {
        await createPayment({
          customer_id: selectedCustomerId,
          service_transaction_id: savedTx.id,
          amount: payAmount,
          payment_method: paymentMethod,
          payment_date: serviceDate,
          notes: 'Received during service entry',
          created_by: 'Admin',
        });
      }

      showToast(`Service transaction saved (${formatCurrency(grandTotal)})!`, 'success');

      // Reset form
      setItems([]);
      setNotes('');
      setImmediatePayment('');

      if (onGoToCustomer) {
        onGoToCustomer(selectedCustomerId);
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving service transaction', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      {/* Title & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalcIcon color="var(--primary)" size={24} />
            Machinery Calculator
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Section 1 — Calculate agricultural machinery & harvest charges
          </p>
        </div>

        {items.length > 0 && (
          <Button variant="secondary" onClick={handleClearAll} icon={<RotateCcw size={16} />}>
            Clear
          </Button>
        )}
      </div>

      {/* SERVICE SELECTION CARD */}
      <Card>
        <h3 className="card-title">Select Machinery / Service</h3>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          Choose implement and enter hours or loads
        </p>

        {/* Machinery Service Selection */}
        <div className="form-group">
          <label className="form-label">Service Type (சேவை வகை)</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            {SERVICE_CATALOG.map((srv) => {
              const isSelected = selectedServiceObj?.name === srv.name;
              return (
                <button
                  key={srv.name}
                  type="button"
                  onClick={() => {
                    setCurrentServiceId(srv.name);
                    if (srv.name.includes('ஆள் இல்லை')) {
                      setSolamWorkerType('ஆள் இல்லை');
                    } else if (srv.name.includes('ஆள் உண்டு')) {
                      setSolamWorkerType('ஆள் உண்டு');
                    }
                  }}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{srv.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-muted)', marginTop: 3 }}>
                    {srv.displayRate}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Solam Worker Toggle if Solam is chosen */}
        {isSolam && (
          <div
            style={{
              backgroundColor: 'var(--bg-hover)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--border-color)',
              marginBottom: 14,
            }}
          >
            <label className="form-label" style={{ marginBottom: 8 }}>
              Labor Arrangement (Solam — சோளம் ஆள் விவரம்)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setSolamWorkerType('ஆள் உண்டு');
                  setCurrentServiceId('Solam – ஆள் உண்டு');
                }}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${solamWorkerType === 'ஆள் உண்டு' ? 'var(--primary)' : 'var(--border-color)'}`,
                  backgroundColor: solamWorkerType === 'ஆள் உண்டு' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  color: solamWorkerType === 'ஆள் உண்டு' ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ஆள் உண்டு (With Labor)
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>₹100 / bundle</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSolamWorkerType('ஆள் இல்லை');
                  setCurrentServiceId('Solam – ஆள் இல்லை');
                }}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${solamWorkerType === 'ஆள் இல்லை' ? 'var(--primary)' : 'var(--border-color)'}`,
                  backgroundColor: solamWorkerType === 'ஆள் இல்லை' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  color: solamWorkerType === 'ஆள் இல்லை' ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ஆள் இல்லை (Without Labor)
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>₹75 / bundle</div>
              </button>
            </div>
          </div>
        )}

        {/* Quantity & Live Calculated Amount */}
        <div className="grid-2" style={{ alignItems: 'flex-end' }}>
          <Input
            label={`Quantity (${currentCalculated.unit}s)`}
            subLabel={currentCalculated.unit === 'hour' ? 'நேரம்' : 'எண்ணிக்கை'}
            type="number"
            step={currentCalculated.unit === 'hour' ? '0.25' : '1'}
            min="0"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            suffix={currentCalculated.unit}
            className="large-number"
          />

          <div className="form-group">
            <label className="form-label">Calculated Subtotal</label>
            <div
              style={{
                minHeight: 48,
                padding: '8px 14px',
                backgroundColor: 'var(--bg-hover)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {numQty} × {formatCurrency(currentCalculated.rate)}
              </span>
              <span
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--primary)',
                }}
              >
                {formatCurrency(currentCalculated.amount)}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          onClick={handleAddItem}
          icon={<Plus size={18} />}
          style={{ marginTop: 8 }}
        >
          + Add to Service List
        </Button>
      </Card>

      {/* ADDED SERVICE ITEMS LIST */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="card-title">Service Items ({items.length})</h3>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Review calculation before saving
          </span>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
            No service items added yet. Select machinery above and click <strong>"+ Add to Service List"</strong>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>
                    {item.service_name}
                    {item.worker_type && !item.service_name.includes(item.worker_type) && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginLeft: 6 }}>
                        ({item.worker_type})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {item.quantity} {item.unit}s × {formatCurrency(item.rate)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
                    {formatCurrency(item.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    title="Remove item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {/* Grand Total Banner */}
            <div
              style={{
                marginTop: 12,
                padding: '16px',
                backgroundColor: 'var(--primary-light)',
                border: '1.5px solid var(--primary-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Grand Total
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Total {items.length} service entries
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--primary)',
                }}
              >
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* CUSTOMER & TRANSACTION SAVE SECTION */}
      {items.length > 0 && (
        <Card>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={20} color="var(--primary)" />
            Link to Customer & Save
          </h3>
          <p className="card-subtitle" style={{ marginBottom: 14 }}>
            Every service transaction must be linked to a customer ledger
          </p>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Select Customer</label>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <UserPlus size={14} />
                <span>+ Create New Customer</span>
              </button>
            </div>

            <Select
              options={[
                { value: '', label: '-- Select Customer --' },
                ...customers.map((c) => ({
                  value: c.id,
                  label: `${c.name} • ${c.phone} (${c.location})`,
                })),
              ]}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            />
          </div>

          <div className="grid-2">
            <Input
              label="Service Date"
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
            />

            <Input
              label="Optional Notes"
              placeholder="e.g. South field, 2nd round"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Quick Immediate Payment (Optional) */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--bg-hover)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: 16,
            }}
          >
            <label className="form-label" style={{ marginBottom: 8 }}>
              Record Immediate Payment / Advance (Optional)
            </label>
            <div className="grid-2">
              <Input
                placeholder="Amount received (₹)"
                type="number"
                prefix="₹"
                inputMode="decimal"
                value={immediatePayment}
                onChange={(e) => setImmediatePayment(e.target.value)}
              />

              <Select
                options={[
                  { value: 'Cash', label: 'Cash (ரொக்கம்)' },
                  { value: 'UPI', label: 'UPI / GPay / PhonePe' },
                  { value: 'Bank Transfer', label: 'Bank Transfer' },
                  { value: 'Other', label: 'Other' },
                ]}
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
              />
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            isLoading={isSaving}
            onClick={handleSaveTransaction}
            icon={<Check size={20} />}
            style={{ height: 52, fontSize: 16 }}
          >
            Save Service Transaction ({formatCurrency(grandTotal)})
          </Button>
        </Card>
      )}

      {/* QUICK CUSTOMER CREATE MODAL */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
        subtitle="Quick customer entry to link this transaction"
      >
        <form onSubmit={handleCreateCustomer}>
          <Input
            label="Customer Name"
            subLabel="பெயர்"
            placeholder="e.g. K. Murugan"
            value={newCustName}
            onChange={(e) => setNewCustName(e.target.value)}
            required
          />

          <Input
            label="Mobile Number"
            subLabel="தொலைபேசி எண்"
            placeholder="10 digit number"
            type="tel"
            inputMode="numeric"
            value={newCustPhone}
            onChange={(e) => setNewCustPhone(e.target.value)}
            required
          />

          <Input
            label="Village / Location"
            subLabel="ஊர்"
            placeholder="e.g. Kovilur"
            value={newCustLocation}
            onChange={(e) => setNewCustLocation(e.target.value)}
            required
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsCustomerModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" fullWidth>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
