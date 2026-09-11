// ========================================================
// Tractor Diesel History Module
// ========================================================

import React, { useState, useEffect } from 'react';
import type { Tractor, DieselTransaction } from '../types';
import { getTractors, getDieselTransactions, subscribeToChanges } from '../lib/storage';
import { formatLitres, formatHours, formatDate, formatCurrency } from '../utils/formatters';
import { Card, Select, EmptyState } from '../components/common';
import { Fuel, ArrowLeft, Calendar } from 'lucide-react';

interface DieselHistoryProps {
  onBack: () => void;
}

export const DieselHistory: React.FC<DieselHistoryProps> = ({ onBack }) => {
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [records, setRecords] = useState<DieselTransaction[]>([]);
  const [filterTractor, setFilterTractor] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
    const unsubscribe = subscribeToChanges((table) => {
      if (['diesel_transactions', 'tractors', 'all'].includes(table)) {
        loadHistory();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const [tracList, dtxList] = await Promise.all([
      getTractors(),
      getDieselTransactions(),
    ]);
    setTractors(tracList);
    setRecords(dtxList);
    setLoading(false);
  };

  const filteredRecords = records.filter((r) => {
    if (filterTractor === 'All') return true;
    return r.tractor_id === filterTractor;
  });

  return (
    <div className="page-container">
      {/* Back Button */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ArrowLeft size={18} />
        <span>Back to Diesel Calculator</span>
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Fuel color="var(--primary)" size={24} />
            Diesel Log History
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Historical fuel usage & working shifts by tractor
          </p>
        </div>
      </div>

      {/* Filter by Tractor */}
      <div style={{ marginBottom: 16 }}>
        <Select
          label="Filter by Tractor"
          options={[
            { value: 'All', label: 'All Tractors' },
            ...tractors.map((t) => ({ value: t.id, label: t.name })),
          ]}
          value={filterTractor}
          onChange={(e) => setFilterTractor(e.target.value)}
        />
      </div>

      {/* Records List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          Loading diesel log records...
        </div>
      ) : filteredRecords.length === 0 ? (
        <EmptyState
          icon={<Fuel size={48} />}
          title="No diesel history found"
          description="Record diesel usage in the Tractor Diesel Calculator to view logs here"
          actionText="Go to Diesel Calculator"
          onAction={onBack}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredRecords.map((rec) => (
            <Card key={rec.id} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                    {rec.tractor?.name || 'Tractor'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    <Calendar size={13} />
                    <span>{formatDate(rec.transaction_date)}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'Outfit, sans-serif' }}>
                    -{formatLitres(rec.diesel_consumed)}
                  </span>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
                    {formatLitres(rec.remaining_fuel)} left
                  </div>
                </div>
              </div>

              {/* Data metrics grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginTop: 12,
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-hover)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>STARTING</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {formatLitres(rec.initial_fuel_litres)}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>WORK TIME</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {formatHours(rec.total_working_hours)}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MODE</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize', marginTop: 2 }}>
                    {rec.input_mode}
                    {rec.input_mode === 'amount' && rec.diesel_amount ? ` (${formatCurrency(rec.diesel_amount)})` : ''}
                  </div>
                </div>
              </div>

              {rec.notes && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                  Note: {rec.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
