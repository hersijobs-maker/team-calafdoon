import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Clock, Heart, Loader2, LogOut, User, Mail, Phone,
  Calendar, Users, Globe, Home, XCircle, RefreshCw, DollarSign, Upload, Image as ImageIcon,
} from 'lucide-react';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { useRef } from 'react';

export function PendingApprovalPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }
      if (profile?.is_admin) {
        navigate('/admin', { replace: true });
        return;
      }
      if (profile?.registration_status === 'approved') {
        navigate('/social', { replace: true });
        return;
      }
      setPageLoading(false);
    }
  }, [authLoading, session, profile, navigate]);

  const handleRefresh = async () => {
    setRefreshing(true);
    window.location.reload();
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (pageLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const isRejected = profile?.registration_status === 'rejected';
  const isDraft = profile?.registration_status === 'draft';
  const isBlocked = profile?.registration_status === 'blocked';
  const canResubmit = isRejected || isDraft;

  const genderLabel = profile?.gender
    ? GENDER_OPTIONS.find((g) => g.value === profile.gender)?.label_so ?? profile.gender
    : '—';
  const maritalLabel = profile?.marital_status
    ? MARITAL_STATUS_OPTIONS.find((m) => m.value === profile.marital_status)?.label_so ?? profile.marital_status
    : '—';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-xl">Team Calafdoon</span>
          </Link>
        </div>

        {/* Status banner */}
        {isBlocked ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Akoonkaaga Waa La Xannibay</h1>
            <p className="text-slate-600">
              Akoonkaaga waa la xannibay. Fadlan la xidhiidh maamulaha si aad u ogaado sababta.
            </p>
          </div>
        ) : isRejected ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Diiwaangelintaada Waa La Diiday</h1>
            <p className="text-slate-600">
              Profiilkaaga lama ansixin. Fadlan mar kale soo geli screenshot-ka lacagta $1 si aad u dib u gudbiso.
            </p>
          </div>
        ) : isDraft ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2"> Lacagta Diiwaangelinta Ma Bixsan </h1>
            <p className="text-slate-600">
              Fadlan $1 ku dir lambarkan <strong>+252 616246852</strong> ka dibna soo geli screenshot-ka si aad u gudubto ansaxinta.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Sugita Ansaxinta Maamulaha</h1>
            <p className="text-slate-600">
              Mahadsanid! Diiwaangelintaada waa la dhaafay. Hadda waxaa sugaya ansaxinta maamulaha.
              Marka la ansixiyo, waxaad geli kartaa bulshada.
            </p>
          </div>
        )}

        {/* Profile info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Fahfahintaaga</h3>
          <div className="space-y-3">
            <InfoRow icon={<User className="w-4 h-4" />} label="Magaca" value={profile?.full_name} />
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile?.email} />
            {profile?.phone && (
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefoon" value={profile.phone} />
            )}
            {profile?.age && (
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Da'da" value={`${profile.age} sano`} />
            )}
            {profile?.gender && (
              <InfoRow icon={<Users className="w-4 h-4" />} label="Jinsiga" value={genderLabel} />
            )}
            {profile?.country && (
              <InfoRow icon={<Globe className="w-4 h-4" />} label="Dalka" value={profile.country} />
            )}
            {profile?.city && (
              <InfoRow icon={<Home className="w-4 h-4" />} label="Magaalada" value={profile.city} />
            )}
            {profile?.marital_status && (
              <InfoRow icon={<Heart className="w-4 h-4" />} label="Xaaladaha Guurka" value={maritalLabel} />
            )}
          </div>
        </div>

        {/* Resubmit payment section for rejected/draft users */}
        {canResubmit && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Dib-u-gudub Lacagta $1
            </h3>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 mb-4">
              <p className="text-sm text-emerald-800">
                Fadlan $1 ku dir lambarkan: <strong className="text-emerald-700">+252 616246852</strong>
              </p>
            </div>
            <label className="cursor-pointer group block">
              <div className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                screenshotPreview
                  ? 'border-emerald-300'
                  : 'border-slate-300 bg-slate-50/50 group-hover:border-emerald-400'
              }`}>
                {screenshotPreview ? (
                  <div className="relative">
                    <img src={screenshotPreview} alt="Payment screenshot" className="w-full max-h-48 object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-emerald-600 px-3 py-1.5 rounded-lg transition-opacity">
                        Beddel
                      </span>
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
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        show('Screenshot-ka waa inuu noqdaa in ka yar 5MB', 'error');
                        return;
                      }
                      setScreenshotFile(file);
                      const reader = new FileReader();
                      reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
            </label>
            <button
              onClick={async () => {
                if (!screenshotFile) {
                  show('Fadlan marka hore soo geli screenshot-ka lacag bixinta $1.', 'error');
                  return;
                }
                if (!profile) return;
                setResubmitting(true);
                try {
                  const ext = screenshotFile.name.split('.').pop();
                  const fileName = `${profile.id}/payment.${ext}`;
                  const { error: uploadError } = await supabase.storage
                    .from('payment-screenshots')
                    .upload(fileName, screenshotFile, { upsert: true });
                  if (uploadError) {
                    show('Lama soo geliyo screenshot-ka. Fadlan isku day mar kale.', 'error');
                    setResubmitting(false);
                    return;
                  }
                  const { data: urlData } = supabase.storage
                    .from('payment-screenshots')
                    .getPublicUrl(fileName);
                  const { error: submitError } = await supabase.rpc('submit_registration_payment', {
                    p_screenshot_url: urlData.publicUrl,
                  });
                  if (submitError) {
                    show(submitError.message || 'Lama dhaafin caddeynta lacagta.', 'error');
                    setResubmitting(false);
                    return;
                  }
                  show('Caddeynta lacagta waa la dib-u-gudbay. Sug ansaxinta maamulaha.', 'success');
                  window.location.reload();
                } catch (err) {
                  show('Khalad ayaa dhacay. Fadlan isku day mar kale.', 'error');
                  setResubmitting(false);
                }
              }}
              disabled={resubmitting || !screenshotFile}
              className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {resubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Dib-u-gudbida...</>
              ) : (
                <><Upload className="w-4 h-4" /> Dib-u-gudbi Caddeynta Lacagta</>
              )}
            </button>
          </div>
        )}

        {/* Actions */}
        {!isBlocked && !isRejected && !isDraft && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  Waa Sukul Sugita
                </p>
                <p className="text-sm text-amber-800">
                  Maamulaha ayaa eegi doonaa profiilkaaga. Marka la ansixiyo, waxaad si toos ah
                  u geli kartaa bulshada. Haddii aad rabto inaad xaqiijiso xaalada, guji "Cusbooneysii".
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {!isBlocked && !isRejected && !isDraft && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {refreshing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              Cusbooneysii Xaalada
            </button>
          )}
          <button
            onClick={handleLogout}
            className={`${isBlocked || isRejected ? 'flex-1' : 'flex-1'} bg-white text-slate-700 font-semibold py-3 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2`}
          >
            <LogOut className="w-5 h-5" />
            Ka Bax
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-slate-400">{icon}</div>
      <span className="text-slate-500 font-medium w-32">{label}:</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}
