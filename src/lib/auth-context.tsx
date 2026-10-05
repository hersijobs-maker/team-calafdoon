import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';
import { useInactivityTimeout, setInactivityLogoutMessage } from './useInactivityTimeout';
import { subscribeToPush } from './notifications';

interface AuthContextValue {
  session: import('@supabase/supabase-js').Session | null;
  profile: Profile | null;
  loading: boolean;
  accessLevel: 'guest' | 'pending' | 'approved' | 'admin';
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error loading profile:', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const p = await loadProfile(session.user.id);
    setProfile(p);
  }, [session, loadProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user?.id) {
        loadProfile(s.user.id).then((p) => {
          if (mounted) {
            setProfile(p);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, s) => {
      (async () => {
        if (!mounted) return;
        setSession(s);
        if (s?.user?.id) {
          const p = await loadProfile(s.user.id);
          if (mounted) setProfile(p);
          // Attempt to subscribe to push notifications (best-effort)
          subscribeToPush().catch(() => {});
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const handleInactivityTimeout = useCallback(async () => {
    setInactivityLogoutMessage();
    await signOut();
  }, [signOut]);

  useInactivityTimeout(!!session, handleInactivityTimeout);

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    accessLevel: profile?.is_admin
      ? 'admin'
      : profile?.registration_status === 'approved'
        ? 'approved'
        : session
          ? 'pending'
          : 'guest',
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
