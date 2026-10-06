import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import {
  Home as HomeIcon, Search, MessageCircle, Bell, User,
  Loader2, Heart, ArrowLeft, MapPin, Phone, Calendar, UserCheck,
} from 'lucide-react';
import type { DirectoryMember } from '@/lib/types';
import { MobileHome } from '@/mobile/MobileHome';
import { MobileSearch } from '@/mobile/MobileSearch';
import { MobileMessages } from '@/mobile/MobileMessages';
import { MobileNotifications } from '@/mobile/MobileNotifications';
import { MobileProfile } from '@/mobile/MobileProfile';
import { MobileAuth } from '@/mobile/MobileAuth';
import { MobileContactUs } from '@/mobile/MobileContactUs';

export type Tab = 'home' | 'search' | 'messages' | 'notifications' | 'profile';

export interface ChatTarget {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

export function MobileApp() {
  const { session, profile, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);

  const loadUnreadCount = useCallback(async () => {
    if (!profile?.id) return;
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender_id', profile.id)
      .is('read_at', null);
    setUnreadCount(count || 0);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel('mobile-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        loadUnreadCount();
      })
      .subscribe();
    loadUnreadCount();

    const onMessagesRead = () => loadUnreadCount();
    window.addEventListener('chat-messages-read', onMessagesRead);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('chat-messages-read', onMessagesRead);
    };
  }, [profile?.id, loadUnreadCount]);

  const openChatWith = useCallback((target: ChatTarget) => {
    setChatTarget(target);
    setActiveTab('messages');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!session || !profile) {
    return <MobileAuth />;
  }

  if (profile.registration_status !== 'approved') {
    return <MobilePending />;
  }

  if (showContact) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <MobileContactUs onBack={() => setShowContact(false)} />
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; icon: typeof HomeIcon; label: string; badge?: number }[] = [
    { key: 'home', icon: HomeIcon, label: 'Home' },
    { key: 'search', icon: Search, label: t('common.search') },
    { key: 'messages', icon: MessageCircle, label: t('nav.chat'), badge: unreadCount },
    { key: 'notifications', icon: Bell, label: 'Ogeysiis' },
    { key: 'profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch">
        {activeTab === 'home' && <MobileHome onNavigate={setActiveTab} onOpenMember={(id) => setViewingMemberId(id)} onOpenChat={openChatWith} />}
        {activeTab === 'search' && <MobileSearch onMessage={openChatWith} />}
        {activeTab === 'messages' && <MobileMessages chatTarget={chatTarget} onChatTargetConsumed={() => setChatTarget(null)} />}
        {activeTab === 'notifications' && <MobileNotifications />}
        {activeTab === 'profile' && <MobileProfile onContactUs={() => setShowContact(true)} />}
      </div>

      <nav className="flex items-center justify-around bg-white border-t border-slate-200 px-1 pb-[env(safe-area-inset-bottom)] flex-shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[60px] transition-colors ${
                active ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-600 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {viewingMemberId && (
        <MemberProfileOverlay
          memberId={viewingMemberId}
          onClose={() => setViewingMemberId(null)}
          onMessage={(target) => { setViewingMemberId(null); openChatWith(target); }}
        />
      )}
    </div>
  );
}

function MobilePending() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isBlocked = profile?.registration_status === 'blocked';
  const isRejected = profile?.registration_status === 'rejected';
  const isDraft = profile?.registration_status === 'draft';

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-teal-50 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center mb-5 shadow-lg">
        <Heart className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Team Calafdoon</h1>

      {isBlocked ? (
        <p className="text-slate-600 text-sm mb-6">Akoonkaaga waa la xannibay. Fadlan la xidhiidh maamulaha.</p>
      ) : isRejected ? (
        <p className="text-slate-600 text-sm mb-6">Diiwaangelintaada waa la diiday. Fadlan la xidhiidh maamulaha.</p>
      ) : isDraft ? (
        <>
          <p className="text-slate-600 text-sm mb-2">Lacagta diiwaangelinta ($1) lama bixin.</p>
          <p className="text-slate-500 text-xs mb-6">Fadlan bixi $1 si aad u gudubto ansaxinta.</p>
          <button
            onClick={() => navigate('/pending-approval')}
            className="bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl"
          >
            Bixi Lacagta
          </button>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
          </div>
          <p className="text-slate-600 text-sm mb-6">Codsigaaga waa la diray. Fadlan sug inta maamulka uu kuu ansixinayo.</p>
        </>
      )}

      <button
        onClick={async () => { await signOut(); navigate('/m'); }}
        className="text-slate-500 text-sm font-medium mt-4"
      >
        Ka Bax
      </button>
    </div>
  );
}

function MemberProfileOverlay({ memberId, onClose, onMessage }: {
  memberId: string;
  onClose: () => void;
  onMessage: (target: ChatTarget) => void;
}) {
  const [member, setMember] = useState<DirectoryMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, bio, location, profession, created_at, age, gender, country, city, marital_status, looking_for')
        .eq('id', memberId)
        .maybeSingle();
      setMember(data as DirectoryMember | null);
      setLoading(false);
    })();
  }, [memberId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
        <p className="text-sm text-slate-500 mb-4">Xuban lama helin.</p>
        <button onClick={onClose} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">Dib u noqo</button>
      </div>
    );
  }

  const MARITAL_LABELS: Record<string, string> = {
    single: 'Aan guursan', divorced: 'Guur laga xigay', widowed: 'Luumay', married: 'Guursan',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
      <div className="relative">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.full_name} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-64 bg-gradient-to-br from-emerald-700 to-teal-700 flex items-center justify-center">
            <span className="text-5xl font-bold text-white">{member.full_name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <button onClick={onClose} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="px-4 -mt-8 relative pb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-xl font-bold text-slate-900">{member.full_name}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {member.city && <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full">{member.city}</span>}
            {member.country && <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full">{member.country}</span>}
            {member.marital_status && <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full">{MARITAL_LABELS[member.marital_status] || member.marital_status}</span>}
            {member.age && <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full">{member.age} sano</span>}
          </div>
          {member.bio && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Iftiiminta</p>
              <p className="text-sm text-slate-700 leading-relaxed">{member.bio}</p>
            </div>
          )}
          {member.looking_for && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Waxa la raadinayo</p>
              <p className="text-sm text-slate-700 leading-relaxed">{member.looking_for}</p>
            </div>
          )}
          {member.profession && (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-500">Xirfadeynta:</span> {member.profession}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mt-3 space-y-3">
          {member.phone && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Telefoon</p>
                <p className="text-sm font-medium text-slate-700">{member.phone}</p>
              </div>
            </div>
          )}
          {member.age && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Da'da</p>
                <p className="text-sm font-medium text-slate-700">{member.age} sano</p>
              </div>
            </div>
          )}
          {(member.city || member.country) && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Goobta</p>
                <p className="text-sm font-medium text-slate-700">{[member.city, member.country].filter(Boolean).join(', ')}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => onMessage({ userId: member.id, fullName: member.full_name, avatarUrl: member.avatar_url })}
            className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <MessageCircle className="w-5 h-5" />
            Fariin
          </button>
        </div>
      </div>
    </div>
  );
}
