import { supabase } from './supabase';

// Tracks which conversation is currently open so the service worker
// can suppress notifications for the active conversation.
let activeConversationId: string | null = null;

// Pending reply to send after auth restores (used when app was closed)
let pendingReply: { conversation_id: string; reply: string } | null = null;

export function setActiveConversation(convId: string | null) {
  activeConversationId = convId;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

export function getPendingReply() {
  return pendingReply;
}

export function clearPendingReply() {
  pendingReply = null;
}

// Send a chat message reply (used by notification inline reply)
export async function sendReplyFromNotification(conversationId: string, content: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    pendingReply = { conversation_id: conversationId, reply: content };
    return false;
  }

  const { error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: 'text',
    });

  if (error) {
    console.error('Error sending reply from notification:', error);
    return false;
  }
  return true;
}

// Set up service worker message listener for notification actions
export function setupNotificationHandler(
  onNavigate: (url: string) => void,
  onReplySent: () => void,
) {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === 'notification_reply' && msg.reply && msg.conversation_id) {
      const success = await sendReplyFromNotification(msg.conversation_id, msg.reply);
      if (success) {
        onReplySent();
      }
    }

    if (msg.type === 'notification_action' && msg.data) {
      if (msg.data.url) {
        onNavigate(msg.data.url);
      }
    }

    if (msg.type === 'call_notification_action' && msg.data) {
      if (msg.data.url) {
        onNavigate(msg.data.url);
      }
    }
  });

  // Listen for chat-conv-opened/closed events from ChatPage
  window.addEventListener('chat-conv-opened', (e) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.conversationId) {
      setActiveConversation(detail.conversationId);
    }
  });

  window.addEventListener('chat-conv-closed', () => {
    setActiveConversation(null);
  });
}

// Check if a conversation is currently active (for suppressing notifications)
export function isConversationActive(convId: string): boolean {
  return activeConversationId === convId;
}
