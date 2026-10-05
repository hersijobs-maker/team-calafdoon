import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Phone,
  ArrowLeft,
  Clock,
  Loader2,
  PhoneOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type CallFilter = 'all' | 'missed' | 'incoming' | 'outgoing' | 'answered';

interface CallHistoryEntry {
  id: string;
  caller_id: string;
  callee_id: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  other_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  is_caller: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatCallTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Shalay ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CallHistoryPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CallFilter>('all');

  const loadCalls = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('call_history')
      .select('id, caller_id, callee_id, status, duration_seconds, created_at')
      .or(`caller_id.eq.${profile.id},callee_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading call history:', error);
      setLoading(false);
      return;
    }

    const rows = data as {
      id: string;
      caller_id: string;
      callee_id: string;
      status: string;
      duration_seconds: number | null;
      created_at: string;
    }[] | null;

    if (!rows || rows.length === 0) {
      setCalls([]);
      setLoading(false);
      return;
    }

    const otherUserIds = rows.map((r) =>
      r.caller_id === profile.id ? r.callee_id : r.caller_id,
    );

    const { data: otherProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', otherUserIds);

    const profileMap = new Map(
      (otherProfiles || []).map((p) => [p.id, p]),
    );

    const entries: CallHistoryEntry[] = rows.map((row) => {
      const otherId = row.caller_id === profile.id ? row.callee_id : row.caller_id;
      const other = profileMap.get(otherId);
      return {
        id: row.id,
        caller_id: row.caller_id,
        callee_id: row.callee_id,
        status: row.status,
        duration_seconds: row.duration_seconds,
        created_at: row.created_at,
        is_caller: row.caller_id === profile.id,
        other_user: {
          id: otherId,
          full_name: other?.full_name || 'Xuban',
          avatar_url: other?.avatar_url || null,
        },
      };
    });

    setCalls(entries);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  // Mark missed calls as seen when viewing this page
  useEffect(() => {
    if (!profile?.id || calls.length === 0) return;
    const missedIds = calls
      .filter((c) => !c.is_caller && c.status === 'missed')
      .map((c) => c.id);
    if (missedIds.length > 0) {
      supabase
        .from('call_history')
        .update({ seen_by_callee: true })
        .in('id', missedIds)
        .then(() => {});
    }
  }, [profile?.id, calls]);

  const filteredCalls = calls.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'missed') return c.status === 'missed';
    if (filter === 'incoming') return !c.is_caller;
    if (filter === 'outgoing') return c.is_caller;
    if (filter === 'answered') return c.status === 'answered' || c.status === 'ended';
    return true;
  });

  const filters: { key: CallFilter; label: string }[] = [
    { key: 'all', label: 'Dhamaan' },
    { key: 'missed', label: 'La waayay' },
    { key: 'incoming', label: 'Soo dhacay' },
    { key: 'outgoing', label: 'Ka baxay' },
    { key: 'answered', label: 'La jawaabay' },
  ];

  function getCallIcon(entry: CallHistoryEntry) {
    if (entry.status === 'missed') {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
    if (entry.status === 'declined') {
      return <PhoneOff className="w-4 h-4 text-orange-500" />;
    }
    if (entry.is_caller) {
      return <PhoneOutgoing className="w-4 h-4 text-emerald-500" />;
    }
    return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
  }

  function getCallStatusLabel(entry: CallHistoryEntry): string {
    if (entry.status === 'missed') return 'La waayay';
    if (entry.status === 'declined') return 'La diiday';
    if (entry.status === 'failed') return 'Khalad';
    if (entry.status === 'answered' || entry.status === 'ended') {
      return entry.is_caller ? 'La wiciyay' : 'La jawaabay';
    }
    if (entry.status === 'initiated') return 'Hadda socda...';
    return entry.is_caller ? 'Ka baxay' : 'Soo dhacay';
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => navigate('/chat')}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Dib u laabo"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Phone className="w-5 h-5 text-emerald-600" />
                Tarkiikhda Wicitannada
              </h1>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filter === f.key
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Call list */}
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Phone className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Wicitaan lama jiro</p>
                <p className="text-xs text-slate-400 mt-1">
                  Wicitaanadii aad dhameeysey halkan ayuu ka muuqan doonaa
                </p>
              </div>
            ) : (
              filteredCalls.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 sm:p-4 hover:bg-slate-50 transition-colors"
                >
                  {/* Avatar */}
                  {entry.other_user.avatar_url ? (
                    <img
                      src={entry.other_user.avatar_url}
                      alt={entry.other_user.full_name}
                      className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-base font-bold text-emerald-700 flex-shrink-0">
                      {entry.other_user.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getCallIcon(entry)}
                      <p className="font-semibold text-slate-900 text-sm truncate">
                        {entry.other_user.full_name}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getCallStatusLabel(entry)}
                      {entry.duration_seconds ? ` · ${formatDuration(entry.duration_seconds)}` : ''}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatCallTime(entry.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
