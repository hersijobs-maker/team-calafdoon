// Service Worker for TeamCalafdoon — Web Push Notifications for incoming calls

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push events — display call notification
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Wici soo dhacay', body: 'Qof kuu wiciayaa' };
  }

  const title = data.title || 'Wici soo dhacay';
  const body = data.body || 'Qof kuu wiciayaa...';
  const icon = data.icon || '/vite.svg';
  const badge = data.badge || '/vite.svg';
  const tag = data.tag || 'incoming-call';
  const requireInteraction = data.requireInteraction !== false;

  const options = {
    body,
    icon,
    badge,
    tag,
    requireInteraction,
    renotify: true,
    data: data.data || {},
    actions: [
      { action: 'answer', title: 'Aqbal' },
      { action: 'decline', title: 'Diidi' },
    ],
    vibrate: [200, 100, 200, 100, 200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const callData = event.notification.data || {};

  const targetUrl = callData.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Focus existing window if found
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({
            type: 'call_notification_action',
            action,
            callData,
          });
          try {
            await client.focus();
          } catch {
            // ignore
          }
          return;
        }
      }

      // Open new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

// Handle push subscription change (browser may expire/rotate keys)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      if (!event.newSubscription) return;
      // Notify the app about the new subscription so it can re-register
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({
          type: 'push_subscription_changed',
          subscription: event.newSubscription,
        });
      }
    })(),
  );
});
