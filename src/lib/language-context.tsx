import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { translations, DEFAULT_LANGUAGE, type Language } from '@/lib/translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);

  const isRTL = language === 'ar';

  const t = useCallback(
    (key: string): string => {
      const dict = translations[language] || translations[DEFAULT_LANGUAGE];
      return dict[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
    },
    [language],
  );

  // Load language on mount: check user preference, then site default
  useEffect(() => {
    let cancelled = false;

    const loadLanguage = async () => {
      try {
        // Try to get user's preferred language from their profile
        const { data: session } = await supabase.auth.getSession();
        if (session.session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_language')
            .eq('id', session.session.user.id)
            .maybeSingle();

          if (!cancelled && profile?.preferred_language) {
            setLanguageState(profile.preferred_language as Language);
            setLoading(false);
            return;
          }
        }

        // Fall back to site default
        const { data: defaultLang } = await supabase.rpc('get_default_language');
        if (!cancelled && defaultLang) {
          setLanguageState(defaultLang as Language);
        }
      } catch {
        // Fall back silently to default
      }
      if (!cancelled) setLoading(false);
    };

    loadLanguage();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply RTL and lang attributes to document
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [language, isRTL]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // Persist to database if user is logged in
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session.session?.user) {
        await supabase.rpc('set_user_language', { p_language: lang });
      }
    } catch {
      // Silent fail — language still applied in UI
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
