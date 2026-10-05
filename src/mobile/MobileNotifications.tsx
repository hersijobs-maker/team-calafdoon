import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Bell, Loader2, Heart, MessageCircle, UserCheck, DollarSign } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  actor_id: string;
  actor_name: string;
  actor_avatar: string | null;
  read_at: string | null;
  created_at: string;
  data: Record<string, unknown>;
}

export function MobileNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    loadNotifications();
    const channel = supabase
      .channel('mobile-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
        loadNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, actor_id, actor_name, actor_avatar, read_at, created_at, data')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  };

  const markAllRead = async () => {
    if (!profile?.id) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', profile.id).is('read_at', null);
    loadNotifications();
  };

  const getIcon = (type: string) => {
    if (type.includes('connection')) return <UserCheck className="w-5 h-5 text-emerald-600" />;
    if (type.includes('message')) return <MessageCircle className="w-5 h-5 text-blue-600" />;
    if (type.includes('payment')) return <DollarSign className="w-5 h-5 text-amber-600" />;
    if (type.includes('like')) return <Heart className="w-5 h-5 text-rose-500" />;
    return <Bell className="w-5 h-5 text-slate-500" />;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Hadda';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} daqiiqo kahor`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} saac kahor`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Ogeysiisyada</h1>
        {notifications.some(n => !n.read_at) && (
          <button onClick={markAllRead} className="text-xs font-semibold text-emerald-600">
            Dhammaan akhri
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Ogeysiis ma jiro</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-3.5 ${!n.read_at ? 'bg-emerald-50/50' : 'bg-white'}`}>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                {n.actor_avatar ? (
                  <img src={n.actor_avatar} alt={n.actor_name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  getIcon(n.type)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{n.actor_name}</span>{' '}
                  {n.type.includes('connection_request') && 'waxa kuu diray codsi kulmo'}
                  {n.type.includes('connection_accepted') && 'waxa aqbalay codsigaa kulmo'}
                  {n.type.includes('message') && 'waxa kuu diray fariin'}
                  {n.type.includes('payment_approved') && 'waxa la ansixiyay lacagtaaga'}
                  {n.type.includes('payment_rejected') && 'waxa la diiday lacagtaaga'}
                  {n.type.includes('like') && 'waxa kaaga like gareeyay'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatTime(n.created_at)}</p>
              </div>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
