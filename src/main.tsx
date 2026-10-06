import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker, subscribeToPush } from './lib/notifications';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for push notifications (non-blocking, web only)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().then((reg) => {
      if (!reg) return;
      if (Notification.permission === 'granted') {
        subscribeToPush().catch(() => {});
      }
    }).catch(() => {});
  });
}

// Detect Capacitor native runtime and mark it for the app.
// Must run before React mounts so routing picks the mobile UI on first paint.
import { Capacitor } from '@capacitor/core';

if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  document.documentElement.setAttribute('data-native', 'true');
}
