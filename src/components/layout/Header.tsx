// ========================================================
// Top Application Header
// ========================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, LogOut } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMoreClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, marginRight: 12 }}>
        {/* Tractor SVG Brand Icon (Shown on mobile/tablet) */}
        <div
          className="header-brand-icon"
          style={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 6px rgba(21, 128, 61, 0.3)',
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0"/>
            <path d="M14 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0"/>
            <path d="M6 14h6v-4H8a2 2 0 0 1-2-2V7"/>
            <path d="M18 9v-2a2 2 0 0 0-2-2h-3l-2 3"/>
            <path d="M14 14V9"/>
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1, padding: '2px 0' }}>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
              padding: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 2,
                marginRight: 0,
                marginBottom: 0,
                marginLeft: 0,
                lineHeight: 1.3,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {user && (
          <>
            <div
              className="header-user-badge"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-hover)',
                border: '1px solid var(--border-color)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={user.email}
            >
              {user.email || user.name}
            </div>

            <button
              onClick={() => logout()}
              title="Log Out"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                flexShrink: 0,
              }}
            >
              <LogOut size={18} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
