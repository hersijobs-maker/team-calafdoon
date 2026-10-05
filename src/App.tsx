import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { CallProvider } from '@/lib/call-context';
import { ToastProvider } from '@/components/Toast';
import { LanguageProvider } from '@/lib/language-context';
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from '@/components/RouteGuards';
import { LandingPage } from '@/pages/LandingPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MembersPage } from '@/pages/MembersPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PendingApprovalPage } from '@/pages/PendingApprovalPage';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { AdminResetPage } from '@/pages/AdminResetPage';
import { AdminSetupPage } from '@/pages/AdminSetupPage';
import { ChatPage } from '@/pages/ChatPage';
import { CallHistoryPage } from '@/pages/CallHistoryPage';
import { ConnectionsPage } from '@/pages/ConnectionsPage';
import { SocialPage } from '@/pages/SocialPage';
import { ContactUsButton, ContactUsPage } from '@/components/ContactUsButton';
import { MobileApp } from '@/mobile/MobileApp';

const MOBILE_PATHS = ['/m', '/pending-approval', '/contact'];

function isNativeApp(): boolean {
  return typeof window !== 'undefined'
    && document.documentElement.getAttribute('data-native') === 'true';
}

function NativeRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (isNativeApp()) {
      const currentPath = window.location.pathname;
      if (!MOBILE_PATHS.some((p) => currentPath === p || currentPath.startsWith(p + '/') || currentPath === p)) {
        navigate('/m', { replace: true });
      }
    }
  }, [navigate]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
      <CallProvider>
      <ToastProvider>
        <BrowserRouter>
          <NativeRedirect />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedRoute>
                  <MembersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:conversationId"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/call-history"
              element={
                <ProtectedRoute>
                  <CallHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connections"
              element={
                <ProtectedRoute>
                  <ConnectionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/social"
              element={<SocialPage />}
            />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/reset" element={<AdminResetPage />} />
            <Route path="/admin/setup" element={<AdminSetupPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            {/* Mobile app routes — separate from existing website */}
            <Route path="/m" element={<MobileApp />} />
            <Route path="/m/*" element={<MobileApp />} />
            <Route path="/contact" element={<ContactUsPage />} />
          </Routes>
          <ContactUsButton />
        </BrowserRouter>
      </ToastProvider>
      </CallProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
