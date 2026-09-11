// ========================================================
// DSR TRACTORS — Main Application Root
// ========================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { BottomNav, type ActiveTab } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MoreModal } from './components/layout/MoreModal';
import { Modal, Input, Button } from './components/common';
import { useToast } from './context/ToastContext';
import { createCustomer, createPayment, getCustomers } from './lib/storage';

// Pages
import { Auth, type AuthMode } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { ServicesCalculator } from './pages/ServicesCalculator';
import { Customers } from './pages/Customers';
import { CustomerDetails } from './pages/CustomerDetails';
import { Payments } from './pages/Payments';
import { DieselCalculator } from './pages/DieselCalculator';
import { DieselHistory } from './pages/DieselHistory';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  const { isAuthenticated, loading, isRecoveryMode } = useAuth();
  const { showToast } = useToast();

  const getInitialAuthMode = (): AuthMode => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash || '';
      if (path === '/signup') return 'signup';
      if (path === '/forgot-password') return 'forgot-password';
      if (path === '/reset-password' || hash.includes('type=recovery')) return 'reset-password';
    }
    return 'login';
  };

  const [authMode, setAuthMode] = useState<AuthMode>(getInitialAuthMode);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Email confirmation callback & popstate routing detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash || '';
    const search = window.location.search || '';

    // Handle email verification callback
    if (hash.includes('type=signup') || search.includes('type=signup')) {
      showToast('Email verified successfully. You can now continue.', 'success');
      window.history.replaceState(null, '', '/');
    }

    // Handle password recovery callback
    if (hash.includes('type=recovery') || search.includes('type=recovery') || window.location.pathname === '/reset-password') {
      setAuthMode('reset-password');
    }

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/signup') setAuthMode('signup');
      else if (path === '/forgot-password') setAuthMode('forgot-password');
      else if (path === '/reset-password') setAuthMode('reset-password');
      else setAuthMode('login');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showToast]);

  // Selected customer for drill-down view or service flow
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [calculatorPresetCustomerId, setCalculatorPresetCustomerId] = useState<string | undefined>(undefined);

  // Global Quick Action Modals
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustLocation, setQuickCustLocation] = useState('');

  const [isQuickPaymentModalOpen, setIsQuickPaymentModalOpen] = useState(false);
  const [quickPayCustId, setQuickPayCustId] = useState('');
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayMethod, setQuickPayMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Other'>('Cash');
  const [allCustomersList, setAllCustomersList] = useState<{ id: string; name: string }[]>([]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  // If in recovery mode or unauthenticated, show public auth routes
  if (isRecoveryMode || !isAuthenticated) {
    return (
      <Auth
        initialMode={isRecoveryMode ? 'reset-password' : authMode}
        onNavigateMode={(mode) => setAuthMode(mode)}
      />
    );
  }

  // Handle customer drill down
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
  };

  // Handle starting a new service for a specific customer
  const handleNewServiceForCustomer = (customerId: string) => {
    setSelectedCustomerId(null);
    setCalculatorPresetCustomerId(customerId);
    setActiveTab('services');
  };

  // Quick Customer Submit
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim() || !quickCustPhone.trim() || !quickCustLocation.trim()) {
      showToast('Name, phone, and village are required', 'error');
      return;
    }
    try {
      const created = await createCustomer({
        name: quickCustName.trim(),
        phone: quickCustPhone.trim(),
        location: quickCustLocation.trim(),
      });
      showToast(`Customer ${created.name} added!`, 'success');
      setIsQuickCustomerModalOpen(false);
      setQuickCustName('');
      setQuickCustPhone('');
      setQuickCustLocation('');
    } catch {
      showToast('Failed to save customer', 'error');
    }
  };

  // Open Quick Payment Modal
  const handleOpenQuickPayment = async () => {
    const custs = await getCustomers();
    setAllCustomersList(custs);
    if (custs.length > 0) {
      setQuickPayCustId(custs[0].id);
    }
    setQuickPayAmount('');
    setIsQuickPaymentModalOpen(true);
  };

  // Save Quick Payment
  const handleSaveQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(quickPayAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    try {
      await createPayment({
        customer_id: quickPayCustId,
        amount: amt,
        payment_method: quickPayMethod,
        payment_date: new Date().toISOString().split('T')[0],
        notes: 'Quick payment collection',
        created_by: 'Staff',
      });
      showToast(`Payment of ₹${amt.toLocaleString('en-IN')} recorded!`, 'success');
      setIsQuickPaymentModalOpen(false);
    } catch {
      showToast('Failed to record payment', 'error');
    }
  };

  // Determine current page title
  const getHeaderTitle = () => {
    if (selectedCustomerId) return 'Customer Ledger';
    switch (activeTab) {
      case 'dashboard': return 'DSR TRACTORS';
      case 'services': return 'Machinery Calculator';
      case 'customers': return 'Customer Management';
      case 'payments': return 'Payments & Collections';
      case 'diesel': return 'Tractor Diesel Calculator';
      case 'reports': return 'Business Reports';
      case 'settings': return 'Settings';
      default: return 'DSR TRACTORS';
    }
  };

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSelectedCustomerId(null);
          setActiveTab(tab);
        }}
      />

      <div className="main-content">
        {/* Top Header */}
        <Header
          title={getHeaderTitle()}
          subtitle="DSR Tractors Agricultural Operations"
          onMoreClick={() => setIsMoreOpen(true)}
        />

        {/* Page Content Switcher */}
        <main>
          {selectedCustomerId ? (
            <CustomerDetails
              customerId={selectedCustomerId}
              onBack={() => setSelectedCustomerId(null)}
              onNewService={(cid) => handleNewServiceForCustomer(cid)}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  onNavigate={(tab) => {
                    setSelectedCustomerId(null);
                    setActiveTab(tab);
                  }}
                  onNewCustomer={() => setIsQuickCustomerModalOpen(true)}
                  onAddPayment={handleOpenQuickPayment}
                />
              )}

              {activeTab === 'services' && (
                <ServicesCalculator
                  initialCustomerId={calculatorPresetCustomerId}
                  onGoToCustomer={(cid) => {
                    setCalculatorPresetCustomerId(undefined);
                    handleSelectCustomer(cid);
                  }}
                />
              )}

              {activeTab === 'customers' && (
                <Customers
                  onSelectCustomer={handleSelectCustomer}
                  onNewServiceForCustomer={handleNewServiceForCustomer}
                />
              )}

              {activeTab === 'payments' && (
                <Payments onSelectCustomer={handleSelectCustomer} />
              )}

              {activeTab === 'diesel' && (
                <DieselCalculator
                  onGoToHistory={() => {
                    setActiveTab('more');
                    // Render diesel history inside page
                  }}
                />
              )}

              {activeTab === 'reports' && <Reports />}

              {activeTab === 'settings' && <Settings />}

              {activeTab === 'more' && (
                <DieselHistory
                  onBack={() => setActiveTab('diesel')}
                />
              )}
            </>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setSelectedCustomerId(null);
            setActiveTab(tab);
          }}
          onOpenMore={() => setIsMoreOpen(true)}
        />

        {/* Mobile "More" Bottom Sheet Modal */}
        <MoreModal
          isOpen={isMoreOpen}
          onClose={() => setIsMoreOpen(false)}
          onNavigate={(tab) => {
            setSelectedCustomerId(null);
            setActiveTab(tab);
          }}
        />

        {/* Global Quick Customer Modal */}
        <Modal
          isOpen={isQuickCustomerModalOpen}
          onClose={() => setIsQuickCustomerModalOpen(false)}
          title="Add New Customer"
          subtitle="Quick add customer to directory"
        >
          <form onSubmit={handleSaveQuickCustomer}>
            <Input
              label="Customer Name"
              subLabel="பெயர்"
              placeholder="e.g. S. Murugan"
              value={quickCustName}
              onChange={(e) => setQuickCustName(e.target.value)}
              required
            />
            <Input
              label="Mobile Number"
              subLabel="தொலைபேசி எண்"
              placeholder="10 digit number"
              type="tel"
              inputMode="numeric"
              value={quickCustPhone}
              onChange={(e) => setQuickCustPhone(e.target.value)}
              required
            />
            <Input
              label="Village / Location"
              subLabel="ஊர்"
              placeholder="e.g. Kovilur"
              value={quickCustLocation}
              onChange={(e) => setQuickCustLocation(e.target.value)}
              required
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Button type="button" variant="secondary" fullWidth onClick={() => setIsQuickCustomerModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" fullWidth>
                Save Customer
              </Button>
            </div>
          </form>
        </Modal>

        {/* Global Quick Payment Modal */}
        <Modal
          isOpen={isQuickPaymentModalOpen}
          onClose={() => setIsQuickPaymentModalOpen(false)}
          title="Record Customer Payment"
          subtitle="Quick collection entry"
        >
          <form onSubmit={handleSaveQuickPayment}>
            <div className="form-group">
              <label className="form-label">Customer</label>
              <select
                className="form-select"
                value={quickPayCustId}
                onChange={(e) => setQuickPayCustId(e.target.value)}
                required
              >
                {allCustomersList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input
              label="Amount (₹)"
              type="number"
              prefix="₹"
              placeholder="e.g. 2500"
              inputMode="decimal"
              className="large-number"
              value={quickPayAmount}
              onChange={(e) => setQuickPayAmount(e.target.value)}
              required
            />
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select
                className="form-select"
                value={quickPayMethod}
                onChange={(e: any) => setQuickPayMethod(e.target.value)}
              >
                <option value="Cash">Cash (ரொக்கம்)</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Button type="button" variant="secondary" fullWidth onClick={() => setIsQuickPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" fullWidth>
                Save Payment
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};
