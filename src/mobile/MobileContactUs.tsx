import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { Mail, X, Send, Loader2, Phone, MessageSquare, User as UserIcon, ArrowLeft } from 'lucide-react';

const CONTACT_INFO = {
  phone: '+252 61 6246852',
  email: 'teamcalafdoon@gmail.com',
};

export function MobileContactUs({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const { profile, session } = useAuth();
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
    show('Fariintaada waa la diray!', 'success');
    setForm({ ...form, subject: '', message: '' });
    setSubmitting(false);
    onBack();
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
        <button onClick={onBack} className="p-1">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Nala Soo Xiriir</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <a href={`tel:${CONTACT_INFO.phone}`} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Telefoon</p>
              <p className="text-sm font-bold text-slate-900">{CONTACT_INFO.phone}</p>
            </div>
          </a>
          <a href={`mailto:${CONTACT_INFO.email}`} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-sm font-bold text-slate-900">{CONTACT_INFO.email}</p>
            </div>
          </a>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <MobileField icon={<UserIcon className="w-5 h-5" />} label="Magacaaga" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Magacaaga buuxa" />
          <MobileField icon={<Mail className="w-5 h-5" />} label="Email ama Telefoon" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="email@example.com" />
          <MobileField icon={<MessageSquare className="w-5 h-5" />} label="Mawduuca" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="Mawduuca" />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Fariinta</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all min-h-[100px] resize-y"
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

function MobileField({ icon, label, value, onChange, placeholder }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10">{icon}</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
        />
      </div>
    </div>
  );
}
