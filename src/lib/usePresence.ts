import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Tracks which users are currently online using Supabase Realtime Presence.
 *
 * The current user joins a shared presence channel, and we sync the full
 * presence state to build a Set of online user IDs. No database table is
 * needed — presence is entirely in-memory via the realtime websocket.
 *
 * @param currentUserId  The signed-in user's ID (null if not logged in)
 * @returns A Set of user IDs that are currently online
 */
export function usePresence(currentUserId: string | undefined): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncState = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState();
    const ids = new Set<string>();
    for (const key of Object.keys(state)) {
      const presences = state[key] as unknown as Array<{ user_id: string }>;
      for (const p of presences) {
        if (p.user_id) ids.add(p.user_id);
      }
    }
    setOnlineIds(ids);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        syncState();
      })
      .on('presence', { event: 'join' }, () => {
        syncState();
      })
      .on('presence', { event: 'leave' }, () => {
        syncState();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
          syncState();
        }
      });

    // Heartbeat: re-track every 25s to keep presence alive
    heartbeatRef.current = setInterval(async () => {
      await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
    }, 25000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (channelRef.current) {
        channel.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserId, syncState]);

  return onlineIds;
}
