import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';

type OpenConversationHandler = (conversationId: string) => void;

let activeConversationId: string | null = null;
let openConversationHandler: OpenConversationHandler | null = null;
let appInForeground = true;
let initialized = false;

const shownNotificationMsgIds = new Set<string>();
const CHANNEL_ID = 'chat_messages';

export function setActiveConversation(convId: string | null) {
  activeConversationId = convId;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

export function isAppActive(): boolean {
  return appInForeground;
}

function notificationIdFrom(messageId: string): number {
  let hash = 0;
  for (let i = 0; i < messageId.length; i++) {
    hash = (hash * 31 + messageId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483000;
}

export async function setupNativeNotifications(
  onOpenConversation: OpenConversationHandler,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  openConversationHandler = onOpenConversation;

  if (!initialized) {
    initialized = true;

    try {
      await LocalNotifications.requestPermissions();
    } catch {
      // permission prompt may already have been answered — non-fatal
    }

    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Fariimaha',
        description: 'Fariimo cusub',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: 'FF10A8A0',
        sound: 'incoming_ringtone.wav',
      });
    } catch {
      // channel creation can fail on older Android — non-fatal
    }

    CapApp.addListener('appStateChange', ({ isActive }) => {
      appInForeground = isActive;
    });
  }

  // When a native notification is tapped, open the correct conversation
  await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      const convId = event.notification?.extra?.conversation_id as string | undefined;
      if (convId && openConversationHandler) {
        openConversationHandler(convId);
      }
    },
  );
}

// Show a native notification for a new chat message (only when backgrounded).
// A deterministic id from the message UUID means re-scheduling the same
// message replaces any existing notification instead of stacking duplicates.
export async function showChatNotification(opts: {
  conversationId: string;
  messageId: string;
  senderName: string;
  content: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (activeConversationId === opts.conversationId) return;
  if (appInForeground) return;
  if (shownNotificationMsgIds.has(opts.messageId)) return;
  shownNotificationMsgIds.add(opts.messageId);

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationIdFrom(opts.messageId),
          title: opts.senderName,
          body: opts.content.length > 100 ? opts.content.slice(0, 97) + '...' : opts.content,
          channelId: CHANNEL_ID,
          sound: 'incoming_ringtone.wav',
          extra: {
            type: 'chat_message',
            conversation_id: opts.conversationId,
            message_id: opts.messageId,
          },
        },
      ],
    });
  } catch (err) {
    console.error('showChatNotification failed:', err);
  }
}
