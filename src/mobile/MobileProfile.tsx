import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useToast } from '@/components/Toast';
import {
  Camera, Edit3, LogOut, Globe, ChevronRight, X, Check,
  User, Mail, Phone, Calendar, Heart, Home, Briefcase, Loader2, MessageSquare,
} from 'lucide-react';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from '@/lib/constants';
import type { Language } from '@/lib/translations';

interface Props {
  onContactUs: () => void;
}

export function MobileProfile({ onContactUs }: Props) {
  const { profile, signOut, refreshProfile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
    phone: profile?.phone || '',
    city: profile?.city || '',
    country: profile?.country || '',
    profession: profile?.profession || '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (file: File) => {
    if (!profile?.id) return;
    if (file.size > 5 * 1024 * 1024) { show('Sawirku waa inuu noqdaa in ka yar 5MB', 'error'); return; }
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { show('Lama soo gali karo sawirka', 'error'); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id);
    refreshProfile();
    show('Sawirka waa la bedelay', 'success');
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editForm.full_name,
      bio: editForm.bio || null,
      phone: editForm.phone,
      city: editForm.city || null,
      country: editForm.country || null,
      profession: editForm.profession || null,
    }).eq('id', profile.id);
    if (error) { show('Lama kaydin isbedelka', 'error'); }
    else { show('Isbedelka waa la kaydiyay', 'success'); refreshProfile(); setEditing(false); }
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (editing) {
    return (
      <div className="min-h-full bg-slate-50">
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
          <button onClick={() => setEditing(false)} className="text-slate-600"><X className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold text-slate-900">Tafatiir</h1>
          <button onClick={handleSave} disabled={saving} className="text-emerald-600 font-semibold text-sm">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          </button>
        </div>
        <div className="p-4 space-y-4">
          <EditField label="Magaca" value={editForm.full_name} onChange={(v) => setEditForm({ ...editForm, full_name: v })} />
          <EditField label="Telefoonka" value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} />
          <EditField label="Magaalada" value={editForm.city} onChange={(v) => setEditForm({ ...editForm, city: v })} />
          <EditField label="Dalka" value={editForm.country} onChange={(v) => setEditForm({ ...editForm, country: v })} />
          <EditField label="Xirfadeynta" value={editForm.profession} onChange={(v) => setEditForm({ ...editForm, profession: v })} />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Fahfahin</label>
            <textarea
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px] resize-y"
              placeholder="Sheeg wax kasta oo ku saabsan naftaada..."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-gradient-to-br from-emerald-700 to-teal-700 px-4 pt-6 pb-20 relative">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-white font-bold text-lg">{t('nav.profile')}</h1>
          <button onClick={() => setEditing(true)} className="bg-white/15 backdrop-blur p-2 rounded-lg">
            <Edit3 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-16 relative">
        <div className="flex flex-col items-center">
          <div className="relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 border-4 border-white shadow-lg flex items-center justify-center text-2xl font-bold text-emerald-700">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center border-2 border-white shadow-md"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarChange(e.target.files[0])} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-3">{profile?.full_name}</h2>
          <p className="text-sm text-slate-500">{profile?.city ? profile.city + ', ' : ''}{profile?.country || ''}</p>
          {profile?.is_admin && (
            <span className="mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Maamulaha</span>
          )}
        </div>
      </div>

      <div className="px-4 mt-6 space-y-3">
        {profile?.bio && (
          <InfoCard label="Fahfahin" value={profile.bio} />
        )}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          {profile?.email && <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile.email} />}
          {profile?.phone && <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefoon" value={profile.phone} />}
          {profile?.age && <InfoRow icon={<Calendar className="w-4 h-4" />} label="Da'da" value={`${profile.age} sano`} />}
          {profile?.gender && <InfoRow icon={<User className="w-4 h-4" />} label="Jinsiga" value={GENDER_OPTIONS.find(g => g.value === profile.gender)?.label_so || profile.gender} />}
          {profile?.marital_status && <InfoRow icon={<Heart className="w-4 h-4" />} label="Xaaladaha" value={MARITAL_STATUS_OPTIONS.find(m => m.value === profile.marital_status)?.label_so || profile.marital_status} />}
          {profile?.profession && <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Xirfadeynta" value={profile.profession} />}
        </div>
      </div>

      <div className="px-4 mt-6 pb-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Beegaha</h3>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-50">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 flex-1">Luqadda</span>
            </div>
            <div className="flex gap-2">
              {(['so', 'en', 'ar'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    language === lang ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {lang === 'so' ? 'Soomaali' : lang === 'en' ? 'English' : 'العربية'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onContactUs}
            className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 flex-1 text-left">Nala Soo Xiriir</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition-colors border-t border-slate-50"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-red-600 flex-1 text-left">Ka Bax</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</p>
      <p className="text-sm text-slate-700 leading-relaxed">{value}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}
