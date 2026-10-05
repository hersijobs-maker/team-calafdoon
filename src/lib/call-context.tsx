import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useVoiceCall } from './useVoiceCall';
import { useAuth } from './auth-context';
import { CallUI } from '@/components/CallUI';
import type { MissedCallNotification } from './useVoiceCall';
import { PhoneMissed, Phone, Clock, X } from 'lucide-react';

type ToastFn = (msg: string, type: 'info' | 'error' | 'success') => void;

interface CallContextValue {
  status: ReturnType<typeof useVoiceCall>['status'];
  peer: ReturnType<typeof useVoiceCall>['peer'];
  muted: ReturnType<typeof useVoiceCall>['muted'];
  elapsed: ReturnType<typeof useVoiceCall>['elapsed'];
  micError: ReturnType<typeof useVoiceCall>['micError'];
  micRequesting: ReturnType<typeof useVoiceCall>['micRequesting'];
  missedCall: ReturnType<typeof useVoiceCall>['missedCall'];
  isVideoCall: ReturnType<typeof useVoiceCall>['isVideoCall'];
  localVideoReady: ReturnType<typeof useVoiceCall>['localVideoReady'];
  remoteVideoReady: ReturnType<typeof useVoiceCall>['remoteVideoReady'];
  localVideoRef: ReturnType<typeof useVoiceCall>['localVideoRef'];
  remoteVideoRef: ReturnType<typeof useVoiceCall>['remoteVideoRef'];
  startCall: ReturnType<typeof useVoiceCall>['startCall'];
  acceptCall: ReturnType<typeof useVoiceCall>['acceptCall'];
  rejectCall: ReturnType<typeof useVoiceCall>['rejectCall'];
  endCall: ReturnType<typeof useVoiceCall>['endCall'];
  toggleMute: ReturnType<typeof useVoiceCall>['toggleMute'];
  toggleVideo: ReturnType<typeof useVoiceCall>['toggleVideo'];
  grantMicAndProceed: ReturnType<typeof useVoiceCall>['grantMicAndProceed'];
  dismissMissedCall: ReturnType<typeof useVoiceCall>['dismissMissedCall'];
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  const toastRef = useCallback<ToastFn>((_msg, _type) => {
    // Global toasts are handled by the missed-call banner and call UI itself.
    // This no-op avoids duplicate toast systems. Individual pages can show their own.
  }, []);

  const call = useVoiceCall(profile?.id, toastRef);

  return (
    <CallContext.Provider value={call}>
      {children}
      <CallUI
        status={call.status}
        peer={call.peer}
        muted={call.muted}
        elapsed={call.elapsed}
        micError={call.micError}
        micRequesting={call.micRequesting}
        isVideoCall={call.isVideoCall}
        localVideoReady={call.localVideoReady}
        remoteVideoReady={call.remoteVideoReady}
        localVideoRef={call.localVideoRef}
        remoteVideoRef={call.remoteVideoRef}
        onAccept={call.acceptCall}
        onReject={call.rejectCall}
        onEnd={call.endCall}
        onToggleMute={call.toggleMute}
        onToggleVideo={call.toggleVideo}
        onRequestMic={call.grantMicAndProceed}
      />
      {call.missedCall && (
        <MissedCallBanner
          missedCall={call.missedCall}
          onDismiss={call.dismissMissedCall}
          onCallBack={(peerId, name, avatar) => {
            call.startCall({ id: peerId, full_name: name, avatar_url: avatar }, false);
          }}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

function MissedCallBanner({
  missedCall,
  onDismiss,
  onCallBack,
}: {
  missedCall: MissedCallNotification;
  onDismiss: () => void;
  onCallBack: (peerId: string, name: string, avatar: string | null) => void;
}) {
  const formatCallTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[65] w-[calc(100%-2rem)] max-w-sm animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-4 flex items-center gap-3">
        {missedCall.caller_avatar ? (
          <img
            src={missedCall.caller_avatar}
            alt={missedCall.caller_name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center text-lg font-bold text-red-700 flex-shrink-0">
            {missedCall.caller_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <PhoneMissed className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="font-semibold text-slate-900 text-sm truncate">Wicitaan la waayay</p>
          </div>
          <p className="text-sm text-slate-600 truncate">{missedCall.caller_name}</p>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatCallTime(missedCall.created_at)}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() =>
              onCallBack(missedCall.caller_id, missedCall.caller_name, missedCall.caller_avatar)
            }
            className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            aria-label="Wici dib"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            aria-label="Tirtir"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
