// Edge function: send-chat-push
// Sends Web Push notifications to a recipient when a new chat message is inserted.
// Triggered by a database webhook on chat_messages INSERT, or called directly.
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
    const body = await req.json();
    const { message_id, conversation_id, sender_id, content, message_type, audio_duration_seconds } = body;

    if (!conversation_id || !sender_id) {
      return new Response(JSON.stringify({ error: 'conversation_id and sender_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the conversation to find the recipient
    const { data: conv, error: convError } = await supabase
      .from('chat_conversations')
      .select('user1_id, user2_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conv) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientId = conv.user1_id === sender_id ? conv.user2_id : conv.user1_id;

    // Check if the message is already read (recipient is viewing the conversation)
    // If so, skip the push notification
    if (message_id) {
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('read_at')
        .eq('id', message_id)
        .single();
      if (msg?.read_at) {
        return new Response(JSON.stringify({ sent: 0, message: 'Message already read' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get sender's profile for name and avatar
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', sender_id)
      .single();

    const senderName = senderProfile?.full_name || 'Qof';

    // Build message preview
    let body_text: string;
    if (message_type === 'voice') {
      body_text = 'Fariin cod ah';
    } else if (message_type === 'call_event') {
      body_text = content === 'missed' ? 'Wici lama qaban' : 'Wici';
    } else {
      body_text = content || 'Fariin cusub';
    }
    if (body_text.length > 100) body_text = body_text.substring(0, 97) + '...';

    // Get VAPID keys
    const { data: vapidPublicSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'vapid_public_key')
      .maybeSingle();
    const vapidPublicKey = (vapidPublicSetting as { value: string } | null)?.value;

    const { data: vapidPrivateSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'vapid_private_key')
      .maybeSingle();
    const vapidPrivateKey = (vapidPrivateSetting as { value: string } | null)?.value;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ sent: 0, message: 'VAPID keys not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all push subscriptions for the recipient
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientId);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notificationPayload = {
      title: senderName,
      body: body_text,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `chat-${conversation_id}`,
      renotify: true,
      data: {
        type: 'chat_message',
        conversation_id,
        message_id: message_id || null,
        sender_id,
        sender_name: senderName,
        url: `/chat/${conversation_id}`,
      },
      actions: [
        { action: 'reply', title: 'Jawaab' },
        { action: 'view', title: 'Eeg' },
      ],
      vibrate: [100, 50, 100],
    };

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
    console.error('Error in send-chat-push:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================
// Web Push implementation
// ============================================================

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
  const privateKeyBytes = urlBase64ToUint8Array(vapidPrivateKey);
  const jwt = await createVapidJwt(endpoint, vapidPublicKey, privateKeyBytes, origin);
  const encrypted = await encryptPayload(payload, p256dh, auth);
  const pushServiceUrl = new URL(endpoint);

  const response = await fetch(pushServiceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
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
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = { aud, exp, sub: 'mailto:admin@teamcalafdoon.com' };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

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

async function encryptPayload(
  payload: Uint8Array,
  p256dh: string,
  auth: string,
): Promise<Uint8Array> {
  const publicKeyBytes = urlBase64ToUint8Array(p256dh);
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    serverKeyPair.privateKey,
    256,
  );

  const authBytes = urlBase64ToUint8Array(auth);
  const prk = await hkdfExtract(
    new Uint8Array([0, authBytes.length, ...authBytes, ...new Uint8Array(sharedSecret)]),
  );

  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));
  const cekInfo = new TextEncoder().encode('WebPush: info\0' + String.fromCharCode(...publicKeyBytes) + String.fromCharCode(...serverPublicKeyRaw));
  const cek = await hkdfExpand(prk, cekInfo, 16);

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);

  const recordSize = 4096;
  const headerBytes = new Uint8Array(21 + 65);
  new DataView(headerBytes.buffer).setUint32(0, recordSize);
  new DataView(headerBytes.buffer).setUint32(4, payload.length + 16 + 1);
  headerBytes[8] = 65;
  headerBytes.set(serverPublicKeyRaw, 9);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    payload,
  );

  const result = new Uint8Array(headerBytes.length + encrypted.byteLength + 1);
  result.set(headerBytes);
  result.set(new Uint8Array(encrypted), headerBytes.length);
  result[result.length - 1] = 2;

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
  const t2 = await crypto.subtle.sign('HMAC', key, new Uint8Array([...new Uint8Array(t1), ...info]));
  const combined = new Uint8Array(length);
  combined.set(new Uint8Array(t1), 0);
  combined.set(new Uint8Array(t2).slice(0, length - 32), 32);
  return combined;
}
