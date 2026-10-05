import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { Search, Loader2, MessageCircle, UserCheck, Heart, X, AlertCircle } from 'lucide-react';
import type { DirectoryMember } from '@/lib/types';
import type { ChatTarget } from '@/mobile/MobileApp';

const MARITAL_LABELS: Record<string, string> = {
  single: 'Aan guursan', divorced: 'Guur laga xigay', widowed: 'Luumay', married: 'Guursan',
};

export function MobileSearch({ onMessage }: { onMessage: (target: ChatTarget) => void }) {
  const { profile } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DirectoryMember | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string>>({});

  const search = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url, bio, location, profession, created_at, age, gender, country, city, marital_status, looking_for')
      .eq('registration_status', 'approved')
      .neq('id', profile?.id || '')
      .ilike('full_name', `%${query.trim()}%`)
      .order('created_at', { ascending: false })
      .limit(30);
    setResults((data as DirectoryMember[]) || []);
    setLoading(false);
  }, [query, profile?.id]);

  useEffect(() => {
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const sendConnection = async (userId: string) => {
    if (!profile?.id) return;
    const { error } = await supabase
      .from('connections')
      .insert({ requester_id: profile.id, addressee_id: userId, status: 'pending' });
    if (error) {
      if (error.code === '23505') {
        show('Hadda waxaa jira codsi kulmo oo sugita ah.', 'error');
        setConnectionStatuses({ ...connectionStatuses, [userId]: 'pending' });
      } else {
        show('Lama dirin codsiga: ' + error.message, 'error');
      }
    } else {
      setConnectionStatuses({ ...connectionStatuses, [userId]: 'pending' });
      show('Codsiga kulmo waa la diray!', 'success');
    }
  };

  const handleMessage = (m: DirectoryMember) => {
    onMessage({ userId: m.id, fullName: m.full_name, avatarUrl: m.avatar_url });
    setSelected(null);
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-900 mb-2">Raadi Qof</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Magaca qofka..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : !query.trim() ? (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Gali magac si aad u raadto xubnaha</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500">Wax la mid ah lama helin</p>
          </div>
        ) : (
          results.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-3">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt={m.full_name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-lg font-bold text-emerald-700 flex-shrink-0">
                  {m.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{m.full_name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {m.city ? m.city : ''}
                  {m.city && m.marital_status ? ' · ' : ''}
                  {m.marital_status ? MARITAL_LABELS[m.marital_status] || '' : ''}
                </p>
                {m.bio && <p className="text-xs text-slate-400 truncate mt-0.5">{m.bio}</p>}
              </div>
              <button
                onClick={() => setSelected(m)}
                className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
              >
                <Heart className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {selected.avatar_url ? (
                <img src={selected.avatar_url} alt={selected.full_name} className="w-full h-64 object-cover" />
              ) : (
                <div className="w-full h-64 bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
                  <span className="text-4xl font-bold text-emerald-700">{selected.full_name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <h2 className="text-xl font-bold text-slate-900">{selected.full_name}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {selected.city && <Tag label={selected.city} />}
                {selected.country && <Tag label={selected.country} />}
                {selected.marital_status && <Tag label={MARITAL_LABELS[selected.marital_status] || selected.marital_status} />}
                {selected.age && <Tag label={`${selected.age} sano`} />}
              </div>
              {selected.bio && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Iftiiminta</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{selected.bio}</p>
                </div>
              )}
              {selected.looking_for && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Waxa la raadinayo</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{selected.looking_for}</p>
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => sendConnection(selected.id)}
                  disabled={connectionStatuses[selected.id] === 'pending'}
                  className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-5 h-5" />
                  {connectionStatuses[selected.id] === 'pending' ? 'Sugita' : 'Kulmo'}
                </button>
                <button
                  onClick={() => handleMessage(selected)}
                  className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <MessageCircle className="w-5 h-5" />
                  Fariin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{label}</span>
  );
}
