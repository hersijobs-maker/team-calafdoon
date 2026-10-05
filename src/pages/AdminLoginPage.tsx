import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { getInactivityLogoutMessage, clearInactivityLogoutMessage } from '@/lib/useInactivityTimeout';
import { Mail, Lock, Loader2, Shield, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { signIn, session, profile, loading: authLoading } = useAuth();
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inactivityMessage, setInactivityMessage] = useState<string | null>(null);

  useEffect(() => {
    const msg = getInactivityLogoutMessage();
    if (msg) {
      setInactivityMessage(msg);
      clearInactivityLogoutMessage();
    }
  }, []);

  useEffect(() => {
    if (!authLoading && session && profile?.is_admin) {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, session, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      show('Fadlan geli emailka iyo erayga sirta ah', 'error');
      return;
    }

    setLoading(true);
    setInactivityMessage(null);
    clearInactivityLogoutMessage();

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

    if (!access.is_admin) {
      show('Akoonkan ma waa maamul. Fadlan isticmaal bogga galitaanka caadiga ah.', 'error');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    show('Soo dhawoow, maamul!', 'success');
    navigate('/admin', { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-900/50">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Maamul Soo Gal</h1>
          <p className="text-slate-400 mt-2 text-sm">Galitaanka maamulka Team Calafdoon</p>
        </div>

        {inactivityMessage && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3 text-blue-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{inactivityMessage}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="admin@teamcalafdoon.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Erayga Sirta ah</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Eraygaaga sirta ah"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Soo galinta...
              </>
            ) : (
              'Soo Gal Maamul'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/admin/reset"
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Ma xirtay erayga sirta ah? Beddel halkan
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/admin/setup"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Abuur akoonka maamul ee ugu horreeya
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Soo gal akoonka caadiga ah
          </Link>
        </div>
      </div>
    </div>
  );
}
