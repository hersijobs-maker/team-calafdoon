// Detect Capacitor native runtime BEFORE anything else mounts, so
// routing picks the mobile UI on first paint.
import { Capacitor } from '@capacitor/core';

let isNative = false;
try {
  isNative = Capacitor.isNativePlatform();
} catch {
  isNative = false;
}
if (typeof window !== 'undefined' && isNative) {
  document.documentElement.setAttribute('data-native', 'true');
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker, subscribeToPush } from './lib/notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Remove the HTML loading splash once React has taken over the page.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('app-loading');
    if (splash) splash.remove();
  });
});

// Inside the APK, kill any service worker registered by an older app
// version: its stale cache can serve deleted asset files and leave a
// permanently blank white screen after an APK update.
if (isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister().catch(() => {});
  }).catch(() => {});
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) caches.delete(key).catch(() => {});
    }).catch(() => {});
  }
}

// Service worker + web push are for the WEBSITE only. Inside the APK the
// WebView runs on https://localhost; a stale service worker there serves
// outdated cached assets after updates and can leave a blank white screen.
// Native apps use Capacitor local notifications instead.
if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().then((reg) => {
      if (!reg) return;
      if (Notification.permission === 'granted') {
        subscribeToPush().catch(() => {});
      }
    }).catch(() => {});
  });
}
