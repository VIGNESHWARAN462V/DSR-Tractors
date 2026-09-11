// ========================================================
// Reusable Export CSV Component
// ========================================================

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { exportCSV } from '../../utils/csvExport';

export interface ExportCSVProps<T> {
  /** The dataset to export as CSV */
  data: T[];
  /** Label for the button, defaults to 'Export CSV' */
  label?: string;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Button sizing */
  size?: 'sm' | 'md';
  /** Additional CSS class names */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export function ExportCSV<T>({
  data,
  label = 'Export CSV',
  variant = 'outline',
  size = 'sm',
  className = '',
  style,
  disabled = false,
}: ExportCSVProps<T>): React.ReactElement {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setIsExporting(true);
      await exportCSV(data as any[]);
    } finally {
      setIsExporting(false);
    }
  };

  // Base styling for size variants
  const sizeStyles: React.CSSProperties =
    size === 'sm'
      ? {
          padding: '6px 12px',
          fontSize: '12px',
          gap: '6px',
        }
      : {
          padding: '10px 18px',
          fontSize: '14px',
          gap: '8px',
        };

  // Variant styling
  let variantStyles: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: 'var(--primary)',
    border: '1.5px solid var(--primary)',
  };

  if (variant === 'primary') {
    variantStyles = {
      backgroundColor: 'var(--primary)',
      color: '#ffffff',
      border: '1.5px solid var(--primary)',
      boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
    };
  } else if (variant === 'secondary') {
    variantStyles = {
      backgroundColor: 'var(--bg-surface)',
      color: 'var(--text-main)',
      border: '1.5px solid var(--border-color)',
    };
  }

  return (
    <button
      type="button"
      id="export-csv-btn"
      onClick={handleExport}
      disabled={disabled || isExporting}
      className={`btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        fontWeight: 700,
        cursor: disabled || isExporting ? 'not-allowed' : 'pointer',
        opacity: disabled || isExporting ? 0.6 : 1,
        transition: 'all 0.2s ease',
        ...sizeStyles,
        ...variantStyles,
        ...style,
      }}
      title="Download DSR-Report.csv"
    >
      <Download size={size === 'sm' ? 14 : 16} />
      <span>{isExporting ? 'Exporting...' : label}</span>
    </button>
  );
}
