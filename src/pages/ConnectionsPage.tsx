import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import type {
  MyConnection,
  PendingConnectionRequest,
  ConnectionNotification,
  CommunityVisibilityMode,
} from '@/lib/types';
import {
  UserPlus, Check, X, Loader2, Users, Bell, MessageCircle,
  Phone, Trash2, Clock, UserCheck, UserX,
} from 'lucide-react';

type Tab = 'connections' | 'requests' | 'notifications';

export function ConnectionsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('connections');
  const [connections, setConnections] = useState<MyConnection[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionRequest[]>([]);
  const [notifications, setNotifications] = useState<ConnectionNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<CommunityVisibilityMode>('open');

  const loadAll = useCallback(async () => {
    const [connRes, reqRes, notifRes, modeRes] = await Promise.all([
      supabase.rpc('get_my_connections'),
      supabase.rpc('get_pending_connection_requests'),
      supabase.rpc('get_connection_notifications'),
      supabase.rpc('get_community_visibility_mode'),
    ]);
    setConnections((connRes.data as MyConnection[]) || []);
    setPendingRequests((reqRes.data as PendingConnectionRequest[]) || []);
    setNotifications((notifRes.data as ConnectionNotification[]) || []);
    setMode((modeRes.data as CommunityVisibilityMode) || 'open');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel('connection_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'member_connections' },
        () => loadAll(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connection_notifications' },
        () => loadAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const handleAccept = async (connectionId: string) => {
    setActionLoading(connectionId);
    await supabase.rpc('respond_to_connection_request', {
      p_connection_id: connectionId,
      p_accept: true,
    });
    setActionLoading(null);
    loadAll();
  };

  const handleReject = async (connectionId: string) => {
    setActionLoading(connectionId);
    await supabase.rpc('respond_to_connection_request', {
      p_connection_id: connectionId,
      p_accept: false,
    });
    setActionLoading(null);
    loadAll();
  };

  const handleRemove = async (connectionId: string) => {
    setActionLoading(connectionId);
    await supabase.rpc('remove_connection', { p_connection_id: connectionId });
    setActionLoading(null);
    loadAll();
  };

  const handleMarkRead = async (notifId: string) => {
    await supabase.rpc('mark_connection_notification_read', { p_notification_id: notifId });
    loadAll();
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const pendingCount = pendingRequests.length;

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; badge: number }[] = [
    { key: 'connections', label: 'Dherigyaday', icon: UserCheck, badge: connections.length },
    { key: 'requests', label: 'Codsanada', icon: UserPlus, badge: pendingCount },
    { key: 'notifications', label: 'Ogeysiisyada', icon: Bell, badge: unreadCount },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Dherigyada & Xiriirada</h1>
          <p className="text-slate-600 mt-1">
            {mode === 'private' ? 'Bulshada Gaarka ah - Xiriirro ku salaysan' : 'Bulshada Furooto'}
          </p>
        </div>

        {/* Mode banner */}
        {mode === 'private' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm text-amber-800">
              Bulshada waa gaaray. Xubnaha kaliya ee aad la xidhan tahay ayaa aad arki kartaa.
              Si aad u aragto xubno kale, codso dherig.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-200 p-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className={`text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 ${
                    activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Connections tab */}
        {activeTab === 'connections' && (
          <div>
            {connections.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="Dherig lama helin"
                subtitle="Aqbal codsano dherig si aad u bilowdo xidhiidh"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {connections.map((conn) => (
                  <div
                    key={conn.connection_id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {conn.avatar_url ? (
                        <img
                          src={conn.avatar_url}
                          alt={conn.full_name}
                          onClick={() => navigate(`/profile/${conn.user_id}`)}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div
                          onClick={() => navigate(`/profile/${conn.user_id}`)}
                          className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-lg font-bold text-emerald-700 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {conn.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/profile/${conn.user_id}`)}
                      >
                        <p className="font-semibold text-slate-900 truncate hover:underline">{conn.full_name}</p>
                        {conn.profession && (
                          <p className="text-xs text-slate-500 truncate">{conn.profession}</p>
                        )}
                        {conn.country && (
                          <p className="text-xs text-slate-400 truncate">{conn.country}{conn.city ? `, ${conn.city}` : ''}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate('/chat', {
                          state: { newChatUserId: conn.user_id, newChatName: conn.full_name, newChatAvatar: conn.avatar_url },
                        })}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Fariin
                      </button>
                      <button
                        onClick={() => handleRemove(conn.connection_id)}
                        disabled={actionLoading === conn.connection_id}
                        className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold py-2 px-3 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === conn.connection_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Tirtir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests tab */}
        {activeTab === 'requests' && (
          <div>
            {pendingRequests.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Codsano sugita ah ma jiraan"
                subtitle="Codsanada dherig ee la sugayo waa soo bixi doonaan halkan"
              />
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div
                    key={req.connection_id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center gap-3"
                  >
                    {req.requester_avatar ? (
                      <img
                        src={req.requester_avatar}
                        alt={req.requester_name}
                        onClick={() => navigate(`/profile/${req.requester_id}`)}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div
                        onClick={() => navigate(`/profile/${req.requester_id}`)}
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-lg font-bold text-emerald-700 cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {req.requester_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/profile/${req.requester_id}`)}
                    >
                      <p className="font-semibold text-slate-900 truncate hover:underline">{req.requester_name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAccept(req.connection_id)}
                        disabled={actionLoading === req.connection_id}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        aria-label="Aqbal"
                      >
                        {actionLoading === req.connection_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(req.connection_id)}
                        disabled={actionLoading === req.connection_id}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                        aria-label="Diidi"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications tab */}
        {activeTab === 'notifications' && (
          <div>
            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Ogeysiis lama helin"
                subtitle="Ogeysiisyada dherigada cusub waa soo bixi doonaan halkan"
              />
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => {
                  const isUnread = !notif.read_at;
                  const iconMap: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
                    connection_request: { icon: UserPlus, color: 'text-blue-600 bg-blue-100', label: 'waxaa ku codsaday dherig' },
                    connection_accepted: { icon: UserCheck, color: 'text-emerald-600 bg-emerald-100', label: 'waa aqbalay dherigkaaga' },
                    connection_rejected: { icon: UserX, color: 'text-red-600 bg-red-100', label: 'waa diiday dherigkaaga' },
                    connection_removed: { icon: Trash2, color: 'text-slate-600 bg-slate-100', label: 'waa tirtiray dherigka' },
                  };
                  const info = iconMap[notif.type] || iconMap.connection_request;
                  const Icon = info.icon;

                  return (
                    <button
                      key={notif.id}
                      onClick={() => !notif.read_at && handleMarkRead(notif.id)}
                      className={`w-full text-left bg-white rounded-2xl border p-4 flex items-center gap-3 hover:shadow-sm transition-all ${
                        isUnread ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${info.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {notif.actor_avatar ? (
                        <img
                          src={notif.actor_avatar}
                          alt={notif.actor_name}
                          onClick={(e) => { e.stopPropagation(); navigate(`/profile/${notif.actor_id}`); }}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div
                          onClick={(e) => { e.stopPropagation(); navigate(`/profile/${notif.actor_id}`); }}
                          className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {notif.actor_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${notif.actor_id}`); }}
                            className="font-semibold hover:underline"
                          >{notif.actor_name}</button>{' '}
                          <span className="text-slate-600">{info.label}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(notif.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {isUnread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
      <Icon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-500 font-medium">{title}</p>
      <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
    </div>
  );
}
