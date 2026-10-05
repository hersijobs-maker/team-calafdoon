import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/language-context';
import { LANGUAGES, type Language } from '@/lib/translations';
import { Users, User, LogOut, Shield, LayoutDashboard, Heart, MessageCircle, Phone, UserCheck, Camera, Globe, Check, Menu as MenuIcon, Mail } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [connBadge, setConnBadge] = useState(0);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!profile?.id || profile.is_admin) return;

    const loadUnread = async () => {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', profile.id)
        .is('read_at', null);
      setUnreadCount(count || 0);
    };

    const loadConnBadge = async () => {
      const [reqRes, notifRes] = await Promise.all([
        supabase.rpc('get_pending_connection_requests'),
        supabase.rpc('get_connection_notifications'),
      ]);
      const pendingCount = (reqRes.data as unknown[] | null)?.length || 0;
      const notifs = (notifRes.data as { read_at: string | null }[] | null) || [];
      const unreadNotifs = notifs.filter((n) => !n.read_at).length;
      setConnBadge(pendingCount + unreadNotifs);
    };

    loadUnread();
    loadConnBadge();

    const channel = supabase
      .channel('navbar_unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => loadUnread(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        () => loadUnread(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'member_connections' },
        () => loadConnBadge(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connection_notifications' },
        () => loadConnBadge(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.is_admin]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setLangMenuOpen(false);
  };

  const currentLangInfo = LANGUAGES.find((l) => l.code === language);

  const LanguageSelector = () => (
    <div className="relative" ref={langRef}>
      <button
        onClick={() => setLangMenuOpen(!langMenuOpen)}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        title={t('lang.select')}
      >
        <Globe className="w-4 h-4" />
        <span className="text-base">{currentLangInfo?.flag}</span>
      </button>
      {langMenuOpen && (
        <div className="absolute end-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                language === lang.code ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="flex-1">{lang.label}</span>
              {language === lang.code && <Check className="w-4 h-4 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (!profile) {
    return (
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-lg hidden sm:block">{t('nav.brand')}</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to="/social"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/social'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Camera className="w-4 h-4" />
                {t('nav.community')}
              </Link>
              <LanguageSelector />
              <Link
                to="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="text-sm font-semibold text-white bg-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {t('nav.register')}
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const isAdmin = profile.is_admin;

  const navItems = isAdmin
    ? [
        { to: '/admin', label: t('nav.admin'), icon: Shield },
      ]
    : [
        { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { to: '/social', label: t('nav.community'), icon: Camera },
        { to: '/members', label: t('nav.members'), icon: Users },
        { to: '/connections', label: t('nav.connections'), icon: UserCheck },
        { to: '/chat', label: t('nav.chat'), icon: MessageCircle },
        { to: '/call-history', label: t('nav.callHistory'), icon: Phone },
        { to: '/profile', label: t('nav.profile'), icon: User },
        { to: '/contact', label: 'Nala Soo Xiriir', icon: Mail },
      ];

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={isAdmin ? '/admin' : '/social'} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg hidden sm:block">{t('nav.brand')}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to || (item.to === '/chat' && location.pathname.startsWith('/chat'));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {item.to === '/chat' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  {item.to === '/connections' && connBadge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {connBadge > 9 ? '9+' : connBadge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <LanguageSelector />
            <div className="hidden sm:flex items-center gap-2">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
                {profile.full_name}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.signOut')}</span>
            </button>

            {/* Mobile Menu button */}
            {!isAdmin && (
              <div className="relative md:hidden" ref={mobileMenuRef}>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    mobileMenuOpen
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  <MenuIcon className="w-4 h-4" />
                  Menu
                </button>
                {mobileMenuOpen && (
                  <div
                    className="absolute end-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden origin-top-right"
                    style={{ animation: 'menuSlideIn 0.18s ease-out' }}
                  >
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.to || (item.to === '/chat' && location.pathname.startsWith('/chat'));
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                            active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="flex-1">{item.label}</span>
                          {item.to === '/chat' && unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                          {item.to === '/connections' && connBadge > 0 && (
                            <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                              {connBadge > 9 ? '9+' : connBadge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
