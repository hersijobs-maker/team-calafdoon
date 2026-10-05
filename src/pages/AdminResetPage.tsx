import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, KeyRound, Loader2, Shield, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export function AdminResetPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [resetKey, setResetKey] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetKey.trim() || !email.trim() || !newPassword) {
      show('Fadlan buuxi dhammaan field-yada', 'error');
      return;
    }
    if (newPassword.length < 8) {
      show('Erayga sirta ah waa in uu noqdaa 8 xaraf ama ka badan', 'error');
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc('reset_admin_password', {
      p_reset_key: resetKey.trim(),
      p_email: email.toLowerCase().trim(),
      p_new_password: newPassword,
    });

    if (error) {
      show(error.message || 'Lama beddelin erayga sirta ah', 'error');
      setLoading(false);
      return;
    }

    setSuccess(true);
    show('Erayga sirta ah ee maamulka waa la beddelmay!', 'success');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-900/50">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Beddel Erayga Sirta ah ee Maamul</h1>
          <p className="text-slate-400 mt-2 text-sm">Beddel erayga sirta ah ee akoonka maamulka</p>
        </div>

        {success ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">Erayga sirta ah waa la beddelmay!</p>
            <p className="text-slate-400 text-sm mb-6">
              Hadda waxaad gal kartaa bogga maamulka erayga sirta ah ee cusub.
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Furaha Beddelka (Reset Key)</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={resetKey}
                  onChange={(e) => setResetKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Furahaaga beddelka"
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Emailka Maamul</label>
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Erayga Sirta ah Cusub (8+ xaraf)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Erayga sirta ah ee cusub"
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
                  Beddelka...
                </>
              ) : (
                'Beddel Erayga Sirta ah'
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Soo gal maamul
          </Link>
        </div>
      </div>
    </div>
  );
}
