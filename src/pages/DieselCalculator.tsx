// ========================================================
// Section 3 — Tractor Diesel Calculator
// ========================================================

import React, { useState, useEffect } from 'react';
import type { Tractor, DieselTransaction } from '../types';
import {
  getTractors,
  getSettings,
  createDieselTransaction,
  getDieselTransactions,
  subscribeToChanges,
} from '../lib/storage';
import {
  calculateDieselLitresFromAmount,
  calculateTotalWorkingHours,
  calculateDieselConsumed,
  calculateRemainingFuel,
} from '../utils/calculator';
import { formatCurrency, formatLitres, formatHours, formatDate } from '../utils/formatters';
import { Button, Input, Card, FuelProgress } from '../components/common';
import { useToast } from '../context/ToastContext';
import {
  Fuel,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  History,
} from 'lucide-react';

export const DieselCalculator: React.FC<{ onGoToHistory?: () => void }> = ({ onGoToHistory }) => {
  const { showToast } = useToast();

  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [selectedTractorId, setSelectedTractorId] = useState<string>('');
  const [dieselPrice, setDieselPrice] = useState<number>(100.50);
  const [consumptionRate, setConsumptionRate] = useState<number>(4.0);

  // Input Mode: 'amount' | 'litres'
  const [inputMode, setInputMode] = useState<'amount' | 'litres'>('amount');
  const [dieselRupees, setDieselRupees] = useState<string>('3000');
  const [directLitres, setDirectLitres] = useState<string>('30.11');

  // Working Timings list
  const [timings, setTimings] = useState<string[]>(['1.25', '1.25']);

  const [transactionDate, setTransactionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Recent diesel records preview
  const [recentRecords, setRecentRecords] = useState<DieselTransaction[]>([]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges((table) => {
      if (['tractors', 'diesel_transactions', 'settings', 'all'].includes(table)) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    const [tracList, settings, historyList] = await Promise.all([
      getTractors(),
      getSettings(),
      getDieselTransactions(),
    ]);

    setTractors(tracList);
    if (tracList.length > 0 && !selectedTractorId) {
      setSelectedTractorId(tracList[0].id);
      // Preload current tank fuel into direct litres
      setDirectLitres(String(tracList[0].current_fuel_litres || 30.11));
    }
    setDieselPrice(settings.diesel_price || 100.50);
    setConsumptionRate(settings.diesel_consumption_rate || 4.0);
    setRecentRecords(historyList.slice(0, 4));
  };

  const selectedTractor = tractors.find((t) => t.id === selectedTractorId) || tractors[0];

  // 1. Calculate Starting Fuel Litres based on Input Mode
  let startingFuelLitres = 0;
  if (inputMode === 'amount') {
    const amountVal = parseFloat(dieselRupees) || 0;
    startingFuelLitres = calculateDieselLitresFromAmount(amountVal, dieselPrice);
  } else {
    startingFuelLitres = parseFloat(directLitres) || 0;
  }

  // 2. Calculate Total Working Hours
  const timingNumbers = timings.map((t) => parseFloat(t) || 0);
  const totalWorkingHours = calculateTotalWorkingHours(timingNumbers);

  // 3. Calculate Diesel Consumed: Hours × 4 L/hr
  const dieselConsumed = calculateDieselConsumed(totalWorkingHours, consumptionRate);

  // 4. Calculate Remaining Fuel in Tank
  const { remainingFuel, isInsufficient } = calculateRemainingFuel(startingFuelLitres, dieselConsumed);

  // Add / Remove Timings
  const handleAddTiming = () => {
    setTimings((prev) => [...prev, '1.00']);
  };

  const handleUpdateTiming = (index: number, val: string) => {
    setTimings((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveTiming = (index: number) => {
    if (timings.length <= 1) {
      showToast('At least one timing entry is required', 'error');
      return;
    }
    setTimings((prev) => prev.filter((_, i) => i !== index));
  };

  // Tractor selection change: optionally update initial litres
  const handleSelectTractor = (tracId: string) => {
    setSelectedTractorId(tracId);
    const chosen = tractors.find((t) => t.id === tracId);
    if (chosen && inputMode === 'litres') {
      setDirectLitres(String(chosen.current_fuel_litres));
    }
  };

  // Save Diesel Transaction
  const handleSaveTransaction = async () => {
    if (!selectedTractor) {
      showToast('Please select a tractor', 'error');
      return;
    }

    if (startingFuelLitres <= 0) {
      showToast('Starting fuel must be greater than 0 litres', 'error');
      return;
    }

    if (totalWorkingHours <= 0) {
      showToast('Total working hours must be greater than 0', 'error');
      return;
    }

    if (isInsufficient) {
      showToast('INSUFFICIENT DIESEL: Working hours consumption exceeds fuel in tank!', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await createDieselTransaction(
        {
          tractor_id: selectedTractor.id,
          input_mode: inputMode,
          diesel_amount: inputMode === 'amount' ? parseFloat(dieselRupees) : undefined,
          diesel_price: dieselPrice,
          initial_fuel_litres: startingFuelLitres,
          total_working_hours: totalWorkingHours,
          consumption_rate: consumptionRate,
          diesel_consumed: dieselConsumed,
          remaining_fuel: remainingFuel,
          transaction_date: transactionDate,
          notes: notes.trim() || undefined,
          created_by: 'Staff',
        },
        timingNumbers.map((th) => ({ timing_hours: th }))
      );

      showToast(`Saved diesel entry for ${selectedTractor.name}! Remaining: ${formatLitres(remainingFuel)}`, 'success');

      // Update directLitres to the new remaining balance
      setDirectLitres(String(remainingFuel));
      setNotes('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error saving diesel transaction', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Fuel color="var(--primary)" size={24} />
            Tractor Diesel Calculator
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Section 3 — Fuel consumption & multi-tractor tank tracking
          </p>
        </div>

        {onGoToHistory && (
          <Button variant="secondary" onClick={onGoToHistory} icon={<History size={16} />}>
            History
          </Button>
        )}
      </div>

      {/* TRACTOR SELECTOR */}
      <Card>
        <label className="form-label" style={{ marginBottom: 8 }}>
          Select Tractor (வாகனம் தேர்வு)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {tractors.map((t) => {
            const isSelected = selectedTractor?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTractor(t.id)}
                style={{
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                  backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{t.name}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {t.current_fuel_litres.toFixed(1)} L in tank
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* FUEL INPUT MODE CARD */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="card-title">Fuel Input</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Diesel Price: <strong>{formatCurrency(dieselPrice)}/L</strong>
          </div>
        </div>

        {/* Mode Selector Radio Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setInputMode('amount')}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${inputMode === 'amount' ? 'var(--primary)' : 'var(--border-color)'}`,
              backgroundColor: inputMode === 'amount' ? 'var(--primary-light)' : 'var(--bg-surface)',
              color: inputMode === 'amount' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ( ) Enter Amount (₹)
            <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>Auto-calculate litres</div>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('litres')}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${inputMode === 'litres' ? 'var(--primary)' : 'var(--border-color)'}`,
              backgroundColor: inputMode === 'litres' ? 'var(--primary-light)' : 'var(--bg-surface)',
              color: inputMode === 'litres' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ( ) Enter Litres (L)
            <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>Direct fuel in tank</div>
          </button>
        </div>

        {/* Amount Mode Fields */}
        {inputMode === 'amount' ? (
          <div className="grid-2" style={{ alignItems: 'flex-end' }}>
            <Input
              label="Diesel Amount (₹)"
              subLabel="டீசல் பணம்"
              type="number"
              step="50"
              min="0"
              prefix="₹"
              placeholder="e.g. 3000"
              inputMode="decimal"
              className="large-number"
              value={dieselRupees}
              onChange={(e) => setDieselRupees(e.target.value)}
            />

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Calculated Fuel Litres</span>
                <span className="tamil-sub">Amount ÷ {formatCurrency(dieselPrice)}</span>
              </label>
              <div
                style={{
                  minHeight: 48,
                  padding: '8px 14px',
                  backgroundColor: 'var(--primary-light)',
                  border: '1.5px solid var(--primary-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Fuel Available:</span>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>
                  {formatLitres(startingFuelLitres)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Litre Mode Field */
          <div className="form-group">
            <Input
              label="Fuel Available in Tank (Litres)"
              subLabel="தொட்டியில் உள்ள டீசல்"
              type="number"
              step="0.05"
              min="0"
              suffix="Litres"
              placeholder="e.g. 30.11"
              inputMode="decimal"
              className="large-number"
              value={directLitres}
              onChange={(e) => setDirectLitres(e.target.value)}
            />
          </div>
        )}
      </Card>

      {/* WORKING TIMINGS CARD */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 className="card-title">Working Timings</h3>
            <p className="card-subtitle">Add tractor work shifts (1 hour = 4 Litres)</p>
          </div>

          <Button variant="secondary" onClick={handleAddTiming} icon={<Plus size={16} />}>
            + Add Timing
          </Button>
        </div>

        {/* Timings entries list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timings.map((timeVal, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Input
                  label={idx === 0 ? 'Timing Entry (Hours)' : undefined}
                  type="number"
                  step="0.25"
                  min="0.1"
                  suffix="hours"
                  inputMode="decimal"
                  placeholder="e.g. 1.25"
                  value={timeVal}
                  onChange={(e) => handleUpdateTiming(idx, e.target.value)}
                />
              </div>

              {timings.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveTiming(idx)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    padding: 8,
                    marginTop: idx === 0 ? 20 : 0,
                  }}
                  title="Remove timing"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Timings Summary Row */}
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            backgroundColor: 'var(--bg-hover)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL WORKING HOURS</span>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {formatHours(totalWorkingHours)}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>DIESEL CONSUMED (×4L)</span>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
              {formatLitres(dieselConsumed)}
            </div>
          </div>
        </div>
      </Card>

      {/* REMAINING FUEL & TANK STATUS CARD */}
      <Card style={{ borderColor: isInsufficient ? 'var(--danger)' : 'var(--primary-border)' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Fuel size={20} color={isInsufficient ? 'var(--danger)' : 'var(--primary)'} />
          Tank Balance Calculation
        </h3>

        {/* Calculation summary pill */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>
          <span>Starting Fuel: <strong>{formatLitres(startingFuelLitres)}</strong></span>
          <span>Consumed: <strong>-{formatLitres(dieselConsumed)}</strong></span>
        </div>

        {/* Visual Progress Bar */}
        <FuelProgress currentLitres={remainingFuel} maxTankLitres={45} label={`${selectedTractor?.name} Tank Level`} />

        {/* INSUFFICIENT DIESEL ALERT or REMAINING BANNER */}
        {isInsufficient ? (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--danger-light)',
              border: '2px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger-text)',
              textAlign: 'center',
              margin: '12px 0',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 800, letterSpacing: '0.04em' }}>
              <AlertTriangle size={22} color="var(--danger)" />
              INSUFFICIENT DIESEL
            </div>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Working time requires <strong>{formatLitres(dieselConsumed)}</strong>, but only <strong>{formatLitres(startingFuelLitres)}</strong> is available in tank.
            </p>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--primary-light)',
              border: '2px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              margin: '12px 0',
            }}
          >
            <div
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: 32,
                fontWeight: 800,
                color: 'var(--primary)',
                lineHeight: 1.1,
              }}
            >
              {formatLitres(remainingFuel)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.05em', marginTop: 4 }}>
              REMAINING IN TANK
            </div>
          </div>
        )}

        {/* Transaction Date & Notes */}
        <div className="grid-2" style={{ marginTop: 12 }}>
          <Input
            label="Transaction Date"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />

          <Input
            label="Notes (Optional)"
            placeholder="Field location or driver name"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button
          variant="primary"
          fullWidth
          disabled={isInsufficient || totalWorkingHours <= 0 || startingFuelLitres <= 0}
          isLoading={isSaving}
          onClick={handleSaveTransaction}
          icon={<Check size={20} />}
          style={{ height: 52, fontSize: 16, marginTop: 8 }}
        >
          Save Diesel Entry ({selectedTractor?.name})
        </Button>
      </Card>

      {/* RECENT DIESEL TRANSACTIONS LIST */}
      {recentRecords.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              Recent Fuel Records
            </h4>
            {onGoToHistory && (
              <button
                onClick={onGoToHistory}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                View All
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentRecords.map((rec) => (
              <Card key={rec.id} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                      {rec.tractor?.name || 'Tractor'}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {formatDate(rec.transaction_date)} • {rec.total_working_hours} hr work
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                      -{formatLitres(rec.diesel_consumed)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                      {formatLitres(rec.remaining_fuel)} left
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
