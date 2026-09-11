// ========================================================
// Desktop Sidebar Navigation
// ========================================================

import React from 'react';
import type { ActiveTab } from './BottomNav';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  Home,
  Calculator,
  Users,
  CreditCard,
  Fuel,
  BarChart3,
  Settings as SettingsIcon,
  Database,
  Cloud,
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user } = useAuth();
  const isCloud = isSupabaseConfigured();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: Home },
    { id: 'services' as ActiveTab, label: 'Machinery Calculator', icon: Calculator },
    { id: 'customers' as ActiveTab, label: 'Customers', icon: Users },
    { id: 'payments' as ActiveTab, label: 'Payments', icon: CreditCard },
    { id: 'diesel' as ActiveTab, label: 'Tractor Diesel', icon: Fuel },
    { id: 'reports' as ActiveTab, label: 'Reports & Export', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="desktop-sidebar" aria-label="Desktop Sidebar">
      {/* Brand Header */}
      <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '12px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(21, 128, 61, 0.3)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0"/>
            <path d="M14 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0"/>
            <path d="M6 14h6v-4H8a2 2 0 0 1-2-2V7"/>
            <path d="M18 9v-2a2 2 0 0 0-2-2h-3l-2 3"/>
            <path d="M14 14V9"/>
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            DSR TRACTORS
          </h2>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Business Suite</span>
        </div>
      </div>

      {/* Navigation List */}
      <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 14,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer Info & Storage Status */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-hover)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {isCloud ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: 999 }}>
              <Cloud size={12} /> Supabase Connected
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: 999 }}>
              <Database size={12} /> Local Offline Ready
            </span>
          )}
        </div>
        {user && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </div>
            {user.email && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                {user.email}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
