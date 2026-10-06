import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import type { ChatConversation, ChatMessage } from '@/lib/types';
import {
  ArrowLeft,
  Send,
  Loader2,
  MessageCircle,
  Search,
  Inbox,
  Phone,
  Video,
  PhoneMissed,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneOff,
  X,
  Clock,
  Lock,
  DollarSign,
} from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { useCall } from '@/lib/call-context';
import { usePresence } from '@/lib/usePresence';
import type { CallEventStatus } from '@/lib/types';
import { useLanguage } from '@/lib/language-context';

interface ConversationWithMeta extends ChatConversation {
  other_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  latest_message: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
}

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useLanguage();

  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);
  const callToast = useCallback((msg: string, type: 'info' | 'error' | 'success') => {
    setToastMsg({ text: msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  }, []);
  const voiceCall = useCall();
  const onlineIds = usePresence(profile?.id);
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(conversationId || null);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null>(null);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showConvList, setShowConvList] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [sendPermissionLoading, setSendPermissionLoading] = useState(true);
  const [inAppNotif, setInAppNotif] = useState<{
    conversationId: string;
    senderName: string;
    content: string;
    avatar_url: string | null;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const navState = location.state as
    | { newChatUserId?: string; newChatName?: string; newChatAvatar?: string | null }
    | null;

  // Load conversations with metadata
  const loadConversations = useCallback(async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, user1_id, user2_id, created_at')
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      setLoadingConvs(false);
      return;
    }

    const convs = data as ChatConversation[] | null;
    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoadingConvs(false);
      return;
    }

    const otherUserIds = convs.map((c) =>
      c.user1_id === profile.id ? c.user2_id : c.user1_id,
    );

    const { data: otherProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', otherUserIds);

    const profileMap = new Map(
      (otherProfiles || []).map((p) => [p.id, p]),
    );

    const convsWithMeta: ConversationWithMeta[] = await Promise.all(
      convs.map(async (conv) => {
        const otherId = conv.user1_id === profile.id ? conv.user2_id : conv.user1_id;
        const other = profileMap.get(otherId);

        const { data: latest } = await supabase
          .from('chat_messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', profile.id)
          .is('read_at', null);

        return {
          ...conv,
          other_user: {
            id: otherId,
            full_name: other?.full_name || 'Xuban',
            avatar_url: other?.avatar_url || null,
          },
          latest_message: latest || null,
          unread_count: unreadCount || 0,
        };
      }),
    );

    convsWithMeta.sort((a, b) => {
      const aTime = a.latest_message?.created_at || a.created_at;
      const bTime = b.latest_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setConversations(convsWithMeta);
    setLoadingConvs(false);
  }, [profile?.id]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_id, content, read_at, created_at, message_type, call_status, call_duration_seconds, call_history_id, audio_url, audio_duration_seconds')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
    } else {
      setMessages(data as ChatMessage[] || []);
    }
    setLoadingMsgs(false);
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(async (convId: string) => {
    if (!profile?.id) return;
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .neq('sender_id', profile.id)
      .is('read_at', null);
    window.dispatchEvent(new CustomEvent('chat-messages-read'));
  }, [profile?.id]);

  // Start a new conversation with a member
  const startConversation = useCallback(
    async (otherUserId: string, otherName: string, otherAvatar: string | null) => {
      if (!profile?.id || otherUserId === profile.id) return;

      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .or(
          `and(user1_id.eq.${profile.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${profile.id})`,
        )
        .maybeSingle();

      let convId: string;

      if (existing) {
        convId = (existing as { id: string }).id;
      } else {
        const { data: newConv, error } = await supabase
          .from('chat_conversations')
          .insert({
            user1_id: profile.id,
            user2_id: otherUserId,
          })
          .select('id')
          .single();

        if (error) {
          console.error('Error creating conversation:', error);
          return;
        }
        convId = (newConv as { id: string }).id;
      }

      await loadConversations();
      setOtherUser({ id: otherUserId, full_name: otherName, avatar_url: otherAvatar });
      setSelectedConv(convId);
      setShowConvList(false);
      navigate(`/chat/${convId}`, { replace: true });
      loadMessages(convId);
      markAsRead(convId);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [profile?.id, navigate, loadConversations, loadMessages, markAsRead],
  );

  // Select an existing conversation
  const selectConversation = useCallback(
    (convId: string, other: ConversationWithMeta['other_user']) => {
      setSelectedConv(convId);
      setOtherUser(other);
      setShowConvList(false);
      navigate(`/chat/${convId}`, { replace: true });
      loadMessages(convId);
      markAsRead(convId);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [navigate, loadMessages, markAsRead],
  );

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle "new chat" navigation state from member card
  useEffect(() => {
    if (navState?.newChatUserId && navState?.newChatName) {
      startConversation(
        navState.newChatUserId,
        navState.newChatName,
        navState.newChatAvatar ?? null,
      );
      // Clear the state so it doesn't re-trigger
      navigate('/chat', { replace: true });
    }
  }, [navState, startConversation, navigate]);

  // If conversationId in URL, auto-select it
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find((c) => c.id === conversationId);
      if (conv) {
        selectConversation(conv.id, conv.other_user);
      }
    }
  }, [conversationId, conversations, selectConversation]);

  // Realtime subscription for conversations
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('chat_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: `user1_id=eq.${profile.id}`,
        },
        () => loadConversations(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: `user2_id=eq.${profile.id}`,
        },
        () => loadConversations(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadConversations]);

  // Global realtime listener for ALL chat_messages changes — updates chat list
  // and shows in-app notification banner when a message arrives in another conversation
  useEffect(() => {
    if (!profile?.id) return;

    const globalChannel = supabase
      .channel('global_chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Skip own messages
          if (newMsg.sender_id === profile.id) return;
          // Check if this message belongs to a conversation the user is part of
          const conv = conversations.find((c) => c.id === newMsg.conversation_id);
          if (!conv) {
            // Not in our list yet — reload conversations to pick it up
            loadConversations();
            return;
          }
          // If the message is NOT in the currently open conversation, update the list
          // and show an in-app notification banner
          if (selectedConv !== newMsg.conversation_id) {
            // Update the conversation list immediately
            setConversations((prev) => {
              const updated = prev.map((c) => {
                if (c.id === newMsg.conversation_id) {
                  return {
                    ...c,
                    latest_message: {
                      content: newMsg.content,
                      created_at: newMsg.created_at,
                      sender_id: newMsg.sender_id,
                    },
                    unread_count: (c.unread_count || 0) + 1,
                  };
                }
                return c;
              });
              // Move the conversation with the new message to the top
              updated.sort((a, b) => {
                const aTime = a.latest_message?.created_at || a.created_at;
                const bTime = b.latest_message?.created_at || b.created_at;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
              return updated;
            });
            // Show in-app notification banner
            setInAppNotif({
              conversationId: newMsg.conversation_id,
              senderName: conv.other_user.full_name,
              content: newMsg.message_type === 'voice' ? 'Fariin cod ah' : newMsg.content,
              avatar_url: conv.other_user.avatar_url,
            });
            // Auto-dismiss after 5 seconds
            setTimeout(() => setInAppNotif(null), 5000);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [profile?.id, conversations, selectedConv, loadConversations]);

  // Track the currently open conversation for notification suppression
  useEffect(() => {
    if (selectedConv) {
      window.dispatchEvent(new CustomEvent('chat-conv-opened', { detail: { conversationId: selectedConv } }));
    } else {
      window.dispatchEvent(new CustomEvent('chat-conv-closed'));
    }
  }, [selectedConv]);

  // Realtime subscription for messages in selected conversation
  useEffect(() => {
    if (!selectedConv) return;

    const channel = supabase
      .channel(`chat_messages_${selectedConv}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConv}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender_id !== profile?.id) {
            markAsRead(selectedConv);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConv}`,
        },
        (payload) => {
          const updatedMsg = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)),
          );
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Channel is ready — reload messages to catch any missed during reconnect
          loadMessages(selectedConv);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv, markAsRead, profile?.id, loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if current user can send messages (paid + approved)
  useEffect(() => {
    if (!profile?.id) return;
    supabase.rpc('can_send_messages').then(({ data }) => {
      setCanSend((data as boolean) || false);
      setSendPermissionLoading(false);
    });
  }, [profile?.id]);

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedConv || !profile?.id || sending) return;
    if (!canSend) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConv,
        sender_id: profile.id,
        content,
        message_type: 'text',
      })
      .select('id, conversation_id, sender_id, content, read_at, created_at, message_type, call_status, call_duration_seconds, call_history_id, audio_url, audio_duration_seconds')
      .single();

    if (error) {
      console.error('Error sending message:', error);
      setInput(content);
    } else if (inserted) {
      const newMsg = inserted as ChatMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      loadConversations();
    }
    setSending(false);
  };

  const handleSendVoice = async (audioBlob: Blob, durationSeconds: number) => {
    if (!selectedConv || !profile?.id || !canSend) return;

    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `${profile.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('voice-messages')
      .upload(fileName, audioBlob, {
        contentType: audioBlob.type || 'audio/webm',
        upsert: false,
      });

    if (uploadError) {
      console.error('Voice upload error:', uploadError);
      throw new Error('Lama soo galin faylka codka.');
    }

    const { data: inserted, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConv,
        sender_id: profile.id,
        content: 'Fariin cod ah',
        message_type: 'voice',
        audio_url: fileName,
        audio_duration_seconds: durationSeconds,
      })
      .select('id, conversation_id, sender_id, content, read_at, created_at, message_type, call_status, call_duration_seconds, call_history_id, audio_url, audio_duration_seconds')
      .single();

    if (insertError) {
      console.error('Voice message insert error:', insertError);
      throw new Error('Lama kaydin fariinta codka.');
    }

    if (inserted) {
      const newMsg = inserted as ChatMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      loadConversations();
    }
  };

  const filteredConvs = conversations.filter((c) =>
    c.other_user.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      {inAppNotif && (
        <div
          onClick={() => {
            const conv = conversations.find((c) => c.id === inAppNotif.conversationId);
            if (conv) {
              selectConversation(conv.id, conv.other_user);
            }
            setInAppNotif(null);
          }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-white shadow-lg rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors min-w-[280px] max-w-[90vw]"
        >
          {inAppNotif.avatar_url ? (
            <img src={inAppNotif.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0">
              {inAppNotif.senderName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{inAppNotif.senderName}</p>
            <p className="text-xs text-slate-500 truncate">{inAppNotif.content}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setInAppNotif(null); }}
            className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-8">
        <div className="bg-white sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-4rem)] sm:h-[calc(100vh-8rem)] flex">
          {/* Conversation list */}
          <div
            className={`${
              showConvList ? 'flex' : 'hidden'
            } sm:flex flex-col w-full sm:w-80 border-r border-slate-200 flex-shrink-0`}
          >
            <div className="p-4 border-b border-slate-200">
              <h1 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                {t('chat.title')}
              </h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('chat.search')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">{t('chat.noConversations')}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('chat.noConversationsHint')}
                  </p>
                </div>
              ) : (
                filteredConvs.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id, conv.other_user)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 ${
                      selectedConv === conv.id ? 'bg-emerald-50' : ''
                    }`}
                  >
                    {conv.other_user.avatar_url ? (
                      <img
                        src={conv.other_user.avatar_url}
                        alt={conv.other_user.full_name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-lg font-bold text-emerald-700 flex-shrink-0">
                        {conv.other_user.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {conv.other_user.full_name}
                        </p>
                        {conv.latest_message && (
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {formatTime(conv.latest_message.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 truncate">
                          {conv.latest_message
                            ? (conv.latest_message.sender_id === profile?.id ? 'Adiga: ' : '') +
                              conv.latest_message.content
                            : 'Wada hadal cusub'}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="flex-shrink-0 bg-emerald-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div
            className={`${
              showConvList ? 'hidden' : 'flex'
            } sm:flex flex-col flex-1`}
          >
            {selectedConv && otherUser ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-slate-200 bg-white">
                  <button
                    onClick={() => {
                      setShowConvList(true);
                      setSelectedConv(null);
                      setOtherUser(null);
                      navigate('/chat', { replace: true });
                    }}
                    className="sm:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  {otherUser.avatar_url ? (
                    <img
                      src={otherUser.avatar_url}
                      alt={otherUser.full_name}
                      onClick={() => navigate(`/profile/${otherUser.id}`)}
                      className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div
                      onClick={() => navigate(`/profile/${otherUser.id}`)}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-lg font-bold text-emerald-700 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {otherUser.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/profile/${otherUser.id}`)}
                      className="font-semibold text-slate-900 truncate hover:underline text-left"
                    >
                      {otherUser.full_name}
                    </button>
                  </div>
                  <button
                    onClick={() => voiceCall.startCall({
                      id: otherUser.id,
                      full_name: otherUser.full_name,
                      avatar_url: otherUser.avatar_url,
                    })}
                    disabled={voiceCall.status !== 'idle'}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    aria-label="Wici codsan"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-slate-50">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">
                        {t('chat.typeMessage')}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === profile?.id;

                      if (msg.message_type === 'call_event') {
                        return (
                          <CallEventBubble
                            key={msg.id}
                            status={msg.call_status as CallEventStatus | null}
                            duration={msg.call_duration_seconds}
                            isCaller={isMine}
                            created_at={msg.created_at}
                            onCallBack={() => {
                              if (otherUser) {
                                voiceCall.startCall({
                                  id: otherUser.id,
                                  full_name: otherUser.full_name,
                                  avatar_url: otherUser.avatar_url,
                                }, false);
                              }
                            }}
                          />
                        );
                      }

                      if (msg.message_type === 'voice' && msg.audio_url) {
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2.5 ${
                                isMine
                                  ? 'bg-emerald-600 text-white rounded-br-sm'
                                  : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
                              }`}
                            >
                              <VoiceMessagePlayer
                                audioPath={msg.audio_url || ''}
                                duration={msg.audio_duration_seconds}
                                isMine={isMine}
                              />
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className={`text-[10px] ${isMine ? 'text-emerald-100' : 'text-slate-400'}`}>
                                  {formatTime(msg.created_at)}
                                </span>
                                {isMine && otherUser && (
                                  <DeliveryDots online={onlineIds.has(otherUser.id)} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              isMine
                                ? 'bg-emerald-600 text-white rounded-br-sm'
                                : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className={`text-[10px] ${isMine ? 'text-emerald-100' : 'text-slate-400'}`}>
                                {formatTime(msg.created_at)}
                              </span>
                              {isMine && otherUser && (
                                <DeliveryDots online={onlineIds.has(otherUser.id)} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                {canSend ? (
                <form
                  onSubmit={handleSend}
                  className="flex items-center gap-2 p-3 sm:p-4 border-t border-slate-200 bg-white"
                >
                  <VoiceRecorder
                    onSend={handleSendVoice}
                    onStateChange={setVoiceActive}
                    disabled={sending}
                  />
                  {voiceActive ? null : (
                    <>
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t('chat.inputPlaceholder')}
                        disabled={sending}
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!input.trim() || sending}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      >
                        {sending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </>
                  )}
                </form>
                ) : sendPermissionLoading ? (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-200 bg-white">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="p-4 border-t border-slate-200 bg-amber-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Lock className="w-5 h-5 text-amber-600" />
                      </div>
                      <p className="text-sm text-amber-800 flex-1">
                        Si aad fariin u dirto ama uga jawaabto, fadlan bixi $1 oo sug approval-ka maamulka.
                      </p>
                      <button
                        onClick={() => navigate('/members')}
                        className="flex items-center gap-1.5 bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        $1
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="hidden sm:flex flex-col items-center justify-center flex-1 text-center p-8">
                <MessageCircle className="w-16 h-16 text-slate-200 mb-4" />
                <p className="text-lg font-semibold text-slate-700">{t('chat.title')}</p>
                <p className="text-sm text-slate-400 mt-1">
                  {t('chat.selectConversation')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-sm text-center" style={{
          backgroundColor: toastMsg.type === 'error' ? '#dc2626' : toastMsg.type === 'success' ? '#059669' : '#334155',
        }}>
          {toastMsg.text}
        </div>
      )}

    </div>
  );
}

function DeliveryDots({ online }: { online: boolean }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-0.5 ml-1 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center ml-1 flex-shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
    </span>
  );
}

function CallEventBubble({
  status,
  duration,
  isCaller,
  created_at,
  onCallBack,
}: {
  status: CallEventStatus | null;
  duration: number | null;
  isCaller: boolean;
  created_at: string;
  onCallBack: () => void;
}) {
  const formatTimeStr = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDurationStr = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isMissed = status === 'missed';
  const isDeclined = status === 'declined';
  const isAnswered = status === 'answered' || status === 'ended';
  const isFailed = status === 'failed';

  let icon: React.ReactNode;
  let label: string;
  let bgColor: string;
  let textColor: string;

  if (isMissed) {
    icon = <PhoneMissed className="w-4 h-4 text-red-500" />;
    label = isCaller ? 'Wicitaan la waayay' : 'Wicitaan la waayay';
    bgColor = 'bg-red-50 border border-red-100';
    textColor = 'text-red-700';
  } else if (isDeclined) {
    icon = <PhoneOff className="w-4 h-4 text-orange-500" />;
    label = isCaller ? 'Wicitaan la diiday' : 'Wicitaan la diiday';
    bgColor = 'bg-orange-50 border border-orange-100';
    textColor = 'text-orange-700';
  } else if (isAnswered) {
    icon = isCaller ? <PhoneOutgoing className="w-4 h-4 text-emerald-600" /> : <PhoneIncoming className="w-4 h-4 text-emerald-600" />;
    label = isCaller ? 'Wicitaan la dhammeeyay' : 'Wicitaan la jawaabay';
    bgColor = 'bg-emerald-50 border border-emerald-100';
    textColor = 'text-emerald-700';
  } else if (isFailed) {
    icon = <PhoneOff className="w-4 h-4 text-slate-500" />;
    label = 'Wicitaan khalad ayaa dhacay';
    bgColor = 'bg-slate-50 border border-slate-200';
    textColor = 'text-slate-600';
  } else {
    icon = <Phone className="w-4 h-4 text-slate-500" />;
    label = 'Wicitaan';
    bgColor = 'bg-slate-50 border border-slate-200';
    textColor = 'text-slate-600';
  }

  return (
    <div className="flex justify-center my-2">
      <div
        className={`inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 ${bgColor} max-w-[85%]`}
      >
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${textColor}`}>{label}</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatTimeStr(created_at)}
            {isAnswered && duration ? ` · ${formatDurationStr(duration)}` : ''}
          </span>
        </div>
        {!isCaller && (isMissed || isDeclined) && (
          <button
            onClick={onCallBack}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex-shrink-0"
            aria-label="Wici dib"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}


