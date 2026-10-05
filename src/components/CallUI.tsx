import { Phone, PhoneOff, Mic, MicOff, Volume2, X, Loader2, AlertCircle, RefreshCw, Video, VideoOff, Camera } from 'lucide-react';
import type { CallStatus, CallPeer, MicErrorType } from '@/lib/useVoiceCall';

interface CallUIProps {
  status: CallStatus;
  peer: CallPeer | null;
  muted: boolean;
  elapsed: number;
  micError: MicErrorType;
  micRequesting: boolean;
  isVideoCall: boolean;
  localVideoReady: boolean;
  remoteVideoReady: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onRequestMic: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CallUI({
  status,
  peer,
  muted,
  elapsed,
  micError,
  micRequesting,
  isVideoCall,
  localVideoReady,
  remoteVideoReady,
  localVideoRef,
  remoteVideoRef,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onRequestMic,
}: CallUIProps) {
  if (status === 'idle' || !peer) return null;

  const avatar = peer.avatar_url ? (
    <img
      src={peer.avatar_url}
      alt={peer.full_name}
      className="w-28 h-28 rounded-full object-cover border-4 border-white/20 shadow-2xl"
    />
  ) : (
    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-4xl font-bold text-white border-4 border-white/20 shadow-2xl">
      {peer.full_name.charAt(0).toUpperCase()}
    </div>
  );

  // Microphone permission request screen
  if (status === 'requesting_mic') {
    const errorTitle =
      micError === 'denied'
        ? 'Oggolaanshaha makarafoonka waa la diiday'
        : micError === 'notfound'
          ? 'Makarafoon lama helin'
          : micError === 'other'
            ? 'Khalad ayaa dhacay'
            : null;

    const errorDesc =
      micError === 'denied'
        ? 'Si aad u wici karto, oggolow makarafoonka. Fur Settings > Site Settings > Microphone ka markaas oggolow boggaan.'
        : micError === 'notfound'
          ? 'Qalabka makarafoonka lama helin. Hubi in makarafoonka uu ku xiran yahay qalabka.'
          : micError === 'other'
            ? 'Khalad ayaa dhacay markii makarafoonka la rabay. Isku day mar kale.'
            : null;

    return (
      <div className="fixed inset-0 z-[60] bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center px-6 py-10">
        <div className="flex flex-col items-center gap-5 max-w-sm w-full">
          {peer.avatar_url ? (
            <img
              src={peer.avatar_url}
              alt={peer.full_name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-2xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-3xl font-bold text-white border-4 border-white/20 shadow-2xl">
              {peer.full_name.charAt(0).toUpperCase()}
            </div>
          )}

          <h2 className="text-white text-xl font-bold text-center">{peer.full_name}</h2>

          {micRequesting ? (
            <div className="flex flex-col items-center gap-3 mt-2">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <p className="text-white/70 text-sm text-center">
                Waa la waydiinayaa oggolaanshaha makarafoonka...
              </p>
            </div>
          ) : micError === 'none' ? (
            <div className="flex flex-col items-center gap-3 mt-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                {isVideoCall ? (
                  <Video className="w-8 h-8 text-emerald-400" />
                ) : (
                  <Mic className="w-8 h-8 text-emerald-400" />
                )}
              </div>
              <p className="text-white/70 text-sm text-center">
                {isVideoCall
                  ? 'Si aad ugu wici karto qofka, bogga wuxuu u baahan yahay oggolaanshaha kamera iyo makarafoonka.'
                  : 'Si aad ugu wici karto qofka, bogga wuxuu u baahan yahay oggolaanshaha makarafoonka.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 mt-2">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-white font-semibold text-base text-center">{errorTitle}</p>
              <p className="text-white/60 text-xs text-center leading-relaxed">{errorDesc}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full mt-4">
            <button
              onClick={onRequestMic}
              disabled={micRequesting}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-semibold py-3.5 rounded-xl hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {micRequesting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : micError === 'denied' ? (
                <RefreshCw className="w-5 h-5" />
              ) : isVideoCall ? (
                <Video className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
              {micRequesting
                ? 'Waa la sugayaa...'
                : micError === 'denied'
                  ? 'Isku day mar kale'
                  : isVideoCall
                    ? 'Oggolow Kamera iyo Makarafoonka'
                    : 'Oggolow Makarafoonka'}
            </button>
            <button
              onClick={onEnd}
              className="flex items-center justify-center gap-2 bg-white/10 text-white/80 text-sm font-medium py-3 rounded-xl hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
              Tirtir
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Incoming call screen
  if (status === 'incoming') {
    console.log('[CallUI] Rendering INCOMING call screen for:', peer?.full_name, 'call_id:', peer?.id);
    return (
      <div className="fixed inset-0 z-[60] bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-between py-16 px-6">
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-white/60 text-sm font-medium uppercase tracking-wider">
            {isVideoCall ? 'Wici Video ah soo dhacay' : 'Wici soo dhacay'}
          </p>
          {avatar}
          <h2 className="text-white text-2xl font-bold mt-2">{peer.full_name}</h2>
          <p className="text-white/50 text-sm">Wuxuu rabaa in kula hadlo...</p>
          {isVideoCall && (
            <div className="flex items-center gap-1.5 mt-1 text-emerald-400">
              <Video className="w-4 h-4" />
              <span className="text-xs">Video call</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-12 mb-4">
          <button
            onClick={onReject}
            className="flex flex-col items-center gap-2 group"
            aria-label="Diidi wicitaan"
          >
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-white/70 text-xs font-medium">Diidi</span>
          </button>
          <button
            onClick={onAccept}
            className="flex flex-col items-center gap-2 group animate-pulse"
            aria-label="Aqbal wicitaan"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform">
              <Phone className="w-7 h-7 text-white" />
            </div>
            <span className="text-white/70 text-xs font-medium">Aqbal</span>
          </button>
        </div>
      </div>
    );
  }

  // Active video call — show remote video full screen with local PiP
  if (status === 'active' && isVideoCall && remoteVideoReady) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        {/* Remote video full screen */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Local video PiP */}
        <div className="absolute top-6 right-4 w-32 h-48 sm:w-40 sm:h-56 rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl z-10 bg-slate-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Top bar: name + timer */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
          <h2 className="text-white text-lg font-bold drop-shadow-lg">{peer.full_name}</h2>
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-sm font-medium drop-shadow-lg">{formatDuration(elapsed)}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6 z-10">
          <button
            onClick={onToggleMute}
            className={`flex flex-col items-center gap-2 group ${muted ? 'opacity-100' : 'opacity-80'}`}
            aria-label={muted ? 'Fur makarafoonka' : 'Dami makarafoonka'}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform backdrop-blur-sm ${
                muted ? 'bg-red-500' : 'bg-white/15'
              }`}
            >
              {muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </div>
            <span className="text-white/80 text-xs drop-shadow-lg">{muted ? 'Dami' : 'Makarafoon'}</span>
          </button>

          <button
            onClick={onEnd}
            className="flex flex-col items-center gap-2 group"
            aria-label="Jooji wicitaan"
          >
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-white/80 text-xs font-medium drop-shadow-lg">Dhammee</span>
          </button>

          <button
            onClick={onToggleVideo}
            className={`flex flex-col items-center gap-2 group ${localVideoReady ? 'opacity-80' : 'opacity-100'}`}
            aria-label={localVideoReady ? 'Xir kamera' : 'Fur kamera'}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform backdrop-blur-sm ${
                localVideoReady ? 'bg-white/15' : 'bg-red-500'
              }`}
            >
              {localVideoReady ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
            </div>
            <span className="text-white/80 text-xs drop-shadow-lg">{localVideoReady ? 'Kamera' : 'Off'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Calling (outgoing), ringing, connecting, or active audio call
  const statusText =
    status === 'calling'
      ? 'Wici laga socda...'
      : status === 'ringing'
        ? 'Laga dhawaaqayo...'
        : status === 'connecting'
          ? 'Isku xira...'
          : status === 'active'
            ? formatDuration(elapsed)
            : 'Wicitaan...';

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-between py-16 px-6">
      <div className="w-full flex justify-end">
        {status !== 'active' && (
          <button
            onClick={onEnd}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Jooji"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 flex-1 justify-center">
        {/* Show local video preview for video call while connecting */}
        {isVideoCall && localVideoReady && status !== 'active' ? (
          <div className="relative">
            <div className="w-48 h-64 sm:w-56 sm:h-72 rounded-2xl overflow-hidden border-4 border-white/20 shadow-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-800 px-3 py-1 rounded-full text-xs text-white/70 whitespace-nowrap">
              {peer.full_name}
            </div>
          </div>
        ) : (
          <div className={`${status === 'calling' || status === 'ringing' ? 'animate-pulse' : ''}`}>
            {avatar}
          </div>
        )}

        <h2 className="text-white text-2xl font-bold mt-2">{peer.full_name}</h2>

        {status === 'connecting' ? (
          <div className="flex items-center gap-2 text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{statusText}</span>
          </div>
        ) : (
          <p className="text-white/60 text-sm font-medium">{statusText}</p>
        )}

        {isVideoCall && status !== 'active' && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Video className="w-4 h-4" />
            <span className="text-xs">Video call</span>
          </div>
        )}

        {status === 'active' && !isVideoCall && (
          <div className="flex items-center gap-1 mt-4 h-8">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="w-1.5 bg-emerald-400 rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.sin((elapsed + i) * 1.5) * 15 + 15}px`,
                  animationDelay: `${i * 100}ms`,
                  animationDuration: '800ms',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 mb-4">
        {status === 'active' && (
          <button
            onClick={onToggleMute}
            className={`flex flex-col items-center gap-2 group ${muted ? 'opacity-100' : 'opacity-80'}`}
            aria-label={muted ? 'Fur makarafoonka' : 'Dami makarafoonka'}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform ${
                muted ? 'bg-red-500' : 'bg-white/15'
              }`}
            >
              {muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </div>
            <span className="text-white/60 text-xs">{muted ? 'Dami' : 'Makarafoon'}</span>
          </button>
        )}

        <button
          onClick={onEnd}
          className="flex flex-col items-center gap-2 group"
          aria-label="Jooji wicitaan"
        >
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform">
            <PhoneOff className="w-7 h-7 text-white" />
          </div>
          <span className="text-white/70 text-xs font-medium">
            {status === 'calling' || status === 'ringing' ? 'Jooji' : 'Dhammee'}
          </span>
        </button>

        {status === 'active' && (
          <div className="flex flex-col items-center gap-2 opacity-80">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center shadow-lg">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-white/60 text-xs">Dhawaan</span>
          </div>
        )}
      </div>
    </div>
  );
}
