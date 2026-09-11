// ========================================================
// Reusable UI Components
// ========================================================

import React from 'react';
import type { PaymentStatus } from '../../types';
import { Fuel, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';

// BUTTON
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`btn btn-${variant} ${fullWidth ? 'btn-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};

// INPUT
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  subLabel?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  subLabel,
  error,
  prefix,
  suffix,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{label}</span>
          {subLabel && <span className="tamil-sub">{subLabel}</span>}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{ position: 'absolute', left: 14, fontWeight: 700, color: 'var(--text-secondary)', pointerEvents: 'none', zIndex: 1 }}>
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          className={`form-input ${className}`}
          style={{
            paddingLeft: prefix ? '34px' : undefined,
            paddingRight: suffix ? '50px' : undefined,
            borderColor: error ? 'var(--danger)' : undefined,
          }}
          {...props}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 14, fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <span style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4, display: 'block' }}>{error}</span>}
    </div>
  );
};

// SELECT
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  subLabel?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  subLabel,
  error,
  options,
  id,
  className = '',
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{label}</span>
          {subLabel && <span className="tamil-sub">{subLabel}</span>}
        </label>
      )}
      <select id={selectId} className={`form-select ${className}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4, display: 'block' }}>{error}</span>}
    </div>
  );
};

// CARD
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}> = ({ children, className = '', onClick, style }) => {
  return (
    <div className={`card ${className}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  );
};

// MODAL
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// STATUS BADGE
export const StatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  let badgeClass = 'pending';
  let Icon = Clock;

  if (status === 'Fully Settled') {
    badgeClass = 'fully-settled';
    Icon = CheckCircle;
  } else if (status === 'Partially Paid') {
    badgeClass = 'partially-paid';
    Icon = Clock;
  } else {
    badgeClass = 'pending';
    Icon = AlertTriangle;
  }

  return (
    <span className={`status-badge ${badgeClass}`}>
      <Icon size={12} />
      <span>{status}</span>
    </span>
  );
};

// FUEL PROGRESS BAR
export const FuelProgress: React.FC<{
  currentLitres: number;
  maxTankLitres?: number;
  label?: string;
}> = ({ currentLitres, maxTankLitres = 45, label }) => {
  const percentage = Math.min(100, Math.max(0, (currentLitres / maxTankLitres) * 100));
  let colorClass = 'high';
  if (percentage <= 25) {
    colorClass = 'low';
  } else if (percentage <= 50) {
    colorClass = 'medium';
  }

  return (
    <div className="fuel-gauge-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Fuel size={16} color={colorClass === 'low' ? 'var(--danger)' : 'var(--primary)'} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {label || 'Fuel Tank'}
          </span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
          {currentLitres.toFixed(2)} L
        </span>
      </div>
      <div className="fuel-gauge-bar">
        <div className={`fuel-gauge-fill ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>0 L (Empty)</span>
        <span>{maxTankLitres} L (Full)</span>
      </div>
    </div>
  );
};

// LOADING SPINNER
export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', minHeight: '40vh' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{message}</span>
    </div>
  );
};

// EMPTY STATE
export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionText, onAction }) => {
  return (
    <div className="empty-state">
      {icon}
      <h4 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>{title}</h4>
      <p style={{ maxWidth: 320 }}>{description}</p>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export { ExportCSV, type ExportCSVProps } from './ExportCSV';
