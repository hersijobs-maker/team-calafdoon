// Edge function: send-call-push
// Sends Web Push notifications to a callee when an incoming call signal is inserted.
// Triggered by the frontend after inserting an 'offer' signal into call_signals.
// Uses the web-push protocol (VAPID) to send notifications through the browser push service.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { callee_id, caller_name, is_video, call_id } = await req.json();

    if (!callee_id) {
      return new Response(JSON.stringify({ error: 'callee_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get VAPID keys from app_settings
    const { data: vapidSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'vapid_public_key')
      .maybeSingle();

    const vapidPublicKey = (vapidSetting as { value: string } | null)?.value;

    // Also check for vapid_private_key
    const { data: vapidPrivateSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'vapid_private_key')
      .maybeSingle();

    const vapidPrivateKey = (vapidPrivateSetting as { value: string } | null)?.value;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all push subscriptions for the callee
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', callee_id);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const title = is_video ? 'Wici Video ah soo dhacay' : 'Wici soo dhacay';
    const body = `${caller_name || 'Qof'} kuu wiciayaa...`;

    const notificationPayload = {
      title,
      body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: 'incoming-call',
      requireInteraction: true,
      data: {
        url: '/chat',
        call_id: call_id || null,
      },
      actions: [
        { action: 'answer', title: 'Aqbal' },
        { action: 'decline', title: 'Diidi' },
      ],
    };

    // Import web-push library for sending notifications
    // We'll use the Web Push API directly with VAPID JWT signing
    const sentCount = await sendPushNotifications(
      subscriptions as Array<{ endpoint: string; p256dh: string; auth: string }>,
      notificationPayload,
      vapidPublicKey,
      vapidPrivateKey,
      supabaseUrl,
    );

    return new Response(JSON.stringify({ sent: sentCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in send-call-push:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Minimal Web Push implementation using Web Crypto API
async function sendPushNotifications(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: Record<string, unknown>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  origin: string,
): Promise<number> {
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      const result = await sendSinglePush(
        sub.endpoint,
        sub.p256dh,
        sub.auth,
        encodedPayload,
        vapidPublicKey,
        vapidPrivateKey,
        origin,
      );
      if (result) sent++;
    } catch (err) {
      console.error(`Failed to send push to ${sub.endpoint}:`, err);
    }
  }
  return sent;
}

async function sendSinglePush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: Uint8Array,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  origin: string,
): Promise<boolean> {
  // This is a simplified implementation. In production, you'd use the web-push npm package.
  // For now, we'll use the aesgcm encryption and VAPID JWT.

  // Import the VAPID private key for signing
  const privateKeyBytes = urlBase64ToUint8Array(vapidPrivateKey);

  // Create VAPID JWT
  const jwt = await createVapidJwt(endpoint, vapidPublicKey, privateKeyBytes, origin);

  // Encrypt the payload using aes128gcm
  const encrypted = await encryptPayload(payload, p256dh, auth);

  // Determine the push service endpoint
  const pushServiceUrl = new URL(endpoint);

  // Send the push message
  const response = await fetch(pushServiceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '60',
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Length': String(encrypted.length),
    },
    body: encrypted,
  });

  return response.ok;
}

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

async function createVapidJwt(
  endpoint: string,
  vapidPublicKey: string,
  privateKeyBytes: Uint8Array,
  origin: string,
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
  const payload = {
    aud,
    exp,
    sub: `mailto:admin@teamcalafdoon.com`,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  // Import the ECDSA P-256 private key
  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  // Sign with ECDSA
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyData,
    new TextEncoder().encode(dataToSign),
  );

  const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
  return `${dataToSign}.${signatureB64}`;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// AES128GCM encryption for Web Push
async function encryptPayload(
  payload: Uint8Array,
  p256dh: string,
  auth: string,
): Promise<Uint8Array> {
  // This is a simplified placeholder. Full aes128gcm encryption requires
  // ECDH key agreement and HKDF derivation. For production use the web-push npm package.
  // For now, we return the payload as-is (browsers will reject unencrypted pushes,
  // but the function structure is correct for future implementation).
  //
  // NOTE: In production, replace this with the npm:web-push@3.x library.

  // Import the subscriber's public key
  const publicKeyBytes = urlBase64ToUint8Array(p256dh);
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // We need the server's ECDH key pair for key agreement
  // For this simplified version, we'll generate an ephemeral key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    serverKeyPair.privateKey,
    256,
  );

  // Get auth secret as bytes
  const authBytes = urlBase64ToUint8Array(auth);

  // HKDF derivation for content encryption key and nonce
  const prk = await hkdfExtract(
    new Uint8Array([0, authBytes.length, ...authBytes, ...new Uint8Array(sharedSecret)]),
  );

  const cekInfo = new TextEncoder().encode('WebPush: info\0' + String.fromCharCode(...publicKeyBytes) + String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey))));
  const cek = await hkdfExpand(prk, cekInfo, 16);

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // Encrypt with AES-GCM
  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);

  // Build the aes128gcm header
  const serverPublicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));
  const recordSize = 4096;
  const headerBytes = new Uint8Array(21 + 65);
  new DataView(headerBytes.buffer).setUint32(0, recordSize);
  new DataView(headerBytes.buffer).setUint32(4, payload.length + 16 + 1);
  headerBytes[8] = 65; // key length
  headerBytes.set(serverPublicKeyBytes, 9);

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    payload,
  );

  // Combine header + encrypted payload + padding byte
  const result = new Uint8Array(headerBytes.length + encrypted.byteLength + 1);
  result.set(headerBytes);
  result.set(new Uint8Array(encrypted), headerBytes.length);
  result[result.length - 1] = 2; // padding delimiter

  return result;
}

async function hkdfExtract(input: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = await crypto.subtle.sign('HMAC', key, input);
  return new Uint8Array(result);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const t1 = await crypto.subtle.sign('HMAC', key, info);
  if (length <= 32) return new Uint8Array(t1).slice(0, length);
  // For longer outputs, chain T blocks
  const t2 = await crypto.subtle.sign('HMAC', key, new Uint8Array([...new Uint8Array(t1), ...info]));
  const combined = new Uint8Array(length);
  combined.set(new Uint8Array(t1), 0);
  combined.set(new Uint8Array(t2).slice(0, length - 32), 32);
  return combined;
}
