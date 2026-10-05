import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Heart,
  Users,
  Shield,
  ArrowRight,
  UserPlus,
  LogIn,
  MessageCircle,
  Search,
  Bell,
  User,
  Menu as MenuIcon,
  Lock,
  Sparkles,
  LayoutDashboard,
  Camera,
  MessageCircle as ChatIcon,
  UserCheck,
  DollarSign,
  ShieldCheck,
  Ban,
  Flag,
  Home,
  Globe,
  Loader2,
} from 'lucide-react';
import { PublicStoriesCarousel } from '@/components/PublicStoriesCarousel';
import { AdvertisementSection } from '@/components/AdvertisementSection';
import { useLanguage } from '@/lib/language-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useRef } from 'react';

const WHATSAPP_URL = 'https://wa.me/252616246852';

const HERO_IMAGE =
  'https://images.pexels.com/photos/5700691/pexels-photo-5700691.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1';
const BANNER_IMAGE =
  'https://images.pexels.com/photos/1024963/pexels-photo-1024963.jpeg?auto=compress&cs=tinysrgb&w=1260&h=600&dpr=1';

interface NewMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  marital_status: string | null;
  bio: string | null;
  profession: string | null;
}

interface SiteStats {
  approved_count: number;
  connection_count: number;
  new_this_month: number;
}

interface Testimonial {
  id: string;
  content: string;
  display_name: string | null;
  full_name: string;
  avatar_url: string | null;
}

const MARITAL_LABELS: Record<string, string> = {
  single: 'Aan guursan',
  divorced: 'Guur laga xigay',
  widowed: 'Luumay',
  married: 'Guursan',
};

export function LandingPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [searchName, setSearchName] = useState('');
  const [newMembers, setNewMembers] = useState<NewMember[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    supabase.rpc('get_new_members', { p_limit: 8 }).then(({ data }) => {
      setNewMembers((data as NewMember[]) || []);
    });
    supabase.rpc('get_site_stats').then(({ data }) => {
      setStats(data as SiteStats | null);
    });
    supabase.rpc('get_approved_testimonials').then(({ data }) => {
      setTestimonials((data as Testimonial[]) || []);
    });
  }, []);

  const isLoggedIn = !!profile;
  const isAdmin = profile?.is_admin;

  const mobileNavItems = isAdmin
    ? [{ to: '/admin', label: t('nav.admin'), icon: Shield }]
    : [
        { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
        { to: '/members', label: 'Xubnaha', icon: Users },
        { to: '/social', label: 'Bulshada', icon: Camera },
        { to: '/connections', label: 'Kulanno', icon: UserCheck },
        { to: '/dashboard', label: 'Dhaqaano', icon: Sparkles },
        { to: '/chat', label: 'Fariimaha', icon: ChatIcon },
        { to: '/profile', label: 'Profile-ka', icon: User },
      ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/members');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Premium header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/25 flex-shrink-0">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 hidden xs:block">
                <div className="font-bold text-white text-sm leading-tight truncate">
                  Team Calafdoon
                </div>
                <div className="text-[10px] text-emerald-100/80 leading-tight truncate">
                  Isku Xir Qoyas Farxad Leh
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <button
                onClick={() => navigate('/members')}
                className="p-2 rounded-lg text-white/90 hover:bg-white/15 transition-colors"
                aria-label="Search"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-2 rounded-lg text-white/90 hover:bg-white/15 transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-emerald-700" />
                </button>
                {notifOpen && (
                  <div
                    className="absolute end-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden origin-top-right"
                    style={{ animation: 'menuSlideIn 0.18s ease-out' }}
                  >
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-bold text-slate-900">Ogeysiisyada</p>
                    </div>
                    {!isLoggedIn ? (
                      <div className="px-4 py-6 text-center">
                        <Bell className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">
                          Soo gal si aad u aragto ogeysiisyadaaga.
                        </p>
                        <Link
                          to="/login"
                          onClick={() => setNotifOpen(false)}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Soo Gal <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-slate-500">Ogeysiis cusub ma jiro.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isLoggedIn ? (
                <Link
                  to="/profile"
                  className="flex-shrink-0 w-8 h-8 rounded-full ring-2 ring-white/30 overflow-hidden bg-white/15"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm font-semibold">
                      {profile.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="p-2 rounded-lg text-white/90 hover:bg-white/15 transition-colors"
                  aria-label="Login"
                >
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              )}

              {isLoggedIn && !isAdmin && (
                <div className="relative md:hidden" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                      menuOpen
                        ? 'bg-white text-emerald-700'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    <MenuIcon className="w-4 h-4" />
                    <span className="hidden xs:inline">Menu</span>
                  </button>
                  {menuOpen && (
                    <div
                      className="absolute end-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden origin-top-right"
                      style={{ animation: 'menuSlideIn 0.18s ease-out' }}
                    >
                      {mobileNavItems.map((item, i) => {
                        const Icon = item.icon;
                        const active =
                          location.pathname === item.to ||
                          (item.to === '/chat' && location.pathname.startsWith('/chat'));
                        return (
                          <Link
                            key={i}
                            to={item.to}
                            onClick={() => setMenuOpen(false)}
                            className={`relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                              active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`}
                            />
                            <span className="flex-1">{item.label}</span>
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
      </header>

      {/* Hero section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Somali couple"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/85 via-emerald-800/75 to-teal-800/80" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 lg:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur text-emerald-50 text-xs font-semibold mb-5 ring-1 ring-white/20">
              <Heart className="w-3.5 h-3.5 text-rose-300" />
              Adeegga isbarashada guurka
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Hel Qofka Kugu Habboon{' '}
              <span className="inline-block text-rose-300">❤️</span>
            </h1>
            <p className="text-base sm:text-lg text-emerald-50/90 mt-5 leading-relaxed max-w-xl">
              La kulan dad cusub, samee xiriir wanaagsan, oo hel qofka aad nolosha
              la wadaagi karto.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-8">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 font-bold text-base px-7 py-4 rounded-2xl shadow-xl hover:bg-emerald-50 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Isdiiwaangeli — $1
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 text-white font-semibold text-base px-7 py-4 rounded-2xl border-2 border-white/30 backdrop-blur hover:bg-white/10 transition-all"
              >
                <LogIn className="w-5 h-5" />
                Soo Gal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TrustItem icon={Lock} text="Asturnaantaada waa muhiim" />
            <TrustItem icon={Users} text="Xubno Soomaaliyeed" />
            <TrustItem icon={Shield} text="Ammaan iyo Xiriir la isku halleyn karo" />
          </div>
        </div>
      </section>

      {/* Search section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Raadi Qof Kugu Habboon
          </h2>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">
            Ku raadi magaca qofka aad doonayso.
          </p>
        </div>
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Geli magaca qofka..."
              className="w-full pl-12 pr-32 py-4 rounded-2xl border-2 border-slate-200 text-sm sm:text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
            />
            <button
              type="submit"
              className="absolute right-2 inline-flex items-center gap-1.5 bg-emerald-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
            >
              Raadi
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </section>

      {/* New Members section */}
      {newMembers.length > 0 && (
        <section className="bg-white border-y border-slate-100 py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Xubnaha Cusub
              </h2>
              <Link
                to="/members"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Arag Dhammaan <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {newMembers.map((member) => (
                <NewMemberCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick feature cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickCard
            icon={Search}
            title="Raadi Qof"
            description="Raadi qof kugu habboon."
            tint="bg-emerald-50 text-emerald-700"
            ring="ring-emerald-100"
            to="/members"
          />
          <QuickCard
            icon={Users}
            title="La Kulan Xubno"
            description="Baro xubnaha Team Calafdoon."
            tint="bg-teal-50 text-teal-700"
            ring="ring-teal-100"
            to="/social"
          />
          <QuickCard
            icon={MessageCircle}
            title="Isgaarsii"
            description="La xiriir qofka aad xiisaynayso."
            tint="bg-amber-50 text-amber-700"
            ring="ring-amber-100"
            to="/chat"
          />
        </div>
      </section>

      {/* Story section */}
      <PublicStoriesCarousel />

      {/* Advertisement section */}
      <AdvertisementSection />

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2 text-center">
          Sida Ay Shaqeyso
        </h2>
        <p className="text-center text-slate-500 text-sm mb-8">
        Arag tallaabada jidka oo dhan si aad u bilowdo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HowItWorksStep
            icon={UserPlus}
            num={1}
            title="Isdiiwaangeli"
            description="Buuxi form-ka diiwaangelinta oo abuur akoon."
            tint="from-emerald-500 to-teal-600"
          />
          <HowItWorksStep
            icon={DollarSign}
            num={2}
            title="Bixi $1"
            description="Bixi lacagta diiwaangelinta $1 oo soo geli screenshot-ka."
            tint="from-teal-500 to-cyan-600"
          />
          <HowItWorksStep
            icon={ShieldCheck}
            num={3}
            title="Sug oggolaanshaha"
            description="Maamulaha ayaa dib-u-eegi doonaa codsigaaga."
            tint="from-amber-500 to-orange-600"
          />
          <HowItWorksStep
            icon={MessageCircle}
            num={4}
            title="Raadi qof oo la xiriir"
            description="Marka la ansixiyo, raadi qof oo bilow xiriir."
            tint="from-rose-500 to-pink-600"
          />
        </div>
      </section>

      {/* Trust & Safety section */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/25 mb-4">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Asturnaantaada waa muhiim
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SafetyItem
              icon={Lock}
              text="Xogtaada si ammaan ah ayaa loo ilaaliyaa"
            />
            <SafetyItem
              icon={Users}
              text="Kaliya xogta aad ogolaato ayaa la wadaagayaa"
            />
            <SafetyItem
              icon={Ban}
              text="Report & Block ayaa diyaar ah"
            />
            <SafetyItem
              icon={Heart}
              text="Waxaan mudnaanta siinaynaa xiriir dhab ah iyo ixtiraam"
            />
          </div>
        </div>
      </section>

      {/* Statistics section */}
      {stats && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <StatCard
              icon={UserCheck}
              value={stats.approved_count}
              label="Xubno la ansixiyay"
              tint="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={Heart}
              value={stats.connection_count}
              label="Isbarashooyin"
              tint="bg-rose-50 text-rose-600"
            />
            <StatCard
              icon={Sparkles}
              value={stats.new_this_month}
              label="Xubnaha cusub"
              tint="bg-amber-50 text-amber-600"
            />
          </div>
        </section>
      )}

      {/* Testimonials section — only if testimonials exist */}
      {testimonials.length > 0 && (
        <section className="bg-white border-y border-slate-100 py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-6 text-center">
              Aragtida Xubnaha
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="relative rounded-3xl overflow-hidden shadow-xl">
          <img
            src={BANNER_IMAGE}
            alt="Romantic sunset"
            className="w-full h-56 sm:h-72 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/90 via-emerald-800/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-snug max-w-md">
              Qofka aad raadinayso wuxuu noqon karaa hal tallaabo oo kuu dhow.
            </h2>
            <Link
              to="/register"
              className="mt-4 inline-flex items-center gap-2 bg-white text-emerald-700 font-bold text-sm sm:text-base px-5 py-3 rounded-2xl shadow-lg hover:bg-emerald-50 hover:scale-[1.02] active:scale-95 transition-all w-fit"
            >
              Soo Bilow Safarkaaga
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* WhatsApp contact banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-2xl shadow-md overflow-hidden">
          <div className="px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-lg font-bold text-white mb-0.5 flex items-center justify-center sm:justify-start gap-2">
                <MessageCircle className="w-5 h-5" />
                Nala soo xiriir WhatsApp
              </h2>
              <p className="text-white/90 text-sm leading-snug">
                Haddii aad qabto wax su'aal ah ama aad u baahan tahay caawimaad,
                nagala soo xiriir WhatsApp.
              </p>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-[#128C7E] font-bold text-base px-5 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.371-1.249-.508-1.683-.137-.434-.275-.371-.371-.371-.099 0-.223-.012-.371-.012-.149 0-.371.05-.569.248-.198.198-.767.767-.767 1.862 0 1.097.796 2.158.907 2.309.112.149 1.581 2.419 3.83 3.39.536.231.954.371 1.281.476.539.173 1.029.149 1.416.091.432-.065 1.333-.544 1.521-1.069.187-.524.187-.973.131-1.067-.056-.094-.198-.149-.495-.248zm-5.374 7.408h-.011c-1.728 0-3.429-.464-4.904-1.341l-.351-.208-3.643.956.973-3.551-.229-.364c-.965-1.532-1.475-3.307-1.475-5.139 0-4.515 3.676-8.191 8.191-8.191 2.187 0 4.244.853 5.786 2.401 1.542 1.542 2.391 3.599 2.391 5.786-.001 4.515-3.677 8.191-8.191 8.191zm6.969-15.241c-1.862-1.862-4.337-2.886-6.969-2.886-5.435 0-9.861 4.426-9.861 9.861 0 1.738.454 3.437 1.316 4.935l-1.399 5.111 5.226-1.372c1.443.787 3.068 1.203 4.718 1.203h.011c5.435 0 9.861-4.426 9.861-9.861 0-2.632-1.024-5.107-2.886-6.969z" />
              </svg>
              WhatsApp nagala soo xiriir
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Team Calafdoon</p>
          <p className="mt-1">Adeegga isbarashada guurka — Isku Xir Qoyas Farxad Leh</p>
        </div>
      </footer>
    </div>
  );
}

function TrustItem({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-3 justify-center sm:justify-start">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-emerald-600" />
      </div>
      <span className="text-sm font-medium text-slate-700">{text}</span>
    </div>
  );
}

function QuickCard({
  icon: Icon,
  title,
  description,
  tint,
  ring,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tint: string;
  ring: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className={`group bg-white rounded-2xl shadow-sm ring-1 ${ring} p-5 hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all`}
    >
      <div className={`w-12 h-12 rounded-xl ${tint} flex items-center justify-center mb-3`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-slate-900 mb-1 text-base">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 group-hover:gap-2 transition-all">
        Arag <ArrowRight className="w-4 h-4" />
      </div>
    </Link>
  );
}

function NewMemberCard({ member }: { member: NewMember }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/profile/${member.id}`)}
      className="group bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
    >
      <div className="flex flex-col items-center text-center">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.full_name}
            className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100 mb-3 group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-2xl font-bold text-emerald-700 mb-3">
            {member.full_name.charAt(0).toUpperCase()}
          </div>
        )}
        <h3 className="font-semibold text-slate-900 truncate w-full">{member.full_name}</h3>
        {member.city && (
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Home className="w-3 h-3" />
            {member.city}
          </p>
        )}
        {member.marital_status && MARITAL_LABELS[member.marital_status] && (
          <span className="mt-2 inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            {MARITAL_LABELS[member.marital_status]}
          </span>
        )}
        {member.bio && (
          <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">{member.bio}</p>
        )}
        <button className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold py-2 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          Arag Profiilka
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function HowItWorksStep({
  icon: Icon,
  num,
  title,
  description,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  num: number;
  title: string;
  description: string;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tint} flex items-center justify-center mb-3 shadow-sm`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
          {num}
        </span>
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed pl-8">{description}</p>
    </div>
  );
}

function SafetyItem({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-4 ring-1 ring-white/15">
      <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-sm text-emerald-50 font-medium leading-relaxed">{text}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
      <div className={`w-14 h-14 rounded-2xl ${tint} flex items-center justify-center mx-auto mb-3`}>
        <Icon className="w-7 h-7" />
      </div>
      <p className="text-3xl font-extrabold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 font-medium mt-1">{label}</p>
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const name = testimonial.display_name || testimonial.full_name;
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        {testimonial.avatar_url ? (
          <img
            src={testimonial.avatar_url}
            alt={name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-900 text-sm">{name}</p>
        </div>
      </div>
      <div className="flex gap-0.5 mb-2">
        {[...Array(5)].map((_, i) => (
          <Heart key={i} className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
        ))}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{testimonial.content}</p>
    </div>
  );
}
