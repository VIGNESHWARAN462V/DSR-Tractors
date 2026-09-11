// ========================================================
// Login Screen — DSR TRACTORS
// Re-exports the unified Auth component with full Supabase Email Auth
// ========================================================

import React from 'react';
import { Auth, type AuthMode } from './Auth';

export const Login: React.FC<{ initialMode?: AuthMode }> = ({ initialMode = 'login' }) => {
  return <Auth initialMode={initialMode} />;
};

export { Auth };
