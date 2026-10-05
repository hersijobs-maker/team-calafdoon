import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import type { Profile, CommunityVisibilityMode } from '@/lib/types';
import {
  REGISTRATION_STATUS_LABELS, REGISTRATION_STATUS_COLORS,
  GENDER_OPTIONS, MARITAL_STATUS_OPTIONS,
} from '@/lib/constants';
import {
  Users, UserCheck, UserX, Clock, Ban, Search, Loader2,
  Check, X, Trash2, ChevronLeft, ChevronRight, Eye, ArrowLeft,
  ShieldCheck, UserPlus, Pencil, DollarSign, Globe, Lock,
  Megaphone, MessageCircle, Languages,
} from 'lucide-react';
import { AdminAdvertisements } from '@/components/AdminAdvertisements';
import { AdminChatRequests } from '@/components/AdminChatRequests';
import { AdminLanguageSettings } from '@/components/AdminLanguageSettings';
import { useLanguage } from '@/lib/language-context';

interface MemberFormData {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  age: string;
  gender: string;
  country: string;
  city: string;
  marital_status: string;
  profession: string;
  bio: string;
  looking_for: string;
  registration_status: string;
}

type Tab = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'blocked';
type AdminView = 'members' | 'advertisements' | 'chat_requests' | 'language';

export function AdminDashboard() {
  const [adminView, setAdminView] = useState<AdminView>('members');
  const [activeTab, setActiveTab] = useState<Tab>('pending_approval');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ user: Profile } | null>(null);
  const [blockModal, setBlockModal] = useState<{ user: Profile } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<{ user: Profile } | null>(null);
  const [userPayment, setUserPayment] = useState<{ id: string; status: string; amount: string; currency: string; payment_screenshot_url: string | null; created_at: string } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<CommunityVisibilityMode>('open');
  const [modeLoading, setModeLoading] = useState(false);
  const [modeConfirm, setModeConfirm] = useState<CommunityVisibilityMode | null>(null);
  const [pendingChatPayments, setPendingChatPayments] = useState(0);
  const { show } = useToast();
  const { t } = useLanguage();

  const emptyForm: MemberFormData = {
    full_name: '', email: '', password: '', phone: '', age: '',
    gender: '', country: '', city: '', marital_status: '', profession: '',
    bio: '', looking_for: '', registration_status: 'approved',
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_admin', false)
      .order('created_at', { ascending: false });
    setAllUsers((data as Profile[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
    supabase.rpc('get_community_visibility_mode').then(({ data }) => {
      setVisibilityMode((data as CommunityVisibilityMode) || 'open');
    });
    supabase.rpc('get_pending_payment_count').then(({ data, error }) => {
      if (error) {
        console.error('Failed to load pending payment count:', error);
      } else {
        setPendingChatPayments((data as number) || 0);
      }
    });
  }, [loadUsers]);

  const loadPendingCount = useCallback(() => {
    supabase.rpc('get_pending_payment_count').then(({ data, error }) => {
      if (error) {
        console.error('Failed to load pending payment count:', error);
      } else {
        setPendingChatPayments((data as number) || 0);
      }
    });
  }, []);

  const counts = {
    draft: allUsers.filter((u) => u.registration_status === 'draft').length,
    pending_approval: allUsers.filter((u) => u.registration_status === 'pending_approval').length,
    approved: allUsers.filter((u) => u.registration_status === 'approved').length,
    rejected: allUsers.filter((u) => u.registration_status === 'rejected').length,
    blocked: allUsers.filter((u) => u.registration_status === 'blocked').length,
  };

  const filteredUsers = allUsers.filter((u) => {
    if (u.registration_status !== activeTab) return false;
    if (!search.trim()) return true;
    const q = search.replace(/[,.()%*\\"']/g, ' ').trim().toLowerCase();
    if (!q) return true;
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleApprove = async (user: Profile) => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_approve_user', { target_user_id: user.id, notes: null });
    if (error) {
      show('Lama ansixin xubnaha', 'error');
    } else {
      show(`${user.full_name} waa la ansixiyay`, 'success');
      await loadUsers();
      if (selectedUser?.id === user.id) setSelectedUser(null);
    }
    setActionLoading(false);
  };

  const loadUserPayment = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('payments')
      .select('id, status, amount, currency, payment_screenshot_url, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setUserPayment(data as typeof userPayment);
  }, []);

  const handleVerifyPayment = async (paymentId: string, approved: boolean) => {
    setPaymentLoading(true);
    const { error } = await supabase.rpc('admin_verify_payment', {
      p_payment_id: paymentId,
      p_approved: approved,
    });
    if (error) {
      show(approved ? 'Lama ansixin lacagta' : 'Lama diidin lacagta', 'error');
    } else {
      show(approved ? 'Lacagta waa la ansixiyay' : 'Lacagta waa la diiday', 'success');
      if (selectedUser) await loadUserPayment(selectedUser.id);
    }
    setPaymentLoading(false);
  };

  const handleReject = async (user: Profile, reason: string) => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_reject_user', {
      target_user_id: user.id, reason: reason || null, notes: null,
    });
    if (error) {
      show('Lama diidin xubnaha', 'error');
    } else {
      show(`${user.full_name} waa la diiday`, 'success');
      setRejectModal(null);
      await loadUsers();
      if (selectedUser?.id === user.id) setSelectedUser(null);
    }
    setActionLoading(false);
  };

  const handleBlock = async (user: Profile, reason: string) => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_block_user', {
      target_user_id: user.id, reason: reason || null, notes: null,
    });
    if (error) {
      show('Lama xannabin xubnaha', 'error');
    } else {
      show(`${user.full_name} waa la xannibay`, 'success');
      setBlockModal(null);
      await loadUsers();
      if (selectedUser?.id === user.id) setSelectedUser(null);
    }
    setActionLoading(false);
  };

  const handleUnblock = async (user: Profile) => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_unblock_user', { target_user_id: user.id, notes: null });
    if (error) {
      show('Lama furin xannibka', 'error');
    } else {
      show(`${user.full_name} waa la furo xannibka`, 'success');
      await loadUsers();
      if (selectedUser?.id === user.id) setSelectedUser(null);
    }
    setActionLoading(false);
  };

  const handleDelete = async (user: Profile) => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: user.id });
    if (error) {
      show('Lama tirtirin xubnaha', 'error');
    } else {
      show(`${user.full_name} waa la tirtiray`, 'success');
      setDeleteConfirm(null);
      await loadUsers();
      if (selectedUser?.id === user.id) setSelectedUser(null);
    }
    setActionLoading(false);
  };

  const genderLabel = (g: string) => GENDER_OPTIONS.find((o) => o.value === g)?.label_so || null;
  const maritalLabel = (m: string) => MARITAL_STATUS_OPTIONS.find((o) => o.value === m)?.label_so || null;

  const handleAddMember = async (form: MemberFormData) => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_create_member', {
      p_email: form.email.toLowerCase(),
      p_password: form.password,
      p_full_name: form.full_name,
      p_phone: form.phone || null,
      p_age: form.age ? parseInt(form.age, 10) : null,
      p_gender: form.gender || null,
      p_country: form.country || null,
      p_city: form.city || null,
      p_marital_status: form.marital_status || null,
      p_profession: form.profession || null,
      p_bio: form.bio || null,
      p_looking_for: form.looking_for || null,
      p_registration_status: form.registration_status,
    });
    if (error) {
      show(error.message || 'Lama abuurin xubnaha', 'error');
    } else {
      show(`${form.full_name} waa la abuuray`, 'success');
      setAddModal(false);
      await loadUsers();
    }
    setActionLoading(false);
  };

  const handleEditMember = async (user: Profile, form: MemberFormData) => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_edit_member', {
      p_target_user_id: user.id,
      p_full_name: form.full_name || null,
      p_phone: form.phone || null,
      p_age: form.age ? parseInt(form.age, 10) : null,
      p_gender: form.gender || null,
      p_country: form.country || null,
      p_city: form.city || null,
      p_marital_status: form.marital_status || null,
      p_profession: form.profession || null,
      p_bio: form.bio || null,
      p_looking_for: form.looking_for || null,
      p_registration_status: form.registration_status || null,
    });
    if (error) {
      show(error.message || 'Lama wax ka beddelin xubnaha', 'error');
    } else {
      show(`${user.full_name} waa la cusbooneysiiyay`, 'success');
      setEditModal(null);
      await loadUsers();
    }
    setActionLoading(false);
  };

  const handleVisibilityChange = async (mode: CommunityVisibilityMode) => {
    setModeLoading(true);
    const { error } = await supabase.rpc('set_community_visibility_mode', { p_mode: mode });
    if (error) {
      show('Lama beddelin habka muuqalka', 'error');
    } else {
      setVisibilityMode(mode);
      show(mode === 'open' ? 'Bulshada waa la furay' : 'Bulshada waa la gaareeyay', 'success');
    }
    setModeLoading(false);
    setModeConfirm(null);
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: 'draft', label: 'Bilaash', icon: DollarSign, count: counts.draft },
    { key: 'pending_approval', label: 'Sugita', icon: Clock, count: counts.pending_approval },
    { key: 'approved', label: 'Ansaxay', icon: UserCheck, count: counts.approved },
    { key: 'rejected', label: 'Diiday', icon: UserX, count: counts.rejected },
    { key: 'blocked', label: 'Xannibay', icon: Ban, count: counts.blocked },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Bogga Maamul</h1>
              <p className="text-slate-600">Maamul isticmaalayaasha iyo ansixinta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => setAdminView('members')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  adminView === 'members' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Xubnaha</span>
              </button>
              <button
                onClick={() => setAdminView('advertisements')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  adminView === 'advertisements' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Megaphone className="w-4 h-4" />
                <span className="hidden sm:inline">Xayaysiisyada</span>
              </button>
              <button
                onClick={() => setAdminView('chat_requests')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative ${
                  adminView === 'chat_requests' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Fariimaha</span>
                {pendingChatPayments > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    adminView === 'chat_requests' ? 'bg-white text-emerald-700' : 'bg-red-500 text-white'
                  }`}>
                    {pendingChatPayments}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAdminView('language')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  adminView === 'language' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Languages className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.language')}</span>
              </button>
            </div>
            {adminView === 'members' && (
              <button
                onClick={() => setAddModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Ku Dar Xubno</span>
              </button>
            )}
          </div>
        </div>

        {adminView === 'advertisements' ? (
          <AdminAdvertisements />
        ) : adminView === 'chat_requests' ? (
          <AdminChatRequests onPendingCountChange={loadPendingCount} />
        ) : adminView === 'language' ? (
          <AdminLanguageSettings />
        ) : (
        <div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const colorMap: Record<string, string> = {
              draft: 'bg-slate-100 text-slate-600',
              pending_approval: 'bg-amber-100 text-amber-600',
              approved: 'bg-emerald-100 text-emerald-600',
              rejected: 'bg-red-100 text-red-600',
              blocked: 'bg-gray-800 text-white',
            };
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`bg-white rounded-2xl shadow-sm border p-5 text-left transition-all ${
                  activeTab === tab.key ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[tab.key]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{tab.count}</p>
                    <p className="text-xs text-slate-500 font-medium">{tab.label}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Community Visibility Mode */}
        <div className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Habka Muuqalka Xubnaha</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Dooro sida xubnuhu u arki karaan xubnaha kale ee bulshada.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => visibilityMode !== 'open' && setModeConfirm('open')}
              disabled={modeLoading}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                visibilityMode === 'open'
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                visibilityMode === 'open' ? 'bg-emerald-100' : 'bg-slate-100'
              }`}>
                <Globe className={`w-5 h-5 ${visibilityMode === 'open' ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Bulshada Furooto</p>
                <p className="text-xs text-slate-500 mt-1">
                  Xubnaha ansaxay waxay arki karaan dhammaan xubnaha kale ee ansaxay.
                </p>
              </div>
              {visibilityMode === 'open' && (
                <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              )}
            </button>
            <button
              onClick={() => visibilityMode !== 'private' && setModeConfirm('private')}
              disabled={modeLoading}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                visibilityMode === 'private'
                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                visibilityMode === 'private' ? 'bg-amber-100' : 'bg-slate-100'
              }`}>
                <Lock className={`w-5 h-5 ${visibilityMode === 'private' ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Bulshada Gaarka ah</p>
                <p className="text-xs text-slate-500 mt-1">
                  Xubnaha waxay arki karaan kaliya xubnaha ay la xidhan yihiin. Codsi dherig ayaa loo baahan yahay.
                </p>
              </div>
              {visibilityMode === 'private' && (
                <Check className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
            </button>
          </div>
          {modeLoading && (
            <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waxaa la beddelayaa habka...
            </div>
          )}
        </div>

        {/* Mode confirmation dialog */}
        {modeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModeConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Beddel Habka Muuqalka</h2>
              <p className="text-sm text-slate-600 mb-6">
                Ma hubtaa inaad rabto inaad badasho habka muuqalka ilaa{' '}
                <span className="font-semibold">
                  {modeConfirm === 'open' ? 'Bulshada Furooto' : 'Bulshada Gaarka ah'}
                </span>
                ? Beddelkani waa dabooli doonaa isla markiiba.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleVisibilityChange(modeConfirm)}
                  disabled={modeLoading}
                  className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  {modeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Haa, Beddel
                </button>
                <button
                  onClick={() => setModeConfirm(null)}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Jooji
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Raadi magac, email, ama telefoon..."
              className="form-input pl-10"
            />
          </div>
        </div>

        {/* User grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">
              {tabs.find((t) => t.key === activeTab)?.label} - xubno lama helin
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.map((user) => (
              <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name} className="w-14 h-14 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{user.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border ${REGISTRATION_STATUS_COLORS[user.registration_status]}`}>
                      {REGISTRATION_STATUS_LABELS[user.registration_status]}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  {user.phone && <p><span className="text-slate-400">Telefoon:</span> {user.phone}</p>}
                  {user.age && <p><span className="text-slate-400">Da'da:</span> {user.age} sano</p>}
                  {user.gender && <p><span className="text-slate-400">Jinsiga:</span> {genderLabel(user.gender)}</p>}
                  {user.country && <p><span className="text-slate-400">Dalka:</span> {user.country}</p>}
                  {user.city && <p><span className="text-slate-400">Magaalada:</span> {user.city}</p>}
                  <p><span className="text-slate-400">Diiwaangelinta:</span> {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-slate-100">
                  <button onClick={() => { setSelectedUser(user); loadUserPayment(user.id); }} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors" title="Arag profiilka">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditModal({ user })} disabled={actionLoading} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50" title="Wax ka beddel">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {user.registration_status !== 'approved' && (
                    <button onClick={() => handleApprove(user)} disabled={actionLoading} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Ansaxi">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {user.registration_status !== 'rejected' && (
                    <button onClick={() => setRejectModal({ user })} disabled={actionLoading} className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Diidi">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {user.registration_status !== 'blocked' ? (
                    <button onClick={() => setBlockModal({ user })} disabled={actionLoading} className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50" title="Xannibi">
                      <Ban className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => handleUnblock(user)} disabled={actionLoading} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Fur xannibka">
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setDeleteConfirm(user)} disabled={actionLoading} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Tirtiri">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        )}

      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Faahfaahinta Isticmaalaha</h2>
              <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={() => setAdminView('language')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  adminView === 'language' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Languages className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.language')}</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt={selectedUser.full_name} className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-600">
                    {selectedUser.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedUser.full_name}</h3>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${REGISTRATION_STATUS_COLORS[selectedUser.registration_status]}`}>
                    {REGISTRATION_STATUS_LABELS[selectedUser.registration_status]}
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <DetailRow label="Email" value={selectedUser.email} />
                <DetailRow label="Telefoon" value={selectedUser.phone} />
                <DetailRow label="Da'da" value={selectedUser.age?.toString() || null} />
                <DetailRow label="Jinsiga" value={genderLabel(selectedUser.gender || '')} />
                <DetailRow label="Dalka" value={selectedUser.country} />
                <DetailRow label="Magaalada" value={selectedUser.city} />
                <DetailRow label="Xaaladaha Guurka" value={maritalLabel(selectedUser.marital_status || '')} />
                <DetailRow label="Xirfad" value={selectedUser.profession} />
                <DetailRow label="Diiwaangelinta" value={new Date(selectedUser.created_at).toLocaleString()} />
                {selectedUser.approved_at && <DetailRow label="Ansaxinta" value={new Date(selectedUser.approved_at).toLocaleString()} />}
                {selectedUser.rejected_at && <DetailRow label="Diidista" value={new Date(selectedUser.rejected_at).toLocaleString()} />}
              </div>

              {selectedUser.bio && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Fahfahin</p>
                  <p className="text-sm text-slate-700">{selectedUser.bio}</p>
                </div>
              )}

              {selectedUser.looking_for && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Waxa raadinaya</p>
                  <p className="text-sm text-slate-700">{selectedUser.looking_for}</p>
                </div>
              )}

              {/* Payment review section */}
              {userPayment && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Lacagta Diiwaangelinta
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Qaddar</p>
                      <p className="text-sm text-slate-900">${userPayment.amount} {userPayment.currency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Xaalad</p>
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${
                        userPayment.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        userPayment.status === 'pending_verification' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        userPayment.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {userPayment.status === 'paid' ? 'Ansixiyay' :
                         userPayment.status === 'pending_verification' ? 'Sugita Ansixinta' :
                         userPayment.status === 'failed' ? 'Diiday' :
                         'Sugita'}
                      </span>
                    </div>
                  </div>
                  {userPayment.payment_screenshot_url ? (
                    <div className="rounded-xl overflow-hidden border border-slate-200 mb-3">
                      <img src={userPayment.payment_screenshot_url} alt="Caddeynta lacag-bixinta" className="w-full max-h-64 object-contain bg-slate-50" />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mb-3">Sawir caddeyn lama dhaafin.</p>
                  )}
                  {userPayment.status === 'pending_verification' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerifyPayment(userPayment.id, true)}
                        disabled={paymentLoading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Ansaxi Lacagta
                      </button>
                      <button
                        onClick={() => handleVerifyPayment(userPayment.id, false)}
                        disabled={paymentLoading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Diidi Lacagta
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200">
                {selectedUser.registration_status !== 'approved' && (
                  <button onClick={() => handleApprove(selectedUser)} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    <Check className="w-4 h-4" /> Ansaxi
                  </button>
                )}
                {selectedUser.registration_status !== 'rejected' && (
                  <button onClick={() => setRejectModal({ user: selectedUser })} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
                    <X className="w-4 h-4" /> Diidi
                  </button>
                )}
                {selectedUser.registration_status !== 'blocked' ? (
                  <button onClick={() => setBlockModal({ user: selectedUser })} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 disabled:opacity-50 transition-colors">
                    <Ban className="w-4 h-4" /> Xannibi
                  </button>
                ) : (
                  <button onClick={() => handleUnblock(selectedUser)} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    <ShieldCheck className="w-4 h-4" /> Fur Xannibka
                  </button>
                )}
                <button onClick={() => setDeleteConfirm(selectedUser)} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors ml-auto">
                  <Trash2 className="w-4 h-4" /> Tirtiri
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <ReasonModal
          user={rejectModal.user}
          title="Diidi Isticmaalaha"
          confirmLabel="Diidi"
          color="amber"
          onConfirm={(reason) => handleReject(rejectModal.user, reason)}
          onClose={() => setRejectModal(null)}
          loading={actionLoading}
        />
      )}

      {blockModal && (
        <ReasonModal
          user={blockModal.user}
          title="Xannibi Isticmaalaha"
          confirmLabel="Xannibi"
          color="gray"
          onConfirm={(reason) => handleBlock(blockModal.user, reason)}
          onClose={() => setBlockModal(null)}
          loading={actionLoading}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Tirtiri Isticmaalaha"
          message={`Ma hubtaa inaad tirtirayso ${deleteConfirm.full_name}? Tani waxay tirtiri doontaa dhammaan macluumaadka. Hawshan lama soceli karo.`}
          confirmLabel="Tirtiri Dabadeed"
          onConfirm={() => handleDelete(deleteConfirm)}
          onClose={() => setDeleteConfirm(null)}
          loading={actionLoading}
          danger
        />
      )}

      {addModal && (
        <MemberFormModal
          title="Ku Dar Xuban Cusub"
          confirmLabel="Abuur"
          includePassword
          onConfirm={(form) => handleAddMember(form)}
          onClose={() => setAddModal(false)}
          loading={actionLoading}
          initial={emptyForm}
        />
      )}

      {editModal && (
        <MemberFormModal
          title="Wax Ka Beddel Xubnaha"
          confirmLabel="Kaydi"
          onConfirm={(form) => handleEditMember(editModal.user, form)}
          onClose={() => setEditModal(null)}
          loading={actionLoading}
          initial={{
            full_name: editModal.user.full_name,
            email: editModal.user.email,
            password: '',
            phone: editModal.user.phone || '',
            age: editModal.user.age?.toString() || '',
            gender: editModal.user.gender || '',
            country: editModal.user.country || '',
            city: editModal.user.city || '',
            marital_status: editModal.user.marital_status || '',
            profession: editModal.user.profession || '',
            bio: editModal.user.bio || '',
            looking_for: editModal.user.looking_for || '',
            registration_status: editModal.user.registration_status,
          }}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-sm text-slate-900">{value || 'Lama dejiyin'}</p>
    </div>
  );
}

function ReasonModal({
  user, title, confirmLabel, color, onConfirm, onClose, loading,
}: {
  user: Profile;
  title: string;
  confirmLabel: string;
  color: 'amber' | 'gray';
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const colorClasses = {
    amber: 'bg-amber-600 hover:bg-amber-700',
    gray: 'bg-gray-800 hover:bg-gray-900',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 mb-4">
          Waxaad diidayaa <span className="font-semibold">{user.full_name}</span>.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="form-input min-h-[100px] resize-y"
          placeholder="Sababta (ikhtiyaari)..."
        />
        <div className="flex gap-3 mt-4">
          <button onClick={() => onConfirm(reason)} disabled={loading} className={`flex-1 ${colorClasses[color]} text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
            Jooji
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onClose, loading, danger,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={loading} className={`flex-1 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'} text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
            Jooji
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberFormModal({
  title, confirmLabel, includePassword, onConfirm, onClose, loading, initial,
}: {
  title: string;
  confirmLabel: string;
  includePassword?: boolean;
  onConfirm: (form: MemberFormData) => void;
  onClose: () => void;
  loading: boolean;
  initial: MemberFormData;
}) {
  const [form, setForm] = useState<MemberFormData>(initial);

  const set = (field: keyof MemberFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      return;
    }
    if (includePassword && form.password.length < 6) {
      return;
    }
    onConfirm(form);
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Magaca Buuxa *</label>
            <input className={inputClass} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} required disabled={!includePassword} />
          </div>
          {includePassword && (
            <div>
              <label className={labelClass}>Erayga Sirta ah * (6+ characters)</label>
              <input type="password" className={inputClass} value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} />
            </div>
          )}
          <div>
            <label className={labelClass}>Telefoon</label>
            <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Da'da</label>
            <input type="number" className={inputClass} value={form.age} onChange={(e) => set('age', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Jinsiga</label>
            <select className={inputClass} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">--</option>
              {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label_so}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Dalka</label>
            <input className={inputClass} value={form.country} onChange={(e) => set('country', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Magaalada</label>
            <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Xaaladaha Guurka</label>
            <select className={inputClass} value={form.marital_status} onChange={(e) => set('marital_status', e.target.value)}>
              <option value="">--</option>
              {MARITAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label_so}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Xirfad</label>
            <input className={inputClass} value={form.profession} onChange={(e) => set('profession', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Xaaladda Diiwaangelinta</label>
            <select className={inputClass} value={form.registration_status} onChange={(e) => set('registration_status', e.target.value)}>
              <option value="draft">Bilaash</option>
              <option value="pending_approval">Sugita</option>
              <option value="approved">Ansaxay</option>
              <option value="rejected">Diiday</option>
              <option value="blocked">Xannibay</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Fahfahin (Bio)</label>
            <textarea className={`${inputClass} min-h-[60px] resize-y`} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Waxa Raadinayo</label>
            <textarea className={`${inputClass} min-h-[60px] resize-y`} value={form.looking_for} onChange={(e) => set('looking_for', e.target.value)} />
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 flex gap-3 sticky bottom-0 bg-white">
          <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
            Jooji
          </button>
        </div>
      </form>
    </div>
  );
}
