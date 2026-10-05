import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import type { DirectoryMember, CommunityVisibilityMode } from '@/lib/types';
import { ChatPaymentModal } from '@/components/ChatPaymentModal';
import { useLanguage } from '@/lib/language-context';
import {
  Search, Calendar, Users, Loader2, Heart, Globe, Home,
  UserCircle, Mail, Phone, Briefcase, MessageCircle, UserPlus,
  Lock, Clock, UserCheck, DollarSign,
} from 'lucide-react';

interface ConnectionState {
  [memberId: string]: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected' | 'removed';
}

interface MemberChatState {
  canSend: boolean;
  paymentStatus: string;
}

export function MembersPage() {
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [mode, setMode] = useState<CommunityVisibilityMode>('open');
  const [connections, setConnections] = useState<ConnectionState>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [chatStates, setChatStates] = useState<Record<string, MemberChatState>>({});

  const loadChatStates = useCallback(async (_memberIds: string[]) => {
    // Single check: can the current user send messages?
    const [canSendRes, paymentRes] = await Promise.all([
      supabase.rpc('can_send_messages'),
      supabase.rpc('get_my_payment_status'),
    ]);
    const canSend = (canSendRes.data as boolean) || false;
    const paymentStatus = (paymentRes.data as { status: string }[] | null)?.[0]?.status || 'none';
    setChatStates({ _global: { canSend, paymentStatus } });
  }, []);

  const loadMembers = useCallback(async () => {
    const [membersRes, modeRes] = await Promise.all([
      supabase.rpc('get_visible_members'),
      supabase.rpc('get_community_visibility_mode'),
    ]);
    const loaded = (membersRes.data as DirectoryMember[]) || [];
    setMembers(loaded);
    setMode((modeRes.data as CommunityVisibilityMode) || 'open');
    setLoading(false);
    loadChatStates(loaded.map((m) => m.id));
  }, [loadChatStates]);

  const loadConnections = useCallback(async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('member_connections')
      .select('requester_id, recipient_id, status')
      .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`);
    const state: ConnectionState = {};
    for (const row of (data || []) as { requester_id: string; recipient_id: string; status: string }[]) {
      const otherId = row.requester_id === currentUser.id ? row.recipient_id : row.requester_id;
      if (row.status === 'pending') {
        state[otherId] = row.requester_id === currentUser.id ? 'pending_sent' : 'pending_received';
      } else {
        state[otherId] = row.status as ConnectionState[string];
      }
    }
    setConnections(state);
  }, [currentUser?.id]);

  useEffect(() => {
    loadMembers();
    loadConnections();
  }, [loadMembers, loadConnections]);

  const handleConnect = async (memberId: string) => {
    setActionLoading(memberId);
    const { error } = await supabase.rpc('send_connection_request', { p_recipient_id: memberId });
    if (error) {
      console.error('Connection request error:', error);
    } else {
      setConnections((prev) => ({ ...prev, [memberId]: 'pending_sent' }));
    }
    setActionLoading(null);
  };

  const handleChatClick = (member: DirectoryMember) => {
    const connState = connections[member.id];
    if (mode === 'private' && connState !== 'accepted') return;
    const cs = chatStates._global;
    if (cs?.canSend) {
      navigate('/chat', {
        state: { newChatUserId: member.id, newChatName: member.full_name, newChatAvatar: member.avatar_url },
      });
    } else if (cs?.paymentStatus === 'pending') {
      return;
    } else {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSubmitted = () => {
    setShowPaymentModal(false);
    loadChatStates(members.map((m) => m.id));
  };

  const filtered = members.filter((m) => {
    if (genderFilter !== 'all' && m.gender !== genderFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.full_name.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('members.title')}</h1>
            <p className="text-slate-600 mt-1">
              {members.length} xuban {members.length === 1 ? 'ansaxay' : 'ansaxay'} ah ee bulshada
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="form-input sm:w-40"
            >
              <option value="all">{t('members.all')}</option>
              <option value="male">{t('members.male')}</option>
              <option value="female">{t('members.female')}</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('members.search')}
                className="form-input pl-10 w-full sm:w-80"
              />
            </div>
          </div>
        </div>

        {/* Privacy mode banner */}
        {mode === 'private' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Bulshada Gaarka ah</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Xubnaha kaliya ee aad la xidhan tahay ayaa halkan muuqda. Si aad u aragto xubno kale,
                ku dar codso dherig bogga xubnaha ama xubnaha kale ha kugu soo diran codso.
              </p>
            </div>
            <button
              onClick={() => navigate('/connections')}
              className="flex items-center gap-1.5 bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Dherigyaday
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">{t('members.noMembers')}</p>
            <p className="text-slate-400 text-sm mt-1">
              {mode === 'private'
                ? 'Bulshada gaarka ah, xubnaha la xidhan yaa halkan muuqda. Codso dherig si aad u xidho xubno cusub.'
                : search
                ? 'Isku day erey kale'
                : 'Soo noqo mar kale xubnaha cusub'}
            </p>
            {mode === 'private' && (
              <button
                onClick={() => navigate('/connections')}
                className="mt-4 inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Eeg Dherigyada & Codsanada
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((member) => {
              const connState = connections[member.id] || 'none';
              const isConnected = connState === 'accepted';
              const isPendingSent = connState === 'pending_sent';
              const isPendingReceived = connState === 'pending_received';

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-emerald-300 transition-all"
                >
                  <div className="flex flex-col items-center text-center">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.full_name}
                        onClick={() => navigate(`/profile/${member.id}`)}
                        className="w-20 h-20 rounded-full object-cover border border-slate-200 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div
                        onClick={() => navigate(`/profile/${member.id}`)}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-2xl font-bold text-emerald-700 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h3
                      onClick={() => navigate(`/profile/${member.id}`)}
                      className="font-semibold text-slate-900 cursor-pointer hover:underline"
                    >{member.full_name}</h3>
                    {member.id === currentUser?.id && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full mt-1">
                        {t('members.you')}
                      </span>
                    )}
                    {isConnected && (
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full mt-1 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {t('members.connected')}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {member.gender && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <UserCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{member.gender === 'male' ? t('members.male') : t('members.female')}</span>
                      </div>
                    )}
                    {member.marital_status && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Heart className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>
                          {member.marital_status === 'single' ? 'Aan guursan' :
                           member.marital_status === 'divorced' ? 'Guur laga xigay' :
                           member.marital_status === 'widowed' ? 'Luumay' :
                           member.marital_status === 'married' ? 'Guursan' :
                           member.marital_status}
                        </span>
                      </div>
                    )}
                    {member.profession && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{member.profession}</span>
                      </div>
                    )}
                    {member.country && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{member.country}</span>
                      </div>
                    )}
                    {member.city && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Home className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{member.city}</span>
                      </div>
                    )}
                    {(isConnected || mode === 'open') && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate text-xs">{member.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-xs">
                        {t('members.joined')} {new Date(member.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  {member.looking_for && (isConnected || mode === 'open') && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        Waxa raadinaya:
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-2">{member.looking_for}</p>
                    </div>
                  )}
                  {member.bio && (isConnected || mode === 'open') && (
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">{member.bio}</p>
                  )}
                  {member.id !== currentUser?.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* Connect button */}
                      {connState === 'none' && (
                        <button
                          onClick={() => handleConnect(member.id)}
                          disabled={actionLoading === member.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                          {t('members.connect')}
                        </button>
                      )}
                      {isPendingSent && (
                        <div className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-500 text-sm font-medium py-2.5 rounded-xl">
                          <Clock className="w-4 h-4" />
                          {t('members.pending')}
                        </div>
                      )}
                      {isPendingReceived && (
                        <button
                          onClick={() => navigate('/connections')}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-amber-100 text-amber-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-amber-200 transition-colors"
                        >
                          <Clock className="w-4 h-4" />
                          {t('members.respond')}
                        </button>
                      )}
                      {/* Chat button */}
                      {isConnected && (
                        <>
                          <ChatButton
                            chatState={chatStates._global}
                            onClick={() => handleChatClick(member)}
                          />
                          {member.phone && (
                            <a
                              href={`tel:${member.phone.replace(/\s+/g, '')}`}
                              className="flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-blue-700 transition-colors"
                              aria-label={`Telefoon u soo dhawow ${member.full_name}`}
                            >
                              <Phone className="w-4 h-4" />
                              {t('members.call')}
                            </a>
                          )}
                        </>
                      )}
                      {!isConnected && mode === 'open' && !isPendingSent && !isPendingReceived && connState !== 'rejected' && connState !== 'removed' && (
                        <ChatButton
                          chatState={chatStates._global}
                          onClick={() => handleChatClick(member)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPaymentModal && (
        <ChatPaymentModal
          onClose={() => setShowPaymentModal(false)}
          onSubmitted={handlePaymentSubmitted}
        />
      )}
    </div>
  );
}

function ChatButton({
  chatState,
  onClick,
}: {
  chatState?: MemberChatState;
  onClick: () => void;
}) {
  const canSend = chatState?.canSend ?? false;
  const paymentStatus = chatState?.paymentStatus ?? 'none';
  const { t } = useLanguage();

  if (canSend) {
    return (
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-emerald-700 transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        {t('members.message')}
      </button>
    );
  }

  if (paymentStatus === 'pending') {
    return (
      <div
        className="flex-1 flex items-center justify-center gap-2 bg-amber-50 text-amber-700 text-sm font-semibold py-2.5 px-4 rounded-xl border border-amber-200"
        title="Codsiga lacagta waa sugaya ansaxinta maamulaha"
      >
        <Clock className="w-4 h-4" />
        {t('members.waiting')}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition-colors"
    >
      <DollarSign className="w-4 h-4 text-emerald-600" />
      {t('members.messagePaid')}
    </button>
  );
}
