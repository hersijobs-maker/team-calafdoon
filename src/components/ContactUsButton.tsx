import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, X, Send, Loader2, Phone, MessageSquare, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';

const CONTACT_INFO = {
  phone: '+252 61 6246852',
  email: 'teamcalafdoon@gmail.com',
};

export function ContactUsButton() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname.startsWith('/chat')) return null;

  const isMobile = location.pathname.startsWith('/m');

  if (isMobile) {
    return null;
  }

  return (
    <button
      onClick={() => navigate('/contact')}
      aria-label="Nala Soo Xiriir"
      className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 shadow-lg shadow-emerald-900/20 hover:scale-110 active:scale-95 transition-transform"
    >
      <Mail className="w-6 h-6 text-white" />
    </button>
  );
}

export function ContactUsPage() {
  const { show } = useToast();
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: profile?.full_name || '',
    email: profile?.email || session?.user?.email || '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      show('Fadlan buuxi dhammaan meelaha', 'error');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('contact_messages').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
      user_id: session?.user?.id || null,
    });
    if (error) {
      show('Khalad ayaa dhacay. Fadlan isku day mar kale.', 'error');
      setSubmitting(false);
      return;
    }
    show('Fariintaada waa la diray! Maamulaha wuu kuu jawaabi doonaa.', 'success');
    setForm({ ...form, subject: '', message: '' });
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500" />
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <button onClick={() => navigate(-1)} className="text-slate-500 text-sm mb-6 flex items-center gap-1 hover:text-slate-700">
          <X className="w-4 h-4" /> Dhaaf
        </button>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center mb-4 shadow-lg mx-auto">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Nala Soo Xiriir</h1>
          <p className="text-slate-600 mt-2">Su'aalahaaga, talooyinkaaga ama cabirkaaga naga wadaagal.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <a href={`tel:${CONTACT_INFO.phone}`} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Telefoon</p>
              <p className="text-sm font-bold text-slate-900">{CONTACT_INFO.phone}</p>
            </div>
          </a>
          <a href={`mailto:${CONTACT_INFO.email}`} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Email</p>
              <p className="text-sm font-bold text-slate-900">{CONTACT_INFO.email}</p>
            </div>
          </a>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl shadow-emerald-900/5 border border-slate-100 p-6 sm:p-9 space-y-5">
          <ContactField icon={<UserIcon className="w-5 h-5" />} label="Magacaaga" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Magacaaga buuxa" />
          <ContactField icon={<Mail className="w-5 h-5" />} label="Email ama Telefoon" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="email@example.com" type="text" />
          <ContactField icon={<MessageSquare className="w-5 h-5" />} label="Mawduuca" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="Mawduuca fariinta" />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Fariinta</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all min-h-[120px] resize-y"
              placeholder="Fariintaada halkan ku qor..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Dir Fariinta</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function ContactField({ icon, label, value, onChange, placeholder, type = 'text' }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">{icon}</div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
        />
      </div>
    </div>
  );
}
