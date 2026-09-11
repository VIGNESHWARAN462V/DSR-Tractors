// ========================================================
// Section 2 — Customer Management
// ========================================================

import React, { useState, useEffect } from 'react';
import type { Customer, CustomerBalanceInfo } from '../types';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
  subscribeToChanges,
} from '../lib/storage';
import { formatCurrency } from '../utils/formatters';
import { Button, Input, Card, Modal, StatusBadge, EmptyState } from '../components/common';
import { useToast } from '../context/ToastContext';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  ChevronRight,
  Edit2,
  Trash2,
} from 'lucide-react';

interface CustomersProps {
  onSelectCustomer: (customerId: string) => void;
  onNewServiceForCustomer: (customerId: string) => void;
}

export const Customers: React.FC<CustomersProps> = ({
  onSelectCustomer,
  onNewServiceForCustomer,
}) => {
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerBalances, setCustomerBalances] = useState<Record<string, CustomerBalanceInfo>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadCustomers();
    const unsubscribe = subscribeToChanges((table) => {
      if (['customers', 'payments', 'service_transactions', 'all'].includes(table)) {
        loadCustomers();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadCustomers = async () => {
    // Keep UI responsive: only show full loading state on first load
    if (customers.length === 0) {
      setLoading(true);
    }
    try {
      const list = await getCustomers();
      setCustomers(list);

      // Fetch balances in parallel
      const balanceEntries = await Promise.all(
        list.map(async (cust) => {
          try {
            const stats = await getCustomerStats(cust.id);
            return [cust.id, stats] as const;
          } catch {
            return [cust.id, { totalAmount: 0, totalPaid: 0, balance: 0, status: 'Pending' }] as const;
          }
        })
      );
      setCustomerBalances(Object.fromEntries(balanceEntries));
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setLocation('');
    setAddress('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setLocation(cust.location);
    setAddress(cust.address || '');
    setNotes(cust.notes || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete customer "${cust.name}"? This will also remove related service transactions and payment records.`)) {
      // Optimistic removal
      setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
      await deleteCustomer(cust.id);
      showToast(`Deleted ${cust.name}`, 'info');
      loadCustomers();
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !location.trim()) {
      showToast('Name, phone number, and village/location are required', 'error');
      return;
    }

    try {
      let savedCust: Customer;
      if (editingCustomer) {
        const updated = await updateCustomer(editingCustomer.id, {
          name: name.trim(),
          phone: phone.trim(),
          location: location.trim(),
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        savedCust = (updated || { ...editingCustomer, name: name.trim(), phone: phone.trim(), location: location.trim() }) as Customer;
        showToast('Customer updated successfully', 'success');
      } else {
        savedCust = await createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          location: location.trim(),
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        showToast('New customer added successfully', 'success');
      }

      // Optimistic instant addition to state
      setCustomers((prev) => [savedCust, ...prev.filter((c) => c.id !== savedCust.id)]);
      setIsModalOpen(false);

      // Refresh in background
      loadCustomers();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save customer', 'error');
    }
  };

  // Filter customers by search term
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container">
      {/* Header with Search and Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users color="var(--primary)" size={24} />
            Customers ({customers.length})
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Customer ledger, balances, and service history
          </p>
        </div>

        <Button variant="primary" onClick={openAddModal} icon={<Plus size={18} />}>
          + Add Customer
        </Button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by name, phone, or village..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          prefix={<Search size={18} />}
        />
      </div>

      {/* Customer Cards List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          Loading customer records...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title={searchQuery ? 'No customers match your search' : 'No customers yet'}
          description={searchQuery ? 'Try searching by a different name or phone number' : 'Add your first customer to track machinery services and payments'}
          actionText="+ Add Customer"
          onAction={openAddModal}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCustomers.map((cust) => {
            const stats = customerBalances[cust.id] || {
              totalAmount: 0,
              totalPaid: 0,
              balance: 0,
              status: 'Fully Settled',
            };

            return (
              <Card
                key={cust.id}
                onClick={() => onSelectCustomer(cust.id)}
                style={{ padding: '16px', transition: 'transform 0.15s ease' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
                        {cust.name}
                      </h3>
                      <StatusBadge status={stats.status} />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={13} color="var(--text-muted)" />
                        {cust.phone}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} color="var(--text-muted)" />
                        {cust.location}
                      </span>
                    </div>
                  </div>

                  {/* Edit and Delete action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={(e) => openEditModal(cust, e)}
                      title="Edit Customer"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-secondary)' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(cust, e)}
                      title="Delete Customer"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--danger)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Financial Overview Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-hover)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL BILLED</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                      {formatCurrency(stats.totalAmount)}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>PAID</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>
                      {formatCurrency(stats.totalPaid)}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>BALANCE</span>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: stats.balance > 0 ? 'var(--danger)' : 'var(--primary)',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                    >
                      {formatCurrency(stats.balance)}
                    </div>
                  </div>
                </div>

                {/* Quick Service Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewServiceForCustomer(cust.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Add New Service
                  </button>

                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    View Ledger <ChevronRight size={14} />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        subtitle="Manage customer profile & contact details"
      >
        <form onSubmit={handleSaveCustomer}>
          <Input
            label="Customer Name"
            subLabel="பெயர்"
            placeholder="e.g. K. Ramesh"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Mobile Number"
            subLabel="தொலைபேசி எண்"
            placeholder="10 digit mobile number"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <Input
            label="Village / Location"
            subLabel="ஊர்"
            placeholder="e.g. Kovilur / Pudukkottai"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />

          <Input
            label="Street Address (Optional)"
            placeholder="Door number, street name"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <Input
            label="Notes (Optional)"
            placeholder="Land landmark, regular implements needed"
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
            <Button type="submit" variant="primary" fullWidth>
              {editingCustomer ? 'Update Customer' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
