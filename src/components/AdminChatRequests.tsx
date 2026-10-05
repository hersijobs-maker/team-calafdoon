import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  Loader2, Check, X, MessageCircle, Clock, Search,
  CheckCircle2, XCircle, DollarSign, Image as ImageIcon,
  Users, User, Globe, Calendar,
} from 'lucide-react';

interface PaymentRequest {
  payment_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  email: string;
  amount: number;
  screenshot_url: string;
  status: string;
  created_at: string;
  admin_action_at: string | null;
}

interface EligibleMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

type ApproveMode = 'one' | 'several' | 'everyone';

export function AdminChatRequests({ onPendingCountChange }: { onPendingCountChange?: () => void }) {
  const { show } = useToast();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [search, setSearch] = useState('');
  const [approveModal, setApproveModal] = useState<PaymentRequest | null>(null);
  const [detailRequest, setDetailRequest] = useState<PaymentRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_payment_requests');
    if (error) {
      show('Lama soo degin codsiga: ' + error.message, 'error');
    } else {
      setRequests((data as PaymentRequest[]) || []);
    }
    setLoading(false);
    onPendingCountChange?.();
  }, [show, onPendingCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReject = async (paymentId: string) => {
    setActionLoading(paymentId);
    const { error } = await supabase.rpc('admin_reject_payment', { p_payment_id: paymentId });
    if (error) {
      show('Lama diidin codsiga: ' + error.message, 'error');
    } else {
      show('Codsiga waa la diiday.', 'success');
      await load();
    }
    setActionLoading(null);
  };

  const filtered = requests.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.user_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  const tabs: { key: string; label: string; count: number }[] = [
    { key: 'pending', label: 'Sugita', count: counts.pending },
    { key: 'approved', label: 'Ansixiyay', count: counts.approved },
    { key: 'rejected', label: 'Diiday', count: counts.rejected },
    { key: 'all', label: 'Dhammaan', count: counts.all },
  ];

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };
  const statusLabels: Record<string, string> = {
    pending: 'Sugita',
    approved: 'Ansixiyay',
    rejected: 'Diiday',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900">Codsiga Fariimaha</h2>
        {counts.pending > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            {counts.pending} sugita
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              filterStatus === tab.key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              filterStatus === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Raadi xuban..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Codsigo lama helin</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((req) => (
            <div key={req.payment_id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[req.status]}`}>
                  {statusLabels[req.status]}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* User info */}
              <div className="flex items-center gap-3 mb-3">
                {req.user_avatar ? (
                  <img src={req.user_avatar} alt={req.user_name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                    {req.user_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{req.user_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{req.email}</p>
                </div>
              </div>

              {/* Payment info */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-900 font-bold">${req.amount}</span>
                </div>
                {req.screenshot_url && (
                  <button
                    onClick={() => setDetailRequest(req)}
                    className="flex items-center gap-1.5 text-emerald-600 hover:underline"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Eeg sawirka cadbinta
                  </button>
                )}
              </div>

              {/* Actions */}
              {req.status === 'pending' && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setApproveModal(req)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Ansixi
                  </button>
                  <button
                    onClick={() => handleReject(req.payment_id)}
                    disabled={actionLoading === req.payment_id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === req.payment_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    Diidi
                  </button>
                </div>
              )}

              {req.status === 'approved' && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-3 pt-3 border-t border-slate-100">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Lacagta waa la ansixiyay
                </div>
              )}

              {req.status === 'rejected' && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-3 pt-3 border-t border-slate-100">
                  <XCircle className="w-3.5 h-3.5" />
                  Lacagta waa la diiday
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <ApproveModal
          request={approveModal}
          onClose={() => setApproveModal(null)}
          onApproved={() => {
            setApproveModal(null);
            load();
          }}
        />
      )}

      {/* Screenshot Detail Modal */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailRequest(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-slate-900">Sawirka Cadbinta</h3>
              <button onClick={() => setDetailRequest(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                {detailRequest.user_avatar ? (
                  <img src={detailRequest.user_avatar} alt={detailRequest.user_name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600">
                    {detailRequest.user_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900">{detailRequest.user_name}</p>
                  <p className="text-xs text-slate-500">${detailRequest.amount} · {new Date(detailRequest.created_at).toLocaleString('en-US')}</p>
                </div>
              </div>
              {detailRequest.screenshot_url && (
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <img src={detailRequest.screenshot_url} alt="Payment proof" className="w-full max-h-96 object-contain bg-slate-50" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// Approve Modal — select ONE / SEVERAL / EVERYONE
// =============================================================
function ApproveModal({
  request,
  onClose,
  onApproved,
}: {
  request: PaymentRequest;
  onClose: () => void;
  onApproved: () => void;
}) {
  const { show } = useToast();
  const [mode, setMode] = useState<ApproveMode>('one');
  const [members, setMembers] = useState<EligibleMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [singleId, setSingleId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase.rpc('get_approved_users_for_selection').then(({ data }) => {
      const eligible = ((data as EligibleMember[]) || []).filter((m) => m.id !== request.user_id);
      setMembers(eligible);
      setLoading(false);
    });
  }, [request.user_id]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async () => {
    setSubmitting(true);

    let rpcName: string;
    let params: Record<string, unknown>;

    if (mode === 'one') {
      if (!singleId) {
        show('Fadlan dooro hal xuban', 'error');
        setSubmitting(false);
        return;
      }
      rpcName = 'admin_approve_payment_one';
      params = { p_payment_id: request.payment_id, p_target_id: singleId };
    } else if (mode === 'several') {
      if (selectedIds.size === 0) {
        show('Fadlan dooro ugu yaraan hal xuban', 'error');
        setSubmitting(false);
        return;
      }
      rpcName = 'admin_approve_payment_selected';
      params = { p_payment_id: request.payment_id, p_target_ids: Array.from(selectedIds) };
    } else {
      rpcName = 'admin_approve_payment_everyone';
      params = { p_payment_id: request.payment_id };
    }

    const { error } = await supabase.rpc(rpcName, params);

    if (error) {
      show('Lama ansixin codsiga: ' + error.message, 'error');
      setSubmitting(false);
      return;
    }

    const msg = mode === 'one' ? 'Fariimaha waa la furay hal xuban.'
      : mode === 'several' ? `Fariimaha waa la furay ${selectedIds.size} xuban.`
      : 'Fariimaha waa la furay dhammaan xubnaha.';
    show(msg, 'success');
    onApproved();
    setSubmitting(false);
  };

  const filteredMembers = members.filter((m) =>
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()),
  );

  const modeOptions: { value: ApproveMode; label: string; icon: typeof User; desc: string }[] = [
    { value: 'one', label: 'Hal Xuban', icon: User, desc: 'Furi fariimaha hal xuban keliya' },
    { value: 'several', label: 'Dhowr Xuban', icon: Users, desc: 'Dooro dhowr xuban' },
    { value: 'everyone', label: 'Dhammaan', icon: Globe, desc: 'Furi dhammaan xubnaha ansaxay' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Ansixi & Furi Fariimaha</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          <div className="mt-3 bg-slate-50 rounded-lg p-3 flex items-center gap-3">
            {request.user_avatar ? (
              <img src={request.user_avatar} alt={request.user_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                {request.user_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900 text-sm">{request.user_name}</p>
              <p className="text-xs text-slate-500">${request.amount} · {new Date(request.created_at).toLocaleDateString('en-US')}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nooca Furu-ka</label>
            <div className="space-y-2">
              {modeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      mode === opt.value
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      mode === opt.value ? 'bg-emerald-100' : 'bg-slate-100'
                    }`}>
                      <Icon className={`w-4 h-4 ${mode === opt.value ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </div>
                    {mode === opt.value && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member selection — only for 'one' and 'several' */}
          {mode !== 'everyone' && (
            <div className="border-2 border-slate-200 rounded-xl p-3 space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                {mode === 'one' ? 'Dooro Xuban' : `Dooro Xubnaha (${selectedIds.size} la doortay)`}
              </label>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Raadi xuban..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filteredMembers.map((m) => {
                    const isSelected = mode === 'one' ? singleId === m.id : selectedIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (mode === 'one') {
                            setSingleId(isSelected ? null : m.id);
                          } else {
                            toggleMember(m.id);
                          }
                        }}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={m.full_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                            {m.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-slate-900 flex-1 truncate">{m.full_name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Xubno lama helin</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
            <p className="text-emerald-800 font-medium mb-1">Soo koobid:</p>
            <p className="text-emerald-700 text-xs">
              {request.user_name} waxaad furaysaa fariimaha:
              {mode === 'one' && (singleId ? ` hal xuban` : ' — fadlan dooro')}
              {mode === 'several' && ` ${selectedIds.size} xuban`}
              {mode === 'everyone' && ' dhammaan xubnaha ansaxay'}
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Ansixi & Furi
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
            Jooji
          </button>
        </div>
      </div>
    </div>
  );
}
