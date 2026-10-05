import { supabase } from './supabase';

const SW_PATH = '/sw.js';
const VAPID_KEY_SETTING = 'vapid_public_key';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getVapidPublicKey(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', VAPID_KEY_SETTING)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { value: string }).value || null;
}

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    return reg;
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  const supported = await isPushSupported();
  if (!supported) return null;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return null;

  const reg = await registerServiceWorker();
  if (!reg) return null;

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) {
    console.warn('VAPID public key not configured — push notifications disabled');
    return null;
  }

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    } catch (err) {
      console.error('Push subscription failed:', err);
      return null;
    }
  }

  // Save subscription to database
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const subData = subscription.toJSON();
  const p256dh = subData.keys?.p256dh;
  const auth = subData.keys?.auth;

  if (!p256dh || !auth || !subData.endpoint) return null;

  await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subData.endpoint,
      p256dh,
      auth,
    },
    { onConflict: 'user_id,endpoint' },
  );

  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await registerServiceWorker();
  if (!reg) return;

  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    const subData = subscription.toJSON();
    if (subData.endpoint) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subData.endpoint);
      }
    }
  }
}
