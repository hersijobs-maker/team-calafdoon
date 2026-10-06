import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import {
  MessageCircle, Loader2, Send, ArrowLeft, DollarSign, Upload,
  X, Phone, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { ChatConversation, ChatMessage } from '@/lib/types';
import type { ChatTarget } from '@/mobile/MobileApp';

const ADMIN_PAYMENT_NUMBER = '616246852';

interface MobileMessagesProps {
  chatTarget: ChatTarget | null;
  onChatTargetConsumed: () => void;
}

export function MobileMessages({ chatTarget, onChatTargetConsumed }: MobileMessagesProps) {
  const { profile } = useAuth();
  const { show } = useToast();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [search, setSearch] = useState('');
  const [showConvList, setShowConvList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc('get_my_conversations');
    if (error) {
      const { data: direct } = await supabase
        .from('chat_conversations')
        .select('*')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });
      setConversations((direct as ChatConversation[]) || []);
    } else {
      setConversations((data as ChatConversation[]) || []);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Global realtime listener — updates conversation list when messages arrive in other conversations
  useEffect(() => {
    if (!profile?.id) return;
    const globalChan = supabase
      .channel('mobile-global-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(globalChan); };
  }, [profile?.id, loadConversations]);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.rpc('can_send_messages').then(({ data }) => setCanSend((data as boolean) || false));
  }, [profile?.id]);

  useEffect(() => {
    if (!chatTarget || !profile?.id) return;
    let cancelled = false;
    setOpeningChat(true);

    (async () => {
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .or(`and(user1_id.eq.${profile.id},user2_id.eq.${chatTarget.userId}),and(user1_id.eq.${chatTarget.userId},user2_id.eq.${profile.id})`)
        .maybeSingle();

      if (cancelled) return;

      if (existing) {
        setSelectedConv(existing.id);
        setOtherUser({ id: chatTarget.userId, full_name: chatTarget.fullName, avatar_url: chatTarget.avatarUrl });
        setShowConvList(false);
      } else {
        const { data: newConv, error } = await supabase
          .from('chat_conversations')
          .insert({ user1_id: profile.id, user2_id: chatTarget.userId })
          .select('id')
          .single();
        if (cancelled) return;
        if (error) {
          show('Lama abuurin wada hadalka: ' + error.message, 'error');
        } else if (newConv) {
          setSelectedConv(newConv.id);
          setOtherUser({ id: chatTarget.userId, full_name: chatTarget.fullName, avatar_url: chatTarget.avatarUrl });
          setShowConvList(false);
        }
      }
      setOpeningChat(false);
      onChatTargetConsumed();
    })();

    return () => { cancelled = true; };
  }, [chatTarget, profile?.id, show, onChatTargetConsumed]);

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_id, content, read_at, created_at, message_type, call_status, call_duration_seconds, call_history_id, audio_url, audio_duration_seconds')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) || []);
    supabase.from('chat_messages').update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convId).neq('sender_id', profile?.id || '').is('read_at', null);
  }, [profile?.id]);

  useEffect(() => {
    if (selectedConv) {
      window.dispatchEvent(new CustomEvent('chat-conv-opened', { detail: { conversationId: selectedConv } }));
    } else {
      window.dispatchEvent(new CustomEvent('chat-conv-closed'));
    }
  }, [selectedConv]);

  useEffect(() => {
    if (!selectedConv) return;
    loadMessages(selectedConv);
    const channel = supabase
      .channel(`mobile-conv-${selectedConv}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedConv}` }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        if (newMsg.sender_id !== profile?.id) {
          supabase.from('chat_messages').update({ read_at: new Date().toISOString() })
            .eq('conversation_id', selectedConv).neq('sender_id', profile?.id || '').is('read_at', null);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedConv}` }, (payload) => {
        const updatedMsg = payload.new as ChatMessage;
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadMessages(selectedConv);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv, loadMessages, profile?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedConv || !profile?.id || sending) return;
    if (!canSend) { setShowPayment(true); return; }
    const content = input.trim();
    setInput('');
    setSending(true);
    const { data: inserted } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: selectedConv, sender_id: profile.id, content, message_type: 'text' })
      .select('id, conversation_id, sender_id, content, read_at, created_at, message_type, call_status, call_duration_seconds, call_history_id, audio_url, audio_duration_seconds')
      .single();
    if (inserted) {
      const newMsg = inserted as ChatMessage;
      setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      loadConversations();
    }
    setSending(false);
  };

  if (openingChat) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm text-slate-500">Wada hadal la bilaabay...</p>
      </div>
    );
  }

  if (selectedConv && otherUser && !showConvList) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex items-center gap-3 px-3 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <button onClick={() => { setShowConvList(true); setSelectedConv(null); setOtherUser(null); setMessages([]); loadConversations(); }} className="p-1.5 -ml-1">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          {otherUser.avatar_url ? (
            <img src={otherUser.avatar_url} alt={otherUser.full_name} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-sm font-bold text-emerald-700">
              {otherUser.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-slate-900 text-sm flex-1 truncate">{otherUser.full_name}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Fariimo ma jirto. Salaan qofka!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === profile?.id;
              if (msg.message_type === 'call_event') {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-slate-100 text-slate-600 text-xs rounded-full px-3 py-1.5">
                      {msg.call_status === 'missed' && '📞 Wici lama qaban'}
                      {msg.call_status === 'declined' && '📞 Wici waa la diiday'}
                      {msg.call_status === 'answered' && `📞 Wici la qabtay · ${msg.call_duration_seconds || 0}s`}
                      {msg.call_status === 'failed' && '📞 Wici khalad ayaa dhacay'}
                    </div>
                  </div>
                );
              }
              if (msg.message_type === 'voice' && msg.audio_url) {
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isMine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-slate-900 rounded-bl-sm border border-slate-100'}`}>
                      <audio src={msg.audio_url} controls className="h-8" />
                      <p className={`text-[10px] mt-0.5 ${isMine ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                    isMine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-slate-900 rounded-bl-sm border border-slate-100'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-0.5 ${isMine ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {!canSend && (
          <div className="px-3 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 flex-1">Fariimaha xannibaan yihiin. Bixi $1 si aad u dirto fariimaha.</p>
            <button onClick={() => setShowPayment(true)} className="bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
              $1
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2 p-3 bg-white border-t border-slate-200 flex-shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Fariin qor..."
            className="flex-1 px-4 py-2.5 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" disabled={sending || !input.trim()} className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50 flex-shrink-0">
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <h1 className="text-lg font-bold text-slate-900">Fariimaha</h1>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 px-4">
          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Wax fariimo ah ma jirto</p>
          <p className="text-xs text-slate-400 mt-1">Raadi qof oo la xiriir si aad u bilowdo wada hadal</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {conversations.map((conv) => {
            const other = conv.other_user;
            if (!other) return null;
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedConv(conv.id);
                  setOtherUser(other);
                  setShowConvList(false);
                }}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                {other.avatar_url ? (
                  <img src={other.avatar_url} alt={other.full_name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-lg font-bold text-emerald-700 flex-shrink-0">
                    {other.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{other.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {conv.latest_message ? (conv.latest_message.sender_id === profile?.id ? 'Adiga: ' : '') + conv.latest_message.content : 'Wada hadal cusub'}
                  </p>
                </div>
                {conv.unread_count && conv.unread_count > 0 && (
                  <span className="bg-emerald-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {conv.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showPayment && <PaymentSheet onClose={() => setShowPayment(false)} onSubmitted={() => { setShowPayment(false); show('Codsiga lacagta waa la kaydiyay. Sug ansaxinta maamulaha.', 'success'); }} />}
    </div>
  );
}

function PaymentSheet({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const { profile } = useAuth();
  const { show } = useToast();
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { show('Sawirku waa inuu noqdaa in ka yar 5MB', 'error'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { show('JPEG, PNG, ama WebP', 'error'); return; }
    if (!profile?.id) return;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${profile.id}/payment-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('payment-screenshots').upload(path, file);
    if (error) { show('Lama soo gali karo sawirka', 'error'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(path);
    setScreenshotUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!screenshotUrl) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('submit_chat_payment', { p_screenshot_url: screenshotUrl });
    if (error) { show(error.message, 'error'); setSubmitting(false); return; }
    onSubmitted();
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Fariin $1
            </h2>
            <button onClick={onClose} className="p-2"><X className="w-5 h-5 text-slate-500" /></button>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-900">Fadlan $1 ku dir lambarkan:</p>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white rounded-lg py-3 border-2 border-emerald-300">
              <Phone className="w-5 h-5 text-emerald-600" />
              <span className="text-xl font-bold text-slate-900 tracking-wider">{ADMIN_PAYMENT_NUMBER}</span>
            </div>
            <p className="text-xs text-emerald-700">Ka dib markaad lacagta dirto, soo geli sawirka cadbinta hoosta.</p>
          </div>

          {screenshotUrl ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300 mb-4">
              <img src={screenshotUrl} alt="Payment" className="w-full max-h-48 object-contain bg-slate-50" />
              <button onClick={() => setScreenshotUrl(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> La soo geliyay
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer mb-4">
              {uploading ? <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" /> : <Upload className="w-8 h-8 text-slate-400" />}
              <p className="text-sm text-slate-600 text-center">{uploading ? 'Sawirka ayaa la soo gelinayaa...' : 'Soo geli sawirka lacagta'}</p>
              <p className="text-xs text-slate-400">JPEG, PNG, WebP (max 5MB)</p>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
            </label>
          )}

          <button
            onClick={handleSubmit}
            disabled={!screenshotUrl || submitting || uploading}
            className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Dir Codsiga</>}
          </button>
        </div>
      </div>
    </div>
  );
}
