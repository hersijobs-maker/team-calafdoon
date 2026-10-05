import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, KeyRound, Loader2, Shield, Eye, EyeOff, CheckCircle2, User } from 'lucide-react';

export function AdminSetupPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [setupKey, setSetupKey] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupKey.trim() || !fullName.trim() || !email.trim() || !password) {
      show('Fadlan buuxi dhammaan field-yada', 'error');
      return;
    }
    if (password.length < 8) {
      show('Erayga sirta ah waa in uu noqdaa 8 xaraf ama ka badan', 'error');
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc('create_first_admin', {
      p_setup_key: setupKey.trim(),
      p_email: email.toLowerCase().trim(),
      p_password: password,
      p_full_name: fullName.trim(),
    });

    if (error) {
      show(error.message || 'Lama abuurin akoonka maamul', 'error');
      setLoading(false);
      return;
    }

    setSuccess(true);
    show('Akoonka maamulka waa la abuuray!', 'success');
    setLoading(false);
  };

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-900/50">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Abuur Akoonka Maamul</h1>
          <p className="text-slate-400 mt-2 text-sm">Degdeg akoonkaaga maamul ee ugu horreeya</p>
        </div>

        {success ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">Akoonka maamulka waa la abuuray!</p>
            <p className="text-slate-400 text-sm mb-6">
              Hadda waxaad gal kartaa bogga maamulka.
            </p>
            <button
              onClick={() => navigate('/admin/login')}
              className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-500 transition-colors"
            >
              Soo Gal Maamul
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8 space-y-5"
          >
            <div>
              <label className={labelClass}>Furaha Deegganka (Setup Key)</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  className={inputClass}
                  placeholder="Furahaaga deegganka"
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Magaca Buuxa</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Magacaaga buuxa"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="admin@teamcalafdoon.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Erayga Sirta ah (8+ xaraf)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Eraygaaga sirta ah"
                  autoComplete="new-password"
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
                  Abuurista...
                </>
              ) : (
                'Abuur Akoonka Maamul'
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Shield className="w-4 h-4" />
            Soo gal maamul
          </Link>
        </div>
      </div>
    </div>
  );
}
