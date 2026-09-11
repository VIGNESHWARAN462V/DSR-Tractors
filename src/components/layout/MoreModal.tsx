// ========================================================
// Mobile "More" Menu Bottom Sheet
// ========================================================

import React from 'react';
import type { ActiveTab } from './BottomNav';
import { CreditCard, BarChart3, Settings, RotateCcw, X } from 'lucide-react';
import { resetToDemoData } from '../../lib/storage';
import { useToast } from '../../context/ToastContext';

interface MoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const MoreModal: React.FC<MoreModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleNav = (tab: ActiveTab) => {
    onNavigate(tab);
    onClose();
  };

  const handleResetData = () => {
    if (window.confirm('Reset all demo data back to default values? Any changes will be overwritten.')) {
      resetToDemoData();
      showToast('Demo data reset to initial values', 'info');
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>More Options</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => handleNav('payments')}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px 16px', fontSize: 15 }}
          >
            <CreditCard size={20} color="var(--primary)" />
            <span>Payments Management</span>
          </button>

          <button
            onClick={() => handleNav('reports')}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px 16px', fontSize: 15 }}
          >
            <BarChart3 size={20} color="var(--primary)" />
            <span>Reports & Summary</span>
          </button>

          <button
            onClick={() => handleNav('settings')}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px 16px', fontSize: 15 }}
          >
            <Settings size={20} color="var(--primary)" />
            <span>Settings & Fuel Rates</span>
          </button>

          <button
            onClick={handleResetData}
            className="btn btn-outline"
            style={{ justifyContent: 'flex-start', padding: '14px 16px', fontSize: 15, marginTop: 8 }}
          >
            <RotateCcw size={20} />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
