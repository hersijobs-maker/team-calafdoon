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

// Register service worker for push notifications (non-blocking)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().then((reg) => {
      if (!reg) return;
      // Attempt to subscribe to push if permission already granted
      if (Notification.permission === 'granted') {
        subscribeToPush().catch(() => {});
      }
    });
  });
}

// Detect Capacitor native runtime and mark it for the app
if (typeof window !== 'undefined') {
  const nativeBridge = (window as unknown as { Capacitor?: { isNative?: boolean; getPlatform?: () => string } }).Capacitor;
  if (nativeBridge?.isNative || nativeBridge?.getPlatform?.() === 'android' || nativeBridge?.getPlatform?.() === 'ios') {
    document.documentElement.setAttribute('data-native', 'true');
  }
}
