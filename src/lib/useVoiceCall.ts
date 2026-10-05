import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { subscribeToPush } from '@/lib/notifications';

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'incoming'
  | 'requesting_mic'
  | 'connecting'
  | 'active'
  | 'ended';

export type MicErrorType = 'none' | 'denied' | 'notfound' | 'other';

export interface CallPeer {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface MissedCallNotification {
  id: string;
  caller_id: string;
  caller_name: string;
  caller_avatar: string | null;
  created_at: string;
}

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice' | 'end' | 'reject' | 'busy' | 'ringing';
  sdp?: string;
  ice?: RTCIceCandidateInit;
  call_id?: string;
  is_video?: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const RING_TIMEOUT_MS = 45000;

function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceTransportPolicy: 'all',
  });
}

export function useVoiceCall(
  currentUserId: string | undefined,
  onToast: (msg: string, type: 'info' | 'error' | 'success') => void,
) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState<MicErrorType>('none');
  const [micRequesting, setMicRequesting] = useState(false);
  const [missedCall, setMissedCall] = useState<MissedCallNotification | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [localVideoReady, setLocalVideoReady] = useState(false);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const incomingChannelRef = useRef<RealtimeChannel | null>(null);
  const signalChannelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callerIdRef = useRef<string | null>(null);
  const calleeIdRef = useRef<string | null>(null);
  const statusRef = useRef<CallStatus>('idle');
  const iceBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<{ sdp: string; isVideo: boolean; callId: string } | null>(null);
  const isCallerRef = useRef<boolean>(false);
  const callHistoryIdRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const answeredAtRef = useRef<number | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const rejectCallRef = useRef<() => void>(() => {});

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Keep audio element for remote stream
  useEffect(() => {
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
      audioElRef.current.autoplay = true;
    }
  }, []);

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      setLocalVideoReady(true);
    }
  }, [isVideoCall, status]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  }, [stopTimer]);

  // ========== RINGTONE ==========
  const startRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    const audio = new Audio('/sounds/incoming-ringtone.wav');
    audio.loop = true;
    audio.volume = 0.7;
    ringtoneRef.current = audio;
    audio.play().catch(() => {
      // Autoplay may be blocked until user interaction — try again on first click
      const resumeOnInteract = () => {
        audio.play().catch(() => {});
        document.removeEventListener('click', resumeOnInteract);
        document.removeEventListener('touchstart', resumeOnInteract);
      };
      document.addEventListener('click', resumeOnInteract, { once: true });
      document.addEventListener('touchstart', resumeOnInteract, { once: true });
    });
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
  }, []);

  // ========== CALL HISTORY HELPERS ==========
  const createCallHistory = useCallback(
    async (callerId: string, calleeId: string, isVideo: boolean): Promise<string | null> => {
      const { data, error } = await supabase
        .from('call_history')
        .insert({
          caller_id: callerId,
          callee_id: calleeId,
          status: 'initiated',
        })
        .select('id')
        .single();
      if (error) {
        console.error('Error creating call history:', error);
        return null;
      }
      return (data as { id: string }).id;
    },
    [],
  );

  const updateCallHistory = useCallback(
    async (
      historyId: string | null,
      updates: {
        status?: string;
        duration_seconds?: number;
        answered_at?: string;
        ended_at?: string;
      },
    ) => {
      if (!historyId) return;
      await supabase.from('call_history').update(updates).eq('id', historyId);
    },
    [],
  );

  const insertCallEvent = useCallback(
    async (
      historyId: string | null,
      callerId: string,
      calleeId: string,
      callStatus: 'missed' | 'declined' | 'answered' | 'ended' | 'failed',
      durationSeconds: number | null,
    ) => {
      if (!historyId || !currentUserId) return;
      const { data: conv } = await supabase
        .from('chat_conversations')
        .select('id')
        .or(
          `and(user1_id.eq.${callerId},user2_id.eq.${calleeId}),and(user1_id.eq.${calleeId},user2_id.eq.${callerId})`,
        )
        .maybeSingle();
      let convId: string | null = (conv as { id: string } | null)?.id ?? null;
      if (!convId) {
        const { data: newConv, error } = await supabase
          .from('chat_conversations')
          .insert({ user1_id: callerId, user2_id: calleeId })
          .select('id')
          .single();
        if (error) {
          console.error('Error creating conversation for call event:', error);
          return;
        }
        convId = (newConv as { id: string }).id;
      }
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: convId,
          sender_id: callerId,
          content: callStatus,
          message_type: 'call_event',
          call_status: callStatus,
          call_duration_seconds: durationSeconds,
          call_history_id: historyId,
        });
      if (insertError && insertError.code !== '23505') {
        console.error('Error inserting call event:', insertError);
      }
    },
    [currentUserId],
  );

  const cleanupCall = useCallback(() => {
    stopTimer();
    stopRingtone();
    setElapsed(0);
    setMuted(false);
    setMicError('none');
    setMicRequesting(false);
    setIsVideoCall(false);
    setLocalVideoReady(false);
    setRemoteVideoReady(false);

    if (ringTimerRef.current) {
      clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (signalChannelRef.current) {
      supabase.removeChannel(signalChannelRef.current);
      signalChannelRef.current = null;
    }
    iceBufferRef.current = [];
    pendingOfferRef.current = null;
    callerIdRef.current = null;
    calleeIdRef.current = null;
    callHistoryIdRef.current = null;
    callIdRef.current = null;
    answeredAtRef.current = null;
    setStatus('idle');
    setPeer(null);
  }, [stopTimer, stopRingtone]);

  // ========== SIGNALING via Broadcast + DB ==========
  // For ICE/answer: use realtime broadcast (fast, no DB writes)
  // For offer/end/reject/busy/ringing: use DB insert (durable, works across sessions)

  const sendSignal = useCallback(
    async (toUserId: string, fromUserId: string, payload: SignalPayload) => {
      await supabase.from('call_signals').insert({
        caller_id: fromUserId,
        callee_id: toUserId,
        type: payload.type,
        sdp: payload.sdp ?? null,
        ice: payload.ice ?? null,
        call_id: payload.call_id ?? callIdRef.current,
        is_video: payload.is_video ?? false,
      });
    },
    [],
  );

  // Send a broadcast message on the shared call channel (for ICE/answer — fast path)
  const sendBroadcast = useCallback(
    (type: string, data: Record<string, unknown>) => {
      const chan = signalChannelRef.current;
      if (!chan) return;
      chan.send({
        type: 'broadcast',
        event: `signal_${callIdRef.current}`,
        payload: { type, ...data, from: currentUserId },
      });
    },
    [currentUserId],
  );

  const clearSignals = useCallback(async (otherId: string) => {
    if (!currentUserId) return;
    await supabase
      .from('call_signals')
      .delete()
      .or(`caller_id.eq.${currentUserId},callee_id.eq.${currentUserId}`)
      .or(`caller_id.eq.${otherId},callee_id.eq.${otherId}`);
  }, [currentUserId]);

  // ========== WEBRTC SETUP ==========

  const setupPeerConnection = useCallback(
    (pc: RTCPeerConnection, otherId: string, isCaller: boolean) => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && currentUserId) {
          // Use broadcast for fast ICE exchange
          sendBroadcast('ice', { ice: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        remoteStreamRef.current = remoteStream;
        if (audioElRef.current) {
          audioElRef.current.srcObject = remoteStream;
          audioElRef.current.play().catch(() => {});
        }
        // Check for video tracks
        const hasVideo = remoteStream.getVideoTracks().length > 0;
        if (hasVideo) {
          setRemoteVideoReady(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
          }
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          setStatus('active');
          statusRef.current = 'active';
          stopRingtone();
          startTimer();
          answeredAtRef.current = Date.now();
          if (callHistoryIdRef.current) {
            updateCallHistory(callHistoryIdRef.current, {
              status: 'answered',
              answered_at: new Date().toISOString(),
            });
          }
        } else if (state === 'failed' || state === 'disconnected') {
          if (statusRef.current === 'active' || statusRef.current === 'connecting') {
            onToast('Isku xirka waa la jebiyay', 'error');
            if (callHistoryIdRef.current && answeredAtRef.current) {
              const dur = Math.floor((Date.now() - answeredAtRef.current) / 1000);
              updateCallHistory(callHistoryIdRef.current, {
                status: 'ended',
                ended_at: new Date().toISOString(),
                duration_seconds: dur,
              });
              insertCallEvent(callHistoryIdRef.current, callerIdRef.current!, calleeIdRef.current!, 'ended', dur);
            } else if (callHistoryIdRef.current) {
              updateCallHistory(callHistoryIdRef.current, {
                status: 'failed',
                ended_at: new Date().toISOString(),
              });
              insertCallEvent(callHistoryIdRef.current, callerIdRef.current!, calleeIdRef.current!, 'failed', null);
            }
            cleanupCall();
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' && statusRef.current === 'active') {
          onToast('Isku xirka waa la jebiyay', 'error');
          cleanupCall();
        }
      };
    },
    [currentUserId, sendBroadcast, startTimer, stopRingtone, cleanupCall, onToast, updateCallHistory, insertCallEvent],
  );

  const handleRemoteIce = useCallback(async (ice: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc) {
      iceBufferRef.current.push(ice);
      return;
    }
    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(ice));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    } else {
      iceBufferRef.current.push(ice);
    }
  }, []);

  const flushIceBuffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    for (const ice of iceBufferRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(ice));
      } catch (e) {
        console.error('Error flushing ICE:', e);
      }
    }
    iceBufferRef.current = [];
  }, []);

  const handleRemoteSdp = useCallback(
    async (type: 'offer' | 'answer', sdp: string, otherId: string) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        await flushIceBuffer();
        if (type === 'offer' && currentUserId) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendBroadcast('answer', { sdp: answer.sdp });
        }
      } catch (e) {
        console.error('Error handling remote SDP:', e);
      }
    },
    [currentUserId, sendBroadcast, flushIceBuffer],
  );

  // ========== SIGNAL CHANNEL (Broadcast) ==========
  // Subscribe to a shared broadcast channel for fast ICE/answer exchange

  const subscribeSignalChannel = useCallback(
    (otherId: string, isCaller: boolean) => {
      if (!currentUserId || !callIdRef.current) return;
      if (signalChannelRef.current) {
        supabase.removeChannel(signalChannelRef.current);
      }

      const chan = supabase.channel(`call_${callIdRef.current}`, {
        config: { broadcast: { self: false } },
      });

      chan
        .on('broadcast', { event: `signal_${callIdRef.current}` }, (msg) => {
          const payload = msg.payload as {
            type: string;
            sdp?: string;
            ice?: RTCIceCandidateInit;
            from: string;
          };
          if (payload.from !== otherId) return;

          if (payload.type === 'answer' && payload.sdp) {
            handleRemoteSdp('answer', payload.sdp, otherId);
          } else if (payload.type === 'ice' && payload.ice) {
            handleRemoteIce(payload.ice);
          }
        })
        .subscribe();

      signalChannelRef.current = chan;
    },
    [currentUserId, handleRemoteSdp, handleRemoteIce],
  );

  // ========== INCOMING CALL LISTENER (DB-based, always active) ==========

  useEffect(() => {
    if (!currentUserId) return;

    console.log('[Call] Setting up incoming call listener for user:', currentUserId);

    let incomingChan: RealtimeChannel | null = null;

    incomingChan = supabase
      .channel(`incoming_calls_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `callee_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            caller_id: string;
            callee_id: string;
            type: string;
            sdp: string | null;
            call_id: string | null;
            is_video: boolean;
          };

          console.log('[Call] Realtime event received:', {
            type: row.type,
            caller_id: row.caller_id,
            callee_id: row.callee_id,
            call_id: row.call_id,
            has_sdp: !!row.sdp,
            receiver_uid: currentUserId,
            current_status: statusRef.current,
          });

          // Only process 'offer' signals as new incoming calls
          if (row.type !== 'offer' || !row.sdp) {
            console.log('[Call] Ignoring signal (not offer or no SDP):', row.type);
            return;
          }

          // If we're busy, send 'busy' signal
          if (statusRef.current !== 'idle') {
            console.log('[Call] Receiver busy, sending busy signal. Status:', statusRef.current);
            await supabase.from('call_signals').insert({
              caller_id: currentUserId,
              callee_id: row.caller_id,
              type: 'busy',
              call_id: row.call_id,
            });
            return;
          }

          console.log('[Call] Fetching caller profile for:', row.caller_id);
          const { data: callerProfile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', row.caller_id)
            .maybeSingle();

          if (!callerProfile) {
            console.error('[Call] Caller profile not found:', row.caller_id);
            return;
          }

          console.log('[Call] Incoming call event processed:', {
            caller_id: row.caller_id,
            caller_name: (callerProfile as { full_name: string }).full_name,
            call_id: row.call_id,
            receiver_id: currentUserId,
          });

          callerIdRef.current = row.caller_id;
          calleeIdRef.current = currentUserId;
          callIdRef.current = row.call_id || crypto.randomUUID();
          setPeer({
            id: row.caller_id,
            full_name: (callerProfile as { full_name: string }).full_name,
            avatar_url: (callerProfile as { avatar_url: string | null }).avatar_url,
          });
          setIsVideoCall(row.is_video);
          pendingOfferRef.current = { sdp: row.sdp, isVideo: row.is_video, callId: callIdRef.current };
          setStatus('incoming');
          statusRef.current = 'incoming';

          console.log('[Call] Status set to incoming, CallUI should render. Peer:', {
            id: row.caller_id,
            name: (callerProfile as { full_name: string }).full_name,
          });

          // Play ringtone
          startRingtone();

          // Start ring timeout for receiver (auto-decline after timeout)
          ringTimeoutRef.current = setTimeout(() => {
            if (statusRef.current === 'incoming') {
              console.log('[Call] Ring timeout reached, auto-rejecting call:', callIdRef.current);
              rejectCallRef.current();
            }
          }, RING_TIMEOUT_MS);
        },
      )
      .subscribe((status, err) => {
        console.log('[Call] Incoming listener subscription status:', status, err ? `Error: ${err}` : '');
      });

    return () => {
      console.log('[Call] Cleaning up incoming call listener for user:', currentUserId);
      if (incomingChan) {
        supabase.removeChannel(incomingChan);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ========== MICROPHONE / CAMERA PERMISSION ==========

  const requestMedia = useCallback(
    async (video: boolean): Promise<MediaStream | null> => {
      setMicError('none');
      setMicRequesting(true);
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: video
            ? {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 },
              }
            : false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setMicRequesting(false);
        return stream;
      } catch (e: unknown) {
        setMicRequesting(false);
        const err = e as DOMException;
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setMicError('denied');
        } else if (
          err.name === 'NotFoundError' ||
          err.name === 'DevicesNotFoundError' ||
          err.name === 'OverconstrainedError'
        ) {
          setMicError('notfound');
        } else {
          setMicError('other');
        }
        return null;
      }
    },
    [],
  );

  // ========== CALLER FLOW ==========

  const startCall = useCallback(
    (targetPeer: CallPeer, video: boolean = false) => {
      if (!currentUserId || statusRef.current !== 'idle') {
        onToast('Hadda waa la mid wici karaa', 'error');
        return;
      }

      callerIdRef.current = currentUserId;
      calleeIdRef.current = targetPeer.id;
      isCallerRef.current = true;
      callIdRef.current = crypto.randomUUID();
      setPeer(targetPeer);
      setIsVideoCall(video);
      setMicError('none');
      setStatus('requesting_mic');
      statusRef.current = 'requesting_mic';
      grantMicAndProceed();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, onToast],
  );

  const proceedWithOutgoingCall = useCallback(
    async (stream: MediaStream) => {
      if (!currentUserId || !peer) return;

      localStreamRef.current = stream;
      const pc = createPeerConnection();
      pcRef.current = pc;
      setStatus('calling');
      statusRef.current = 'calling';

      const historyId = await createCallHistory(currentUserId, peer.id, isVideoCall);
      callHistoryIdRef.current = historyId;

      setupPeerConnection(pc, peer.id, true);
      subscribeSignalChannel(peer.id, true);

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: isVideoCall,
        });
        await pc.setLocalDescription(offer);
        console.log('[Call] Offer signal sent to:', peer.id, 'call_id:', callIdRef.current);
        await sendSignal(peer.id, currentUserId, {
          type: 'offer',
          sdp: offer.sdp,
          call_id: callIdRef.current ?? undefined,
          is_video: isVideoCall,
        });
        console.log('[Call] Offer signal inserted into call_signals table');

        // Fire-and-forget: send push notification to callee for background alert
        const callerName = peer.full_name;
        const calleeId = peer.id;
        const callId = callIdRef.current;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-call-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            callee_id: calleeId,
            caller_name: callerName,
            is_video: isVideoCall,
            call_id: callId,
          }),
        }).catch(() => {
          // Push notification is best-effort; ignore failures
        });

        // Start ring timeout — if no answer in RING_TIMEOUT_MS, end as missed
        ringTimeoutRef.current = setTimeout(() => {
          if (statusRef.current === 'calling' || statusRef.current === 'ringing') {
            if (callHistoryIdRef.current) {
              updateCallHistory(callHistoryIdRef.current, {
                status: 'missed',
                ended_at: new Date().toISOString(),
              });
              insertCallEvent(callHistoryIdRef.current, currentUserId, peer.id, 'missed', null);
            }
            onToast('Wicitaan jawaab ma helin', 'info');
            cleanupCall();
          }
        }, RING_TIMEOUT_MS);
      } catch (e) {
        console.error('Error creating offer:', e);
        onToast('Khalad ayaa dhacay', 'error');
        if (historyId) {
          updateCallHistory(historyId, {
            status: 'failed',
            ended_at: new Date().toISOString(),
          });
          insertCallEvent(historyId, currentUserId, peer.id, 'failed', null);
        }
        cleanupCall();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, peer, isVideoCall, setupPeerConnection, subscribeSignalChannel, sendSignal, cleanupCall, onToast, createCallHistory, updateCallHistory, insertCallEvent],
  );

  // ========== CALLEE FLOW ==========

  const acceptCall = useCallback(() => {
    console.log('[Call] acceptCall clicked. peer:', peer?.id, 'callId:', callIdRef.current);
    if (!currentUserId || !peer || !pendingOfferRef.current) return;
    stopRingtone();
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    isCallerRef.current = false;
    setIsVideoCall(pendingOfferRef.current.isVideo);
    setMicError('none');
    setStatus('requesting_mic');
    statusRef.current = 'requesting_mic';
    grantMicAndProceed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, peer, stopRingtone]);

  const proceedWithIncomingCall = useCallback(
    async (stream: MediaStream) => {
      if (!currentUserId || !peer || !pendingOfferRef.current) return;

      localStreamRef.current = stream;
      const pc = createPeerConnection();
      pcRef.current = pc;
      setStatus('connecting');
      statusRef.current = 'connecting';

      setupPeerConnection(pc, peer.id, false);
      subscribeSignalChannel(peer.id, false);

      try {
        await handleRemoteSdp('offer', pendingOfferRef.current.sdp, peer.id);
        pendingOfferRef.current = null;
      } catch (e) {
        console.error('Error accepting call:', e);
        onToast('Khalad ayaa dhacay', 'error');
        cleanupCall();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, peer, setupPeerConnection, subscribeSignalChannel, handleRemoteSdp, cleanupCall, onToast],
  );

  const grantMicAndProceed = useCallback(async () => {
    const stream = await requestMedia(isVideoCall);
    if (!stream) return;

    if (isCallerRef.current) {
      await proceedWithOutgoingCall(stream);
    } else {
      await proceedWithIncomingCall(stream);
    }
  }, [requestMedia, proceedWithOutgoingCall, proceedWithIncomingCall, isVideoCall]);

  const rejectCall = useCallback(async () => {
    console.log('[Call] rejectCall called. peer:', peer?.id, 'callId:', callIdRef.current);
    if (!currentUserId || !peer) return;
    stopRingtone();
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    await sendSignal(peer.id, currentUserId, { type: 'reject', call_id: callIdRef.current ?? undefined });
    cleanupCall();
  }, [currentUserId, peer, sendSignal, cleanupCall, stopRingtone]);

  // Keep rejectCallRef updated so the incoming call timeout always calls the latest version
  useEffect(() => {
    rejectCallRef.current = rejectCall;
  }, [rejectCall]);

  // ========== LISTEN FOR CALL CONTROL SIGNALS (DB-based, for the caller) ==========

  // Caller listens for ringing/reject/busy/end signals via DB realtime
  useEffect(() => {
    if (!currentUserId || !isCallerRef.current) return;
    if (status !== 'calling' && status !== 'ringing') return;

    const controlChan = supabase
      .channel(`call_control_${currentUserId}_${callIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `callee_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            caller_id: string;
            callee_id: string;
            type: string;
            call_id: string | null;
          };

          // Only process signals for our current call
          if (row.caller_id !== calleeIdRef.current) return;
          if (callIdRef.current && row.call_id && row.call_id !== callIdRef.current) return;

          if (row.type === 'ringing') {
            setStatus('ringing');
            statusRef.current = 'ringing';
          } else if (row.type === 'reject') {
            onToast('Fariinta waa la diiday', 'info');
            if (callHistoryIdRef.current) {
              updateCallHistory(callHistoryIdRef.current, {
                status: 'declined',
                ended_at: new Date().toISOString(),
              });
              insertCallEvent(callHistoryIdRef.current, callerIdRef.current!, calleeIdRef.current!, 'declined', null);
            }
            cleanupCall();
          } else if (row.type === 'busy') {
            onToast('Qofku waa mashquul yahay', 'info');
            if (callHistoryIdRef.current) {
              updateCallHistory(callHistoryIdRef.current, {
                status: 'missed',
                ended_at: new Date().toISOString(),
              });
              insertCallEvent(callHistoryIdRef.current, callerIdRef.current!, calleeIdRef.current!, 'missed', null);
            }
            cleanupCall();
          } else if (row.type === 'end') {
            if (callHistoryIdRef.current && answeredAtRef.current) {
              const dur = Math.floor((Date.now() - answeredAtRef.current) / 1000);
              updateCallHistory(callHistoryIdRef.current, {
                status: 'ended',
                ended_at: new Date().toISOString(),
                duration_seconds: dur,
              });
              insertCallEvent(callHistoryIdRef.current, callerIdRef.current!, calleeIdRef.current!, 'ended', dur);
            }
            cleanupCall();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(controlChan);
    };
  }, [currentUserId, status, onToast, cleanupCall, updateCallHistory, insertCallEvent]);

  // ========== END CALL ==========

  const endCall = useCallback(async () => {
    console.log('[Call] endCall clicked. peer:', peer?.id, 'callId:', callIdRef.current, 'isCaller:', isCallerRef.current);
    stopRingtone();
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    if (callHistoryIdRef.current) {
      if (answeredAtRef.current) {
        const dur = Math.floor((Date.now() - answeredAtRef.current) / 1000);
        updateCallHistory(callHistoryIdRef.current, {
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: dur,
        });
        insertCallEvent(callHistoryIdRef.current, callerIdRef.current!, calleeIdRef.current!, 'ended', dur);
      } else if (isCallerRef.current && (statusRef.current === 'calling' || statusRef.current === 'ringing' || statusRef.current === 'requesting_mic')) {
        updateCallHistory(callHistoryIdRef.current, {
          status: 'missed',
          ended_at: new Date().toISOString(),
        });
        insertCallEvent(callHistoryIdRef.current, callerIdRef.current!, calleeIdRef.current!, 'missed', null);
      }
    }

    if (peer && currentUserId && callIdRef.current) {
      await sendSignal(peer.id, currentUserId, { type: 'end', call_id: callIdRef.current });
    }
    cleanupCall();
  }, [peer, currentUserId, sendSignal, cleanupCall, stopRingtone, updateCallHistory, insertCallEvent]);

  // ========== MUTE / UNMUTE ==========

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // ========== VIDEO TOGGLE ==========

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        // Update state to trigger UI update
        setLocalVideoReady(videoTrack.enabled);
      }
    }
  }, []);

  // ========== MISSED CALL NOTIFICATIONS ==========

  useEffect(() => {
    if (!currentUserId) return;

    const loadMissedCalls = async () => {
      const { data, error } = await supabase
        .from('call_history')
        .select('id, caller_id, created_at, seen_by_callee')
        .eq('callee_id', currentUserId)
        .eq('status', 'missed')
        .eq('seen_by_callee', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return;

      const latest = data[0] as { id: string; caller_id: string; created_at: string };
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', latest.caller_id)
        .maybeSingle();

      if (callerProfile) {
        setMissedCall({
          id: latest.id,
          caller_id: latest.caller_id,
          caller_name: (callerProfile as { full_name: string }).full_name,
          caller_avatar: (callerProfile as { avatar_url: string | null }).avatar_url,
          created_at: latest.created_at,
        });
      }
    };

    loadMissedCalls();

    const missedChan = supabase
      .channel(`missed_calls_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_history',
          filter: `callee_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            caller_id: string;
            status: string;
            created_at: string;
            seen_by_callee: boolean;
          };
          if (row.status !== 'missed' || row.seen_by_callee) return;

          const { data: callerProfile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', row.caller_id)
            .maybeSingle();
          if (!callerProfile) return;

          setMissedCall({
            id: row.id,
            caller_id: row.caller_id,
            caller_name: (callerProfile as { full_name: string }).full_name,
            caller_avatar: (callerProfile as { avatar_url: string | null }).avatar_url,
            created_at: row.created_at,
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_history',
          filter: `callee_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status: string };
          setMissedCall((prev) => {
            if (prev && prev.id === row.id && row.status !== 'missed') return null;
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(missedChan);
    };
  }, [currentUserId]);

  const dismissMissedCall = useCallback(async () => {
    if (!missedCall) return;
    await supabase
      .from('call_history')
      .update({ seen_by_callee: true })
      .eq('id', missedCall.id);
    setMissedCall(null);
  }, [missedCall]);

  // ========== CLEANUP ON UNMOUNT ==========

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, [cleanupCall]);

  useEffect(() => {
    if (status === 'idle' && peer) {
      clearSignals(peer.id);
    }
  }, [status, peer, clearSignals]);

  // ========== SEND 'ringing' signal when receiver shows incoming UI ==========
  // The receiver sends a 'ringing' signal so the caller knows the phone is "ringing"
  useEffect(() => {
    if (status === 'incoming' && currentUserId && callerIdRef.current && callIdRef.current) {
      sendSignal(callerIdRef.current, currentUserId, {
        type: 'ringing',
        call_id: callIdRef.current,
      });
    }
  }, [status, currentUserId, sendSignal]);

  return {
    status,
    peer,
    muted,
    elapsed,
    micError,
    micRequesting,
    missedCall,
    isVideoCall,
    localVideoReady,
    remoteVideoReady,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    grantMicAndProceed,
    dismissMissedCall,
  };
}
