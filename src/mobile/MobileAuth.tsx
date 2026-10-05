import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/lib/language-context';
import { Loader2, Heart, Mail, Lock, User, Phone, ArrowLeft } from 'lucide-react';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from '@/lib/constants';

export function MobileAuth() {
  const navigate = useNavigate();
  const { show } = useToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '',
    age: '', gender: '', country: '', city: '', marital_status: '', bio: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.toLowerCase(),
      password: form.password,
    });
    if (error) {
      show(error.message.includes('Invalid') ? 'Email ama erayga sirta ah waa khalad' : error.message, 'error');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.toLowerCase(),
      password: form.password,
      options: {
        data: {
          full_name: form.full_name, phone: form.phone, age: form.age,
          gender: form.gender, country: form.country, city: form.city,
          marital_status: form.marital_status, bio: form.bio,
        },
      },
    });
    if (error) {
      show(error.message, 'error');
      setLoading(false);
      return;
    }
    if (data.user) {
      show('Codsigaaga waa la diray. Fadlan sug inta maamulka uu kuu ansixinayo.', 'success');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12">
        <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-4 ring-1 ring-white/20">
          <Heart className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Team Calafdoon</h1>
        <p className="text-emerald-100/80 text-sm mt-1">Isku Xir Qoyas Farxad Leh</p>
      </div>

      {/* Auth card */}
      <div className="bg-white rounded-t-3xl px-6 pt-6 pb-8 shadow-2xl">
        {/* Tab switcher */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t('login.title')}
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t('register.title')}
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <InputField icon={<Mail className="w-5 h-5" />} placeholder={t('login.email')} value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            <InputField icon={<Lock className="w-5 h-5" />} placeholder={t('login.password')} value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.submit')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <InputField icon={<User className="w-5 h-5" />} placeholder={t('register.fullName')} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <InputField icon={<Mail className="w-5 h-5" />} placeholder={t('register.email')} value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            <InputField icon={<Phone className="w-5 h-5" />} placeholder={t('register.phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
            <InputField icon={<Lock className="w-5 h-5" />} placeholder={t('register.password')} value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
            <div className="grid grid-cols-2 gap-3">
              <InputField icon={<User className="w-5 h-5" />} placeholder="Da'da" value={form.age} onChange={(v) => setForm({ ...form, age: v })} type="number" />
              <SelectField value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} placeholder="Jinsiga" options={GENDER_OPTIONS.map(g => ({ value: g.value, label: g.label_so }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField placeholder="Dalka" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              <InputField placeholder="Magaalada" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            </div>
            <SelectField value={form.marital_status} onChange={(v) => setForm({ ...form, marital_status: v })} placeholder="Xaaladaha Guurka" options={MARITAL_STATUS_OPTIONS.map(m => ({ value: m.value, label: m.label_so }))} />
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Waa la dirayaa...</> : <><Heart className="w-5 h-5" /> Diiwaangeli</>}
            </button>
            <p className="text-xs text-slate-400 text-center">Diiwaangelintu waa $1. Markaad diiwaan gasho, lacagta bixi kadibna soo geli screenshot-ka.</p>
          </form>
        )}

        <button onClick={() => navigate('/')} className="w-full text-center text-sm text-slate-500 mt-4 flex items-center justify-center gap-1">
          <ArrowLeft className="w-4 h-4" /> website-ka u laabo
        </button>
      </div>
    </div>
  );
}

function InputField({ icon, placeholder, value, onChange, type = 'text' }: {
  icon?: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="relative">
      {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">{icon}</div>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all`}
      />
    </div>
  );
}

function SelectField({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all appearance-none"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
