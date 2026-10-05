import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import {
  Home as HomeIcon, Search, MessageCircle, Bell, User,
  Loader2, Heart,
} from 'lucide-react';
import { MobileHome } from '@/mobile/MobileHome';
import { MobileSearch } from '@/mobile/MobileSearch';
import { MobileMessages } from '@/mobile/MobileMessages';
import { MobileNotifications } from '@/mobile/MobileNotifications';
import { MobileProfile } from '@/mobile/MobileProfile';
import { MobileAuth } from '@/mobile/MobileAuth';

type Tab = 'home' | 'search' | 'messages' | 'notifications' | 'profile';

export interface ChatTarget {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

export function MobileApp() {
  const { session, profile, loading } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel('mobile-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        loadUnreadCount();
      })
      .subscribe();
    loadUnreadCount();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const loadUnreadCount = async () => {
    if (!profile?.id) return;
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender_id', profile.id)
      .is('read_at', null);
    setUnreadCount(count || 0);
  };

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

  const tabs: { key: Tab; icon: typeof HomeIcon; label: string; badge?: number }[] = [
    { key: 'home', icon: HomeIcon, label: 'Home' },
    { key: 'search', icon: Search, label: t('common.search') },
    { key: 'messages', icon: MessageCircle, label: t('nav.chat'), badge: unreadCount },
    { key: 'notifications', icon: Bell, label: t('nav.admin') === 'لوحة الإدارة' ? 'الإشعارات' : 'Ogeysiis' },
    { key: 'profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch">
        {activeTab === 'home' && <MobileHome onNavigate={setActiveTab} />}
        {activeTab === 'search' && <MobileSearch onMessage={openChatWith} />}
        {activeTab === 'messages' && <MobileMessages chatTarget={chatTarget} onChatTargetConsumed={() => setChatTarget(null)} />}
        {activeTab === 'notifications' && <MobileNotifications />}
        {activeTab === 'profile' && <MobileProfile />}
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
