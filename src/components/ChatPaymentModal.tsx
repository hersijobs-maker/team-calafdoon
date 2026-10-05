import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import {
  X, Loader2, Upload, DollarSign, Phone, Image as ImageIcon,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

const ADMIN_PAYMENT_NUMBER = '616246852';

interface ChatPaymentModalProps {
  onClose: () => void;
  onSubmitted: () => void;
}

export function ChatPaymentModal({ onClose, onSubmitted }: ChatPaymentModalProps) {
  const { show } = useToast();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      show('Sawirku waa inuu noqdaa in ka yar 5MB', 'error');
      return;
    }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      show('Sawirku waa inuu noqdaa JPEG, PNG, ama WebP', 'error');
      return;
    }
    if (!profile?.id) {
      show('Fadlan soo gal si aad u soo gasho sawirka', 'error');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${profile.id}/payment-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError.message, uploadError);
        show('Lama soo gali karo sawirka: ' + uploadError.message, 'error');
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(filePath);
      setScreenshotUrl(urlData.publicUrl);
      show('Sawirka waa la soo geliyay', 'success');
    } catch (err) {
      console.error('Upload exception:', err);
      show('Khalad ayaa dhacay soo gelinta sawirka', 'error');
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleSubmit = async () => {
    if (!screenshotUrl) {
      show('Fadlan soo geli sawirka cadbinta lacagta', 'error');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('submit_chat_payment', {
      p_screenshot_url: screenshotUrl,
    });

    if (error) {
      const msg = error.message.includes('sugita')
        ? 'Hadda waxaa jira codsi sugita ah. Fadlan sug jawaabta maamulaha.'
        : 'Lama kaydin codsiga: ' + error.message;
      show(msg, 'error');
      setSubmitting(false);
      return;
    }

    show('Codsiga lacagta waa la kaydiyay. Fadlan sug ansaxinta maamulaha.', 'success');
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-8" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            {t('payment.title')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment instructions */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-900">{t('payment.instructions')}</p>
            </div>
            <p className="text-sm text-emerald-800">
              {t('payment.sendTo')}
            </p>
            <div className="flex items-center justify-center gap-2 bg-white rounded-lg py-3 border-2 border-emerald-300">
              <Phone className="w-5 h-5 text-emerald-600" />
              <span className="text-xl font-bold text-slate-900 tracking-wider">{ADMIN_PAYMENT_NUMBER}</span>
            </div>
            <p className="text-xs text-emerald-700">
              Ka dib markaad lacagta dirto, soo geli sawirka cadbinta lacagta hoosta.
            </p>
          </div>

          {/* Screenshot upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t('payment.uploadScreenshot')}
            </label>
            {screenshotUrl ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300">
                <img src={screenshotUrl} alt="Payment proof" className="w-full max-h-48 object-contain bg-slate-50" />
                <button
                  onClick={() => setScreenshotUrl(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Sawirka waa la soo geliyay
                </div>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400" />
                )}
                <p className="text-sm text-slate-600 text-center">
                  {uploading ? 'Sawirka ayaa la soo gelinayaa...' : t('payment.uploadHint')}
                </p>
                <p className="text-xs text-slate-400">JPEG, PNG, WebP (max 5MB)</p>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p>
              Markaad sawirka dirto, codsigu waa la kaydiyayaa sida "Sugita". Maamulaha ayaa arki doona codsigaaga oo ansixin doona fariimaha.
            </p>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!screenshotUrl || submitting || uploading}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                {t('payment.submit')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
