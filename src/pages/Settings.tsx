// ========================================================
// Settings & Rate Configuration Module
// ========================================================

import React, { useState, useEffect } from 'react';
import type { ServiceMaster, Tractor } from '../types';
import {
  getSettings,
  updateSetting,
  getServices,
  updateServiceRate,
  getTractors,
  updateTractorFuel,
  resetToDemoData,
} from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { formatLitres } from '../utils/formatters';
import { Button, Input, Card } from '../components/common';
import { Settings as SettingsIcon, Sun, Moon, LogOut, RotateCcw, Save } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const isCloud = isSupabaseConfigured();

  const [dieselPriceInput, setDieselPriceInput] = useState('100.50');
  const [consumptionRateInput, setConsumptionRateInput] = useState('4.0');
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [serviceRates, setServiceRates] = useState<Record<string, string>>({});
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [tractorFuelInputs, setTractorFuelInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    setLoading(true);
    const [cfg, srvList, tracList] = await Promise.all([
      getSettings(),
      getServices(),
      getTractors(),
    ]);

    setDieselPriceInput(String(cfg.diesel_price));
    setConsumptionRateInput(String(cfg.diesel_consumption_rate));

    setServices(srvList);
    const rates: Record<string, string> = {};
    srvList.forEach((s) => {
      rates[s.id] = String(s.rate);
    });
    setServiceRates(rates);

    setTractors(tracList);
    const fuels: Record<string, string> = {};
    tracList.forEach((t) => {
      fuels[t.id] = String(t.current_fuel_litres);
    });
    setTractorFuelInputs(fuels);
    setLoading(false);
  };

  // Save General Fuel Settings
  const handleSaveFuelSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPrice = parseFloat(dieselPriceInput);
    const newRate = parseFloat(consumptionRateInput);

    if (isNaN(newPrice) || newPrice <= 0) {
      showToast('Please enter a valid diesel price', 'error');
      return;
    }
    if (isNaN(newRate) || newRate <= 0) {
      showToast('Please enter a valid consumption rate', 'error');
      return;
    }

    await updateSetting('diesel_price', newPrice);
    await updateSetting('diesel_consumption_rate', newRate);
    showToast('Diesel settings updated successfully!', 'success');
  };

  // Save Service Rate
  const handleSaveServiceRate = async (serviceId: string) => {
    const rateVal = parseFloat(serviceRates[serviceId]);
    if (isNaN(rateVal) || rateVal <= 0) {
      showToast('Please enter a valid rate', 'error');
      return;
    }
    await updateServiceRate(serviceId, rateVal);
    showToast('Service rate updated!', 'success');
  };

  // Save Tractor Fuel Calibration
  const handleSaveTractorFuel = async (tracId: string) => {
    const fuelVal = parseFloat(tractorFuelInputs[tracId]);
    if (isNaN(fuelVal) || fuelVal < 0) {
      showToast('Please enter a valid fuel litres', 'error');
      return;
    }
    await updateTractorFuel(tracId, fuelVal);
    showToast('Tractor fuel tank calibrated!', 'success');
  };

  const handleResetData = () => {
    if (window.confirm('Reset all demo data to factory defaults? All newly added customers, services, and diesel entries will be restored to initial values.')) {
      resetToDemoData();
      showToast('Demo data reset to factory initial state', 'info');
      loadSettingsData();
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingsIcon color="var(--primary)" size={24} />
            Application Settings
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Configure rates, fleet tank levels & preferences
          </p>
        </div>
      </div>

      {/* DIESEL CONFIGURATION CARD */}
      <Card>
        <h3 className="card-title">Diesel Calculation Configuration</h3>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          Default price per litre and consumption rate (1 hr = 4 L)
        </p>

        <form onSubmit={handleSaveFuelSettings}>
          <div className="grid-2">
            <Input
              label="Current Diesel Price (₹/Litre)"
              subLabel="டீசல் விலை"
              type="number"
              step="0.10"
              min="1"
              prefix="₹"
              suffix="/ Litre"
              value={dieselPriceInput}
              onChange={(e) => setDieselPriceInput(e.target.value)}
              required
            />

            <Input
              label="Fuel Consumption Rate"
              subLabel="ஒரு மணி நேரத்திற்கு"
              type="number"
              step="0.1"
              min="0.5"
              suffix="L / hour"
              value={consumptionRateInput}
              onChange={(e) => setConsumptionRateInput(e.target.value)}
              required
            />
          </div>

          <Button type="submit" variant="primary" icon={<Save size={16} />}>
            Save Fuel Settings
          </Button>
        </form>
      </Card>

      {/* TRACTOR FLEET FUEL CALIBRATION */}
      <Card>
        <h3 className="card-title">Tractor Tank Fuel Calibration</h3>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          Manually adjust current tank level when refueled outside the app
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tractors.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-hover)',
                borderRadius: 'var(--radius-md)',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Current: {formatLitres(t.current_fuel_litres)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-input"
                  style={{ width: '100px', minHeight: '38px', padding: '6px 10px', fontSize: '14px' }}
                  value={tractorFuelInputs[t.id] || ''}
                  onChange={(e) =>
                    setTractorFuelInputs((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                />
                <Button
                  variant="secondary"
                  style={{ minHeight: '38px', padding: '6px 12px', fontSize: '13px' }}
                  onClick={() => handleSaveTractorFuel(t.id)}
                >
                  Update
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SERVICE MASTER RATES */}
      <Card>
        <h3 className="card-title">Service Master Rates</h3>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          Update default charges per hour or per load
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {services.map((srv) => (
            <div
              key={srv.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-hover)',
                borderRadius: 'var(--radius-md)',
                gap: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                  {srv.name}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Charged per {srv.unit}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  step="50"
                  min="0"
                  className="form-input"
                  style={{ width: '100px', minHeight: '38px', padding: '6px 10px', fontSize: '14px' }}
                  value={serviceRates[srv.id] || ''}
                  onChange={(e) =>
                    setServiceRates((prev) => ({ ...prev, [srv.id]: e.target.value }))
                  }
                />
                <Button
                  variant="secondary"
                  style={{ minHeight: '38px', padding: '6px 12px', fontSize: '13px' }}
                  onClick={() => handleSaveServiceRate(srv.id)}
                >
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* THEME & SYSTEM PREFERENCES */}
      <Card>
        <h3 className="card-title">System Preferences</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>
              Appearance Theme
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Currently in {theme === 'dark' ? 'Dark' : 'Light'} Mode
            </div>
          </div>

          <Button variant="secondary" onClick={toggleTheme} icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}>
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 14, paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>
                Database Status
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {isCloud ? 'Supabase PostgreSQL connected' : 'Local Offline-Ready storage'}
              </div>
            </div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isCloud ? '#15803d' : '#b45309',
                backgroundColor: isCloud ? '#dcfce7' : '#fef3c7',
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {isCloud ? 'Online / Realtime' : 'Local Mode'}
            </span>
          </div>
        </div>
      </Card>

      {/* USER ACCOUNT & DEMO RESET */}
      <Card>
        <h3 className="card-title">User Account</h3>
        {user && (
          <div style={{ margin: '10px 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
            Signed in as: <strong style={{ color: 'var(--text-main)' }}>{user.name}</strong> ({user.email})
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="danger" onClick={() => logout()} icon={<LogOut size={16} />}>
            Sign Out
          </Button>

          <Button variant="outline" onClick={handleResetData} icon={<RotateCcw size={16} />}>
            Reset Demo Data
          </Button>
        </div>
      </Card>
    </div>
  );
};
