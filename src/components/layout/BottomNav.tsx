// ========================================================
// Mobile Bottom Navigation Bar
// ========================================================

import React from 'react';
import { Home, Calculator, Users, Fuel, MoreHorizontal } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'services' | 'customers' | 'diesel' | 'payments' | 'reports' | 'settings' | 'more';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenMore: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenMore,
}) => {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <button
        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onTabChange('dashboard')}
      >
        <Home size={20} />
        <span>Home</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'services' ? 'active' : ''}`}
        onClick={() => onTabChange('services')}
      >
        <Calculator size={20} />
        <span>Services</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
        onClick={() => onTabChange('customers')}
      >
        <Users size={20} />
        <span>Customers</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'diesel' ? 'active' : ''}`}
        onClick={() => onTabChange('diesel')}
      >
        <Fuel size={20} />
        <span>Diesel</span>
      </button>

      <button
        className={`nav-item ${['more', 'payments', 'reports', 'settings'].includes(activeTab) ? 'active' : ''}`}
        onClick={onOpenMore}
      >
        <MoreHorizontal size={20} />
        <span>More</span>
      </button>
    </nav>
  );
};
