import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

import ErrorBoundary from './components/ErrorBoundary.jsx'

// Register SW in prompt mode — do NOT auto-reload the page
// Updates will be applied on next app restart/navigation
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[SW] Update available. Will apply on next app restart.');
    // Store flag in localStorage for PWACacheStatus component
    localStorage.setItem('sw-update-available', 'true');
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent('sw-update-available'));
    // Do NOT call updateSW() here — that would reload during reading
  },
  onOfflineReady() {
    console.log('[SW] App ready to work offline.');
    localStorage.setItem('sw-offline-ready', 'true');
    window.dispatchEvent(new CustomEvent('sw-offline-ready'));
  },
  onRegistered(registration) {
    console.log('[SW] Registered:', registration);
    // Check for updates periodically (every 10 minutes)
    setInterval(() => {
      if (registration.active) {
        registration.update().then(() => {
          console.log('[SW] Checked for updates');
        }).catch(err => {
          console.warn('[SW] Update check failed:', err);
        });
      }
    }, 10 * 60 * 1000); // 10 minutes
  },
  onRegisterError(error) {
    console.error('[SW] Registration error:', error);
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
