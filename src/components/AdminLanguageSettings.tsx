import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/lib/language-context';
import { LANGUAGES, type Language } from '@/lib/translations';
import { Globe, Loader2, Check, Save, Languages } from 'lucide-react';

export function AdminLanguageSettings() {
  const { show } = useToast();
  const { t, language: currentUILang } = useLanguage();
  const [defaultLang, setDefaultLang] = useState<Language>('so');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.rpc('get_default_language').then(({ data, error }) => {
      if (!error && data) {
        setDefaultLang(data as Language);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('set_default_language', { p_language: defaultLang });
    if (error) {
      show(t('common.error'), 'error');
    } else {
      show(t('admin.languageSaved'), 'success');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentLangInfo = LANGUAGES.find((l) => l.code === defaultLang);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Languages className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900">{t('admin.languageSettings')}</h2>
      </div>
      <p className="text-sm text-slate-600 mb-6">{t('admin.languageHint')}</p>

      {/* Current language indicator */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
        <Globe className="w-5 h-5 text-emerald-600" />
        <div>
          <p className="text-xs text-slate-500 font-medium">{t('admin.currentLanguage')}</p>
          <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="text-xl">{currentLangInfo?.flag}</span>
            {currentLangInfo?.label}
          </p>
        </div>
      </div>

      {/* Language selection */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">{t('admin.defaultLanguage')}</label>
        <div className="grid sm:grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => {
            const isSelected = defaultLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setDefaultLang(lang.code)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-3xl">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{lang.label}</p>
                  {lang.rtl && (
                    <span className="text-[10px] text-slate-400 font-medium">RTL</span>
                  )}
                </div>
                {isSelected && <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {t('admin.saveLanguage')}
        </button>
      </div>

      {/* Info note */}
      <div className="mt-6 bg-slate-50 rounded-xl p-4 flex items-start gap-3">
        <Languages className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          {currentUILang === 'so' && 'Xubnaha sidoo kale way doortaan luqaddooda ka baarka navigation-ka.'}
          {currentUILang === 'en' && 'Users can also choose their own language from the navigation bar.'}
          {currentUILang === 'ar' && 'يمكن للمستخدمين أيضاً اختيار لغتهم من شريط التنقل.'}
        </p>
      </div>
    </div>
  );
}
