import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Heart, Users, MessageCircle, UserCheck, Sparkles, Loader2 } from 'lucide-react';

interface NewMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  marital_status: string | null;
}

interface SiteStats {
  approved_count: number;
  connection_count: number;
  new_this_month: number;
}

const MARITAL_LABELS: Record<string, string> = {
  single: 'Aan guursan', divorced: 'Guur laga xigay', widowed: 'Luumay', married: 'Guursan',
};

type Tab = 'home' | 'search' | 'messages' | 'notifications' | 'profile';

export function MobileHome({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { profile } = useAuth();
  const [newMembers, setNewMembers] = useState<NewMember[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);

  const handleMemberTap = () => {
    onNavigate('search');
  };

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_new_members', { p_limit: 6 }).then(({ data }) => data as NewMember[] || []),
      supabase.rpc('get_site_stats').then(({ data }) => data as SiteStats | null),
    ]).then(([members, s]) => {
      setNewMembers(members);
      setStats(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-4 pt-3 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Team Calafdoon</h1>
            <p className="text-emerald-100/80 text-xs">Soo dhawoow, {profile?.full_name?.split(' ')[0]}</p>
          </div>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Users className="w-4 h-4" />} value={stats.approved_count} label="Xubnaha" />
            <StatCard icon={<UserCheck className="w-4 h-4" />} value={stats.connection_count} label="Kulanno" />
            <StatCard icon={<Sparkles className="w-4 h-4" />} value={stats.new_this_month} label="Cusub" />
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4 -mt-3">
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={<Users />} label="Xubnaha" onClick={() => onNavigate('search')} />
          <QuickAction icon={<MessageCircle />} label="Fariimaha" onClick={() => onNavigate('messages')} />
        </div>
      </div>

      {/* New members */}
      <div className="px-4 mt-6 pb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Xubnaha Cusub</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : newMembers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Wax xubno ah ma jiro</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {newMembers.map((m) => (
              <button key={m.id} onClick={handleMemberTap} className="text-left active:scale-95 transition-transform">
                <MemberCard member={m} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 text-center">
      <div className="flex justify-center mb-1 text-white/80">{icon}</div>
      <p className="text-white font-bold text-lg leading-none">{value}</p>
      <p className="text-emerald-100/70 text-[10px] mt-0.5">{label}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 active:scale-95 transition-transform">
      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
        {icon}
      </div>
      <span className="font-semibold text-slate-900 text-sm">{label}</span>
    </button>
  );
}

function MemberCard({ member }: { member: NewMember }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="aspect-square bg-slate-100">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-200">
            <span className="text-2xl font-bold text-emerald-700">{member.full_name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-slate-900 text-sm truncate">{member.full_name}</p>
        <p className="text-xs text-slate-500 truncate">
          {member.city ? member.city : ''}
          {member.city && member.marital_status ? ' · ' : ''}
          {member.marital_status ? MARITAL_LABELS[member.marital_status] || '' : ''}
        </p>
      </div>
    </div>
  );
}
