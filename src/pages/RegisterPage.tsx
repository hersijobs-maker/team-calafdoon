import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  User, Mail, Phone, Lock, FileText, Upload, Loader2, Heart,
  Calendar, Users, Globe, Home, HeartHandshake, DollarSign, Image as ImageIcon,
} from 'lucide-react';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from '@/lib/constants';
import { useLanguage } from '@/lib/language-context';

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  age: string;
  gender: string;
  country: string;
  city: string;
  marital_status: string;
  bio: string;
  looking_for: string;
  avatar: File | null;
}

const initialForm: FormData = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  age: '',
  gender: '',
  country: '',
  city: '',
  marital_status: '',
  bio: '',
  looking_for: '',
  avatar: null,
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const { t } = useLanguage();
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | undefined>(undefined);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.full_name.trim()) e.full_name = 'Magaca buuxa ayaa loo baahan yahay';
    if (!form.email.trim()) e.email = 'Emailka ayaa loo baahan yahay';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Fomka emailka khalad ayaa';
    if (!form.phone.trim()) e.phone = 'Lambarka telefoonka ayaa loo baahan yahay';
    else if (form.phone.replace(/\D/g, '').length < 7) e.phone = 'Lambarka telefoonka khalad ayaa';
    if (!form.password) e.password = 'Erayga sirta ah ayaa loo baahan yahay';
    else if (form.password.length < 8) e.password = 'Erayga sirta ah waa inuu noqdaa ugu yaraan 8 xaraf';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Erayada sirta ah isma waafaqaan';
    if (!form.age) e.age = "Da'da ayaa loo baahan yahay";
    else if (!/^\d+$/.test(form.age)) e.age = "Da'da waa inuu noqdaa lambar buuxa (tusaale: 25)";
    else if (Number(form.age) < 18) e.age = 'Waa inaad noqotaa 18 sano jir';
    else if (Number(form.age) > 120) e.age = "Da'da khalad ayaa";
    if (!form.gender) e.gender = 'Jinsiga ayaa loo baahan yahay';
    if (!form.country.trim()) e.country = 'Dalka ayaa loo baahan yahay';
    if (!form.city.trim()) e.city = 'Magaalada ayaa loo baahan yahay';
    if (!form.marital_status) e.marital_status = 'Xaaladaha guurka ayaa loo baahan yahay';
    if (!paymentScreenshot) setScreenshotError('Fadlan marka hore soo geli screenshot-ka lacag bixinta $1.');
    else setScreenshotError(undefined);
    setErrors(e);
    return Object.keys(e).length === 0 && !!paymentScreenshot;
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAvatarChange = (file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        show('Sawirka waa inuu noqdaa in ka yar 5MB', 'error');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        show('Sawirku waa inuu noqdaa JPEG, PNG, WebP ama GIF', 'error');
        return;
      }
      setForm((prev) => ({ ...prev, avatar: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleScreenshotChange = (file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        show('Screenshot-ka waa inuu noqdaa in ka yar 5MB', 'error');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        show('Screenshot-ku waa inuu noqdaa JPEG, PNG ama WebP', 'error');
        return;
      }
      setPaymentScreenshot(file);
      setScreenshotError(undefined);
      const reader = new FileReader();
      reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!paymentScreenshot) {
      setScreenshotError('Fadlan marka hore soo geli screenshot-ka lacag bixinta $1.');
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            phone: form.phone,
            age: form.age,
            gender: form.gender,
            country: form.country,
            city: form.city,
            marital_status: form.marital_status,
            looking_for: form.looking_for,
            bio: form.bio,
          },
        },
      });

      if (authError) {
        const msg = authError.message || '';
        console.error('Signup error from Supabase:', msg);
        if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
          show('Emailkan hore ayuu diiwaan gashan. Fadlan soo gal ama isticmaal email kale.', 'error');
        } else if (msg.includes('password')) {
          show('Erayga sirta ah waa in uu noqdaa ugu yaraan 8 xaraf.', 'error');
        } else if (msg.includes('email')) {
          show('Fomka emailka khalad ayaa. Fadlan xaqiiji emailka.', 'error');
        } else if (msg.includes('rate limit') || msg.includes('security purposes') || msg.includes('60 seconds')) {
          show('Labadan isku day in ka yar. Fadlan sug 60 ilbiriqsi oo isku day mar kale.', 'error');
        } else if (msg.includes('Database error') || msg.includes('database error')) {
          show('Khalad dhanka xogta ayaa dhacay. Fadlan isku day mar kale ama la xidhiidh maamulaha.', 'error');
        } else {
          show(`Lama abuurin akoonka: ${msg}`, 'error');
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        show('Diiwaangelintu way fashilantay. Fadlan isku day mar kale.', 'error');
        setLoading(false);
        return;
      }

      let avatarUrl: string | null = null;
      if (form.avatar) {
        const fileExt = form.avatar.name.split('.').pop();
        const fileName = `${authData.user.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, form.avatar);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          phone: form.phone,
          avatar_url: avatarUrl,
          bio: form.bio || null,
          age: Number(form.age),
          gender: form.gender,
          country: form.country,
          city: form.city,
          marital_status: form.marital_status,
          looking_for: form.looking_for || null,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        show('Fahfahintaada qaar lama kaydin. Fadlan sax gadaasha aad galaysid.', 'info');
      }

      // Upload payment screenshot to payment-screenshots bucket
      const screenshotExt = paymentScreenshot.name.split('.').pop();
      const screenshotName = `${authData.user.id}/payment.${screenshotExt}`;
      const { error: screenshotUploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(screenshotName, paymentScreenshot, { upsert: true });

      if (screenshotUploadError) {
        show('Lama soo geliyo screenshot-ka lacagta. Fadlan isku day mar kale.', 'error');
        setLoading(false);
        return;
      }

      const { data: screenshotUrlData } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(screenshotName);

      // Submit payment proof — this moves user from 'draft' to 'pending_approval'
      const { error: submitError } = await supabase.rpc('submit_registration_payment', {
        p_screenshot_url: screenshotUrlData.publicUrl,
      });

      if (submitError) {
        show(submitError.message || 'Lama dhaafin caddeynta lacagta. Fadlan isku day mar kale.', 'error');
        setLoading(false);
        return;
      }

      show('Codsigaaga waa la diray. Fadlan sug inta maamulka uu kuu ansixinayo.', 'success');
      navigate('/pending-approval');
    } catch (err) {
      console.error('Registration error:', err);
      show('Khalad ayaa dhacay. Fadlan isku day mar kale.', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Decorative top band */}
      <div className="h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500" />

      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        {/* Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-2xl tracking-tight">Team Calafdoon</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('register.title')}
          </h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">
            Ku soo dhawoow Team Calafdoon{' '}
            <span className="inline-block text-rose-500">❤️</span>
            <br />
            <span className="text-slate-500">Buuxi xogtaada si aad u bilowdo.</span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-xl shadow-emerald-900/5 border border-slate-100 p-6 sm:p-9 space-y-6"
        >
          {/* Section: Avatar */}
          <SectionHeading icon={<Upload className="w-4 h-4" />} title="Sawirkaaga" />
          <div className="flex flex-col items-center -mt-2">
            <label className="cursor-pointer group">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden group-hover:border-emerald-400 group-hover:from-emerald-50 group-hover:to-teal-50 transition-all duration-300 shadow-sm">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[10px] text-slate-400 font-medium">Ku dar sawir</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs text-slate-400 mt-3">Ikhtiyaari · ugu badan 5MB · JPG, PNG, WebP</p>
          </div>

          {/* Section: Account */}
          <SectionHeading icon={<User className="w-4 h-4" />} title="Macluumaadka Akoonka" />
          <FormField label={t('register.fullName')} icon={<User className="w-4.5 h-4.5" />} error={errors.full_name}>
            <input type="text" value={form.full_name} onChange={(e) => handleChange('full_name', e.target.value)} className="reg-input" placeholder="Magacaaga buuxa" />
          </FormField>

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t('register.email')} icon={<Mail className="w-4.5 h-4.5" />} error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="reg-input" placeholder="email@tusaale.com" />
            </FormField>
            <FormField label={t('register.phone')} icon={<Phone className="w-4.5 h-4.5" />} error={errors.phone}>
              <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="reg-input" placeholder="+252 ..." />
            </FormField>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t('register.password')} icon={<Lock className="w-4.5 h-4.5" />} error={errors.password}>
              <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} className="reg-input" placeholder="Ugu yaraan 8 xaraf" />
            </FormField>
            <FormField label="Xaqiiji Erayga Sirta ah" icon={<Lock className="w-4.5 h-4.5" />} error={errors.confirmPassword}>
              <input type="password" value={form.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} className="reg-input" placeholder="Dib-u-geli erayga sirta ah" />
            </FormField>
          </div>

          {/* Section: Personal */}
          <SectionHeading icon={<Heart className="w-4 h-4" />} title="Macluumaadka Shakhsiga" />
          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label="Da'da" icon={<Calendar className="w-4.5 h-4.5" />} error={errors.age}>
              <input type="number" value={form.age} onChange={(e) => handleChange('age', e.target.value)} className="reg-input" placeholder="18" min="18" max="120" step="1" />
            </FormField>
            <FormField label="Jinsiga" icon={<Users className="w-4.5 h-4.5" />} error={errors.gender}>
              <select value={form.gender} onChange={(e) => handleChange('gender', e.target.value)} className="reg-input">
                <option value="">Dooro jinsiga</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label_so}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label="Dalka" icon={<Globe className="w-4.5 h-4.5" />} error={errors.country}>
              <input type="text" value={form.country} onChange={(e) => handleChange('country', e.target.value)} className="reg-input" placeholder="Tusaale: Soomaaliya" />
            </FormField>
            <FormField label="Magaalada" icon={<Home className="w-4.5 h-4.5" />} error={errors.city}>
              <input type="text" value={form.city} onChange={(e) => handleChange('city', e.target.value)} className="reg-input" placeholder="Tusaale: Muqdisho" />
            </FormField>
          </div>

          <FormField label="Xaaladaha Guurka" icon={<Heart className="w-4.5 h-4.5" />} error={errors.marital_status}>
            <select value={form.marital_status} onChange={(e) => handleChange('marital_status', e.target.value)} className="reg-input">
              <option value="">Dooro xaaladaha</option>
              {MARITAL_STATUS_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label_so}</option>
              ))}
            </select>
          </FormField>

          {/* Section: About */}
          <SectionHeading icon={<FileText className="w-4 h-4" />} title="Ku saabsan Adiga" />
          <FormField label="Fahfahinta kooban" icon={<FileText className="w-4.5 h-4.5" />}>
            <textarea value={form.bio} onChange={(e) => handleChange('bio', e.target.value)} className="reg-input min-h-[90px] resize-y" placeholder="Sheeg wax kasta oo ku saabsan naftaada..." />
          </FormField>

          <FormField label="Waxa aad raadinaysay" icon={<HeartHandshake className="w-4.5 h-4.5" />}>
            <textarea value={form.looking_for} onChange={(e) => handleChange('looking_for', e.target.value)} className="reg-input min-h-[90px] resize-y" placeholder="Sheeg waxa aad raadinaysay iska..." />
          </FormField>

          {/* Section: Payment */}
          <SectionHeading icon={<DollarSign className="w-4 h-4" />} title="Lacagta Diiwaangelinta" />
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Diiwaangelintu waa $1</p>
                <p className="text-xs text-slate-600">Fadlan $1 ku dir lambarkan:</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-3.5 border border-emerald-200 mb-4">
              <p className="text-xs text-slate-500 font-medium mb-0.5">Lambarka Lacagta:</p>
              <p className="text-lg font-bold text-emerald-700 tracking-wide">+252 616246852</p>
            </div>
            <label className="cursor-pointer group block">
              <div className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                screenshotError
                  ? 'border-red-300 bg-red-50/30'
                  : screenshotPreview
                    ? 'border-emerald-300'
                    : 'border-slate-300 bg-white/50 group-hover:border-emerald-400'
              }`}>
                {screenshotPreview ? (
                  <div className="relative">
                    <img src={screenshotPreview} alt="Payment screenshot" className="w-full max-h-48 object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-emerald-600 px-3 py-1.5 rounded-lg transition-opacity">
        Beddel        </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-sm font-medium text-slate-600">Soo geli Screenshot-ka lacag bixinta</span>
                    <span className="text-xs text-slate-400">JPG, PNG, WebP · ugu badan 5MB</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleScreenshotChange(e.target.files?.[0] || null)}
                />
              </div>
            </label>
            {screenshotError && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1 font-medium">
                <span className="w-1 h-1 rounded-full bg-red-500" />
                {screenshotError}
              </p>
            )}
          </div>

          {/* Info note */}
          <div className="bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl p-4 border border-amber-100">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Heart className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm text-amber-900 leading-relaxed">
                <span className="font-semibold">Talaabada xigta:</span> Marka aad lacagta
                bixiso oo screenshot-ka aad soo gasho, profiilkaaga waxaa sugaya
                ansaxinta maamulaha. Marka la ansixiyo, waxaad geli kartaa bulshada.
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-base py-4 rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-2.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Waa la dirayaa...
              </>
            ) : (
              <>
                <Heart className="w-5 h-5" />
                Diiwaangeli
              </>
            )}
          </button>

          <p className="text-center text-sm text-slate-600">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="text-emerald-700 font-semibold hover:underline">
              Soo gal halkan
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-2">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">{title}</h3>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function FormField({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10 group-focus-within:text-emerald-600 transition-colors">
          {icon}
        </div>
        <div className="[&>input]:pl-11 [&>textarea]:pl-11 [&>select]:pl-11 [&>input]:w-full [&>textarea]:w-full [&>select]:w-full reg-field-wrap">
          {children}
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
          <span className="w-1 h-1 rounded-full bg-red-500" />
          {error}
        </p>
      )}
    </div>
  );
}
