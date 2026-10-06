// Service Worker for Team Calafdoon — Web Push Notifications
// Handles: incoming call notifications, chat message notifications with inline reply

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ============================================================
// PUSH EVENT — display notification
// ============================================================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Ogeysiis', body: 'Fariin cusub' };
  }

  const notificationType = (data.data && data.data.type) || 'call';
  const title = data.title || 'Ogeysiis';
  const body = data.body || '';
  const icon = data.icon || '/icon-192.png';
  const badge = data.badge || '/icon-192.png';
  const tag = data.tag || 'notification';
  const requireInteraction = data.requireInteraction !== false;
  const vibrate = data.vibrate || [100, 50, 100];

  let options;

  if (notificationType === 'chat_message') {
    // Chat message notification with inline reply
    options = {
      body,
      icon,
      badge,
      tag,
      renotify: data.renotify !== false,
      requireInteraction: false,
      data: data.data || {},
      actions: [
        { action: 'reply', title: 'Jawaab' },
        { action: 'view', title: 'Eeg' },
      ],
      vibrate,
    };
  } else {
    // Call notification (existing behavior)
    options = {
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
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================
// NOTIFICATION CLICK — focus or open the app
// ============================================================
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notifData = event.notification.data || {};

  // Handle inline reply action (Android fires notificationclick with action='reply')
  if (action === 'reply') {
    const reply = event.reply || '';
    if (reply.trim() && notifData.type === 'chat_message') {
      event.waitUntil(
        (async () => {
          const allClients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
          });

          for (const client of allClients) {
            if (client.url.includes(self.location.origin)) {
              client.postMessage({
                type: 'notification_reply',
                reply: reply.trim(),
                conversation_id: notifData.conversation_id,
                sender_id: notifData.sender_id,
              });
              try { await client.focus(); } catch {}
              return;
            }
          }

          if (self.clients.openWindow) {
            const client = await self.clients.openWindow(notifData.url || '/chat');
            if (client) {
              setTimeout(() => {
                client.postMessage({
                  type: 'notification_reply',
                  reply: reply.trim(),
                  conversation_id: notifData.conversation_id,
                  sender_id: notifData.sender_id,
                });
              }, 3000);
            }
          }
        })(),
      );
    }
    event.notification.close();
    return;
  }

  event.notification.close();
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({
            type: 'notification_action',
            action,
            data: notifData,
          });
          try { await client.focus(); } catch {}
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

// ============================================================
// NOTIFICATION REPLY — fallback for browsers that fire this event
// (Android Chrome fires notificationclick with action='reply' instead)
// ============================================================
self.addEventListener('notificationreply', (event) => {
  const reply = event.reply;
  const notifData = event.notification.data || {};

  if (!reply || !reply.trim()) return;
  if (notifData.type !== 'chat_message') return;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({
            type: 'notification_reply',
            reply: reply.trim(),
            conversation_id: notifData.conversation_id,
            sender_id: notifData.sender_id,
          });
          try { await client.focus(); } catch {}
          return;
        }
      }

      if (self.clients.openWindow) {
        const client = await self.clients.openWindow(notifData.url || '/chat');
        if (client) {
          setTimeout(() => {
            client.postMessage({
              type: 'notification_reply',
              reply: reply.trim(),
              conversation_id: notifData.conversation_id,
              sender_id: notifData.sender_id,
            });
          }, 3000);
        }
      }
    })(),
  );
});

// ============================================================
// MESSAGE — handle messages from the app
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================================
// PUSH SUBSCRIPTION CHANGE
// ============================================================
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      if (!event.newSubscription) return;
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
