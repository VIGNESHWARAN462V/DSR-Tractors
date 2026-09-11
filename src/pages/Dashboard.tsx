// ========================================================
// Section 10 — Real-Time Operations Dashboard
// ========================================================

import React, { useState, useEffect } from 'react';
import type { DashboardSummary } from '../types';
import { getDashboardSummary, subscribeToChanges } from '../lib/storage';
import { formatCurrency, formatLitres, formatDate } from '../utils/formatters';
import { Card, FuelProgress } from '../components/common';
import type { ActiveTab } from '../components/layout/BottomNav';
import {
  Calendar,
  DollarSign,
  CreditCard,
  AlertCircle,
  Users,
  Fuel,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Download,
} from 'lucide-react';

async function exportCSV(data: any[]) {
  if (!data || data.length === 0) {
    alert("No data available to export");
    return;
  }

  const headers = Object.keys(data[0]);

  const escapeCSV = (value: any) => {
    if (value === null || value === undefined) return "";
    return `"${String(value).replace(/"/g, '""')}"`;
  };

  const rows = data.map((item) =>
    headers.map((header) => escapeCSV(item[header])).join(",")
  );

  const csvContent = "\uFEFF" + [
    headers.join(","),
    ...rows
  ].join("\r\n");

  // Preferred method: File System Access API
  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: "DSR-Report.csv",
        types: [
          {
            description: "CSV File",
            accept: {
              "text/csv": [".csv"]
            }
          }
        ]
      });

      const writable = await fileHandle.createWritable();

      await writable.write(
        new Blob([csvContent], {
          type: "text/csv;charset=utf-8"
        })
      );

      await writable.close();

      return;
    } catch (error: any) {
      // User cancelled save dialog
      if (error?.name === "AbortError") {
        return;
      }

      console.error("File save failed:", error);
    }
  }

  // Fallback for browsers without File System Access API
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "DSR-Report.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

interface DashboardProps {
  onNavigate: (tab: ActiveTab) => void;
  onNewCustomer: () => void;
  onAddPayment: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onNewCustomer,
  onAddPayment,
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
    const unsubscribe = subscribeToChanges(() => {
      loadSummary();
    });
    return () => unsubscribe();
  }, []);

  const loadSummary = async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (e) {
      console.error('Failed to load dashboard summary:', e);
    } finally {
      setLoading(false);
    }
  };

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  if (loading || !summary) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
        Loading dashboard operations...
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Date & Title Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
            <Calendar size={15} />
            {todayFormatted}
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
            Business Overview
          </h2>
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => onNavigate('services')}
          style={{
            padding: '12px 6px',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
          }}
        >
          <Plus size={18} />
          <span>New Service</span>
        </button>

        <button
          onClick={onNewCustomer}
          style={{
            padding: '12px 6px',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-main)',
            border: '1.5px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Users size={18} color="var(--primary)" />
          <span>Customer</span>
        </button>

        <button
          onClick={onAddPayment}
          style={{
            padding: '12px 6px',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-main)',
            border: '1.5px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <CreditCard size={18} color="var(--primary)" />
          <span>Payment</span>
        </button>

        <button
          onClick={() => onNavigate('diesel')}
          style={{
            padding: '12px 6px',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-main)',
            border: '1.5px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Fuel size={18} color="var(--primary)" />
          <span>Diesel</span>
        </button>
      </div>

      {/* CORE KPI CARDS GRID */}
      <div className="grid-2 grid-kpi" style={{ marginBottom: 20 }}>
        {/* Today's Revenue */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">TODAY'S REVENUE</span>
              <div className="stat-number" style={{ color: 'var(--primary)', marginTop: 4 }}>
                {formatCurrency(summary.todayRevenue)}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            {summary.todayServicesCount} service{summary.todayServicesCount === 1 ? '' : 's'} recorded today
          </div>
        </Card>

        {/* Pending Receivables */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">TOTAL PENDING DUE</span>
              <div className="stat-number" style={{ color: 'var(--danger)', marginTop: 4 }}>
                {formatCurrency(summary.pendingAmount)}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            Across all customer accounts
          </div>
        </Card>

        {/* Today's Payments Received */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">TODAY'S PAYMENTS</span>
              <div className="stat-number" style={{ color: 'var(--text-main)', marginTop: 4 }}>
                {formatCurrency(summary.todayPayments)}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            Cash & UPI collected today
          </div>
        </Card>

        {/* Today's Diesel Consumption */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">DIESEL USED TODAY</span>
              <div className="stat-number" style={{ color: 'var(--accent)', marginTop: 4 }}>
                {formatLitres(summary.todayDieselUsed)}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Fuel size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            Across all 3 working tractors
          </div>
        </Card>
      </div>

      {/* 2-COLUMN BALANCED DESKTOP SECTIONS */}
      <div className="dashboard-sections-grid">
        {/* TRACTOR FUEL BALANCES (3 TRACTORS) */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Fuel size={20} color="var(--primary)" />
                Tractor Fuel Status
            </h3>
            <p className="card-subtitle">Real-time tank levels for all 3 fleet vehicles</p>
          </div>

          <button
            onClick={() => onNavigate('diesel')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            Manage <ArrowUpRight size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {summary.tractorFuel.map((tf) => (
            <div
              key={tf.id}
              style={{
                backgroundColor: 'var(--bg-hover)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <FuelProgress currentLitres={tf.remainingFuel} maxTankLitres={45} label={tf.name} />
            </div>
          ))}
        </div>
      </Card>

      {/* RECENT ACTIVITIES FEED */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 className="card-title">Recent Activity Feed</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real-time updates</span>
          </div>

          <button
            id="export-csv-btn"
            type="button"
            onClick={async () => {
              const data = summary.recentActivities.map((act) => ({
                Type: act.type.toUpperCase(),
                Date: formatDate(act.date),
                Title: act.title,
                Details: act.subtitle,
                Amount: act.amountOrQuantity,
              }));

              await exportCSV(data);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: 'transparent',
              color: 'var(--primary)',
              border: '1.5px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>

        {summary.recentActivities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            No recent operations recorded yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.recentActivities.map((act) => {
              let Icon = Clock;
              let iconColor = 'var(--text-muted)';
              let bgIcon = 'var(--bg-hover)';

              if (act.type === 'service') {
                Icon = CheckCircle2;
                iconColor = 'var(--primary)';
                bgIcon = 'var(--primary-light)';
              } else if (act.type === 'payment') {
                Icon = CreditCard;
                iconColor = '#0284c7';
                bgIcon = '#e0f2fe';
              } else if (act.type === 'diesel') {
                Icon = Fuel;
                iconColor = 'var(--accent)';
                bgIcon = 'var(--accent-light)';
              }

              return (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ padding: 8, borderRadius: 8, backgroundColor: bgIcon, color: iconColor }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                        {act.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {act.subtitle} • {formatDate(act.date)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                      {act.amountOrQuantity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};
