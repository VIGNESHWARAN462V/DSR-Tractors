// ========================================================
// Reports & CSV Export Module
// ========================================================

import React, { useState, useEffect } from 'react';
import type { ServiceTransaction, Payment, DieselTransaction } from '../types';
import {
  getServiceTransactions,
  getPayments,
  getDieselTransactions,
} from '../lib/storage';
import { formatCurrency, formatLitres, formatHours } from '../utils/formatters';
import { Card, Button } from '../components/common';
import { useToast } from '../context/ToastContext';
import { BarChart3, Download } from 'lucide-react';

export const Reports: React.FC = () => {
  const { showToast } = useToast();

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month'>('all');
  const [services, setServices] = useState<ServiceTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dieselList, setDieselList] = useState<DieselTransaction[]>([]);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    const [txs, pays, diesel] = await Promise.all([
      getServiceTransactions(),
      getPayments(),
      getDieselTransactions(),
    ]);

    setServices(txs);
    setPayments(pays);
    setDieselList(diesel);
  };

  // Filter datasets based on selected time window
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // 'YYYY-MM'

  const filteredServices = services.filter((s) => {
    if (dateFilter === 'today') return s.service_date === todayStr;
    if (dateFilter === 'month') return s.service_date.startsWith(currentMonthStr);
    return true;
  });

  const filteredPayments = payments.filter((p) => {
    if (dateFilter === 'today') return p.payment_date === todayStr;
    if (dateFilter === 'month') return p.payment_date.startsWith(currentMonthStr);
    return true;
  });

  const filteredDiesel = dieselList.filter((d) => {
    if (dateFilter === 'today') return d.transaction_date === todayStr;
    if (dateFilter === 'month') return d.transaction_date.startsWith(currentMonthStr);
    return true;
  });

  // Calculate Aggregates
  const totalRevenue = filteredServices.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  const totalReceived = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalDieselConsumed = filteredDiesel.reduce((sum, d) => sum + (Number(d.diesel_consumed) || 0), 0);
  const totalWorkHours = filteredDiesel.reduce((sum, d) => sum + (Number(d.total_working_hours) || 0), 0);

  // Service Breakdown Map
  const serviceStatsMap: Record<string, { count: number; quantity: number; amount: number; unit: string }> = {};
  filteredServices.forEach((s) => {
    s.items?.forEach((item) => {
      const name = item.service_name + (item.worker_type ? ` (${item.worker_type})` : '');
      if (!serviceStatsMap[name]) {
        serviceStatsMap[name] = { count: 0, quantity: 0, amount: 0, unit: item.unit };
      }
      serviceStatsMap[name].count += 1;
      serviceStatsMap[name].quantity += Number(item.quantity) || 0;
      serviceStatsMap[name].amount += Number(item.amount) || 0;
    });
  });

  // Generate CSV rows
  const generateCsvContent = (): { content: string; filename: string } => {
    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = ['Type', 'Date', 'Entity / Customer', 'Details', 'Quantity / Hours', 'Amount (INR)', 'Diesel (Litres)'];
    const csvRows: string[] = [headers.map(escapeCsv).join(',')];

    filteredServices.forEach((s) => {
      const details = s.items?.map((i) => `${i.service_name} (${i.quantity} ${i.unit})`).join('; ') || 'Services';
      const qtySummary = s.items?.map((i) => `${i.quantity} ${i.unit}`).join(', ') || '';
      csvRows.push([
        escapeCsv('Service'),
        escapeCsv(s.service_date),
        escapeCsv(s.customer?.name || 'Customer'),
        escapeCsv(details),
        escapeCsv(qtySummary),
        escapeCsv(s.total_amount),
        escapeCsv(''),
      ].join(','));
    });

    filteredPayments.forEach((p) => {
      csvRows.push([
        escapeCsv('Payment'),
        escapeCsv(p.payment_date),
        escapeCsv(p.customer?.name || 'Customer'),
        escapeCsv(`Payment via ${p.payment_method}${p.notes ? ` - ${p.notes}` : ''}`),
        escapeCsv(''),
        escapeCsv(p.amount),
        escapeCsv(''),
      ].join(','));
    });

    filteredDiesel.forEach((d) => {
      const details = d.input_mode === 'amount'
        ? `Rs. ${d.diesel_amount} at Rs. ${d.diesel_price}/L`
        : `${d.initial_fuel_litres}L in tank`;
      csvRows.push([
        escapeCsv('Diesel'),
        escapeCsv(d.transaction_date),
        escapeCsv(d.tractor?.name || 'Tractor'),
        escapeCsv(details),
        escapeCsv(`${d.total_working_hours} hr`),
        escapeCsv(d.diesel_amount || ''),
        escapeCsv(d.diesel_consumed),
      ].join(','));
    });

    const filename = `DSR_Tractors_Report_${dateFilter}_${todayStr}.csv`;
    return { content: csvRows.join('\r\n'), filename };
  };

  // CSV Export via dynamic Blob and URL.createObjectURL()
  const handleExportCSV = () => {
    try {
      const { content, filename } = generateCsvContent();
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', downloadUrl);
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
      showToast(`Exported ${filename} successfully!`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export CSV', 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 color="var(--primary)" size={24} />
            Business Reports
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Financial statements, diesel logs & CSV downloads
          </p>
        </div>

        <Button variant="primary" onClick={handleExportCSV} icon={<Download size={16} />}>
          Export CSV
        </Button>
      </div>

      {/* Date Filter Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {(['all', 'month', 'today'] as const).map((filter) => {
          const isSelected = dateFilter === filter;
          const label = filter === 'all' ? 'All Time' : filter === 'month' ? 'This Month' : 'Today';
          return (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Overview Totals Grid */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card>
          <span className="stat-label">TOTAL SERVICE REVENUE</span>
          <div className="stat-number" style={{ color: 'var(--primary)', marginTop: 4 }}>
            {formatCurrency(totalRevenue)}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            From {filteredServices.length} service orders
          </span>
        </Card>

        <Card>
          <span className="stat-label">TOTAL PAYMENTS COLLECTED</span>
          <div className="stat-number" style={{ color: '#0284c7', marginTop: 4 }}>
            {formatCurrency(totalReceived)}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            From {filteredPayments.length} receipts
          </span>
        </Card>

        <Card>
          <span className="stat-label">DIESEL CONSUMED</span>
          <div className="stat-number" style={{ color: 'var(--accent)', marginTop: 4 }}>
            {formatLitres(totalDieselConsumed)}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Based on 4 L / working hour
          </span>
        </Card>

        <Card>
          <span className="stat-label">TOTAL TRACTOR WORKING HOURS</span>
          <div className="stat-number" style={{ color: 'var(--text-main)', marginTop: 4 }}>
            {formatHours(totalWorkHours)}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Total fleet machine operational hours
          </span>
        </Card>
      </div>

      {/* Services Breakdown Table */}
      <Card style={{ marginBottom: 16 }}>
        <h3 className="card-title">Machinery Revenue Breakdown</h3>
        <p className="card-subtitle" style={{ marginBottom: 12 }}>Earnings categorized by implement</p>

        {Object.keys(serviceStatsMap).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
            No service records for this period
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(serviceStatsMap).map(([name, data]) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-hover)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {data.quantity} {data.unit}s ({data.count} bookings)
                  </div>
                </div>

                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                  {formatCurrency(data.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
