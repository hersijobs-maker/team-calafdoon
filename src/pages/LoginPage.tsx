import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { getInactivityLogoutMessage, clearInactivityLogoutMessage } from '@/lib/useInactivityTimeout';
import { useLanguage } from '@/lib/language-context';
import {
  Mail, Lock, Loader2, Heart, AlertCircle, Clock, XCircle, Ban, Eye, EyeOff,
  Users, ShieldCheck, Zap, LogIn, UserPlus,
} from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, session, profile, loading: authLoading } = useAuth();
  const { show } = useToast();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'pending' | 'rejected' | 'blocked' | 'inactivity';
    text: string;
  } | null>(null);



  useEffect(() => {
    const savedEmail = localStorage.getItem('calafdoon_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const inactivityMessage = getInactivityLogoutMessage();
    if (inactivityMessage) {
      setStatusMessage({ type: 'inactivity', text: inactivityMessage });
      clearInactivityLogoutMessage();
    }
  }, []);

  useEffect(() => {
    if (!authLoading && session && profile) {
      if (profile.is_admin) {
        navigate('/admin', { replace: true });
      } else if (profile.registration_status === 'approved') {
        navigate('/social', { replace: true });
      } else if (profile.registration_status === 'pending_approval' || profile.registration_status === 'rejected' || profile.registration_status === 'blocked') {
        navigate('/pending-approval', { replace: true });
      }
    }
  }, [authLoading, session, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      show(t('login.error'), 'error');
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    clearInactivityLogoutMessage();

    if (rememberMe) {
      localStorage.setItem('calafdoon_remember_email', email.toLowerCase());
    } else {
      localStorage.removeItem('calafdoon_remember_email');
    }

    const { error } = await signIn(email.toLowerCase(), password);

    if (error) {
      show(error, 'error');
      setLoading(false);
      return;
    }

    const { data: accessData } = await supabase.rpc('my_login_access');

    if (!accessData || accessData.length === 0) {
      show('Lama soo gelin karin. Fadlan xaqiiji macluumaadka.', 'error');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const access = accessData[0];

    if (access.is_admin) {
      show('Soo dhawoow, maamul!', 'success');
      navigate('/admin', { replace: true });
      setLoading(false);
      return;
    }

    if (access.registration_status === 'blocked') {
      setStatusMessage({
        type: 'blocked',
        text: 'Akoonkaaga waa la xannibay.',
      });
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (access.registration_status === 'pending_approval') {
      setStatusMessage({
        type: 'pending',
        text: 'Diiwaangelintaada waa sugaysa ansaxinta maamulaha.',
      });
      navigate('/pending-approval', { replace: true });
      setLoading(false);
      return;
    }

    if (access.registration_status === 'rejected') {
      setStatusMessage({
        type: 'rejected',
        text: 'Diiwaangelintaada waa la diiday.',
      });
      navigate('/pending-approval', { replace: true });
      setLoading(false);
      return;
    }

    if (access.can_login) {
      show('Soo dhawoow!', 'success');
      navigate('/social', { replace: true });
      setLoading(false);
    }
  };

  const features = [
    { icon: Users, title: 'La wadaag', desc: 'Sheekooyinkaaga' },
    { icon: ShieldCheck, title: 'Amaan', desc: 'Xogtaada waa la ilaaliyaa' },
    { icon: Heart, title: 'Bulsho', desc: 'Isku xirna dadka' },
    { icon: Zap, title: 'Fursad', desc: 'Korriinkaaga' },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* LEFT — Branding panel */}
      <div className="relative lg:w-1/2 bg-gradient-to-br from-sky-50 via-emerald-50 to-white flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-200/30 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-200/25 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4" />

        {/* Logo + tagline */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-xl">Team Calafdoon</span>
          </Link>
          <p className="text-sm font-medium text-emerald-700/80 tracking-wide">
            Bulsho Isku Xiran, Mustaqbal Wanaagsan
          </p>
        </div>

        {/* Headline + description */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-md py-6">
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-900 leading-tight tracking-tight">
            Ku Soo Dhawoow
            <br />
            <span className="text-emerald-600">Team Calafdoon</span>
          </h1>
          <p className="text-slate-600 mt-4 leading-relaxed text-sm sm:text-base">
            Waa bulsho online ah oo isku xirta dadka, dhiirrigelisa wadajirka,
            una abuurta meel ammaan ah oo la wadaago sheekooyinka nololsha.
          </p>

          {/* Features 2x2 grid */}
          <div className="grid grid-cols-2 gap-3 mt-7">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white/70 backdrop-blur-sm rounded-xl border border-emerald-100/60 p-3.5 flex items-start gap-3"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                  <f.icon className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight">{f.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10">
          <p className="text-slate-400 text-sm italic font-light tracking-wide">
            Nolol Wanaagsan — Waa Bulsho Wanaagsan
          </p>
        </div>
      </div>

      {/* RIGHT — Login card */}
      <div className="lg:w-1/2 bg-gradient-to-br from-slate-50 to-emerald-50/40 flex items-center justify-center px-5 py-6 sm:px-8 sm:py-10">
        <div className="w-full max-w-[480px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-5">
            <Link to="/" className="inline-flex items-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-xl">Team Calafdoon</span>
            </Link>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
            {/* Desktop mini-logo */}
            <div className="hidden lg:flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Team Calafdoon</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">{t('login.title')}</h2>
            <p className="text-slate-500 text-sm mt-1.5">
              Fadlan gal akoonkaaga si aad u sii wado.
            </p>

            {statusMessage && (
              <div
                className={`mt-4 rounded-xl border p-3.5 flex items-start gap-3 ${
                  statusMessage.type === 'pending'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : statusMessage.type === 'rejected'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : statusMessage.type === 'inactivity'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-gray-800 border-gray-900 text-white'
                }`}
              >
                {statusMessage.type === 'pending' && <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                {statusMessage.type === 'rejected' && <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                {statusMessage.type === 'blocked' && <Ban className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                {statusMessage.type === 'inactivity' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <p className="text-sm font-medium">{statusMessage.text}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('login.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                    placeholder="example@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                    placeholder="Erayga sirta ah"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Furaha qarsoodka ah' : 'Soo daa furaha qarsoodka'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me + forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm text-slate-600">I xasuuso</span>
                </label>
                <span className="text-sm text-slate-400 cursor-default" title="Haddii erayga sirta ah illoowday, la xidhiidh maamulaha.">
                  Erayga sirta ah illoowday?
                </span>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-1 shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Soo galinta...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    {t('login.submit')}
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-medium text-slate-400 px-1">Ama</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Register button */}
              <Link
                to="/register"
                className="w-full bg-white text-emerald-700 font-semibold py-3 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                {t('nav.register')}
              </Link>

              <p className="text-center text-sm text-slate-500 pt-1">
                {t('login.noAccount')}{' '}
                <Link to="/register" className="text-emerald-700 font-semibold hover:underline">
                  {t('nav.register')}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
