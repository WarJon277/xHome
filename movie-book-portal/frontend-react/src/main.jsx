import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register SW in prompt mode — do NOT auto-reload the page
// Updates will be applied on next app restart/navigation
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[SW] Update available. Will apply on next app restart.');
    // Do NOT call updateSW() here — that would reload during reading
  },
  onOfflineReady() {
    console.log('[SW] App ready to work offline.');
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
