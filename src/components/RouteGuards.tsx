import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.is_admin) {
    return <>{children}</>;
  }

  if (profile?.registration_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!profile?.is_admin) {
    return <Navigate to="/social" replace />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (session && profile?.registration_status === 'approved') {
    return <Navigate to="/social" replace />;
  }

  if (session && profile?.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  if (session && profile && (profile.registration_status === 'draft' || profile.registration_status === 'pending_approval' || profile.registration_status === 'rejected')) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}
