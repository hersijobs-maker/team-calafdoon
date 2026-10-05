import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Loader2, AlertCircle, RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface VoiceMessagePlayerProps {
  audioPath: string;
  duration: number | null;
  isMine: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceMessagePlayer({ audioPath, duration, isMine }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(duration || 0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!audioPath) {
      setUrlError(true);
      setUrlLoading(false);
      return;
    }

    let cancelled = false;

    async function resolveUrl() {
      setUrlLoading(true);
      setUrlError(false);
      try {
        const { data, error } = await supabase.storage
          .from('voice-messages')
          .createSignedUrl(audioPath, 86400);

        if (cancelled) return;
        if (error || !data?.signedUrl) {
          console.error('Voice signed URL error:', error);
          setUrlError(true);
          setUrlLoading(false);
          return;
        }
        setAudioUrl(data.signedUrl);
        setUrlLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Voice URL resolve error:', err);
        setUrlError(true);
        setUrlLoading(false);
      }
    }

    resolveUrl();
    return () => { cancelled = true; };
  }, [audioPath, retryCount]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setActualDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setActualDuration(audio.duration);
      }
    };
    const onError = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
    };
  }, [audioUrl]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !isFinite(audio.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio * 100);
  };

  const retry = () => {
    setAudioUrl(null);
    setUrlLoading(true);
    setUrlError(false);
    setRetryCount((c) => c + 1);
  };

  const displayTime = playing || currentTime > 0 ? currentTime : 0;
  const totalDuration = Math.ceil(actualDuration || duration || 0);

  const playBtnClass = isMine
    ? 'bg-white/25 text-white hover:bg-white/35'
    : 'bg-emerald-600 text-white hover:bg-emerald-700';

  const trackBg = isMine ? 'rgba(255,255,255,0.3)' : '#e2e8f0';
  const trackFill = isMine ? '#fff' : '#059669';
  const timeColor = isMine ? 'text-emerald-100' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2.5 min-w-[180px] sm:min-w-[220px]">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      {urlError ? (
        <button
          type="button"
          onClick={retry}
          aria-label="Dib u isku day"
          className={`flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 transition-colors ${playBtnClass}`}
        >
          <RotateCw className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={urlLoading}
          aria-label={playing ? 'Jooji' : 'Dhagay'}
          className={`flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 ${playBtnClass}`}
        >
          {urlLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>
      )}

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          onClick={urlError ? undefined : seek}
          className={`h-1.5 rounded-full overflow-hidden ${urlError ? '' : 'cursor-pointer'}`}
          style={{ backgroundColor: trackBg }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: urlError ? '100%' : `${progress}%`, backgroundColor: urlError ? '#ef4444' : trackFill }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] tabular-nums ${timeColor}`}>
            {formatDuration(Math.ceil(displayTime))}
          </span>
          <div className="flex items-center gap-1">
            {urlError ? (
              <AlertCircle className={`w-3 h-3 text-red-400`} />
            ) : (
              <Mic className={`w-3 h-3 ${timeColor}`} />
            )}
            <span className={`text-[10px] tabular-nums ${urlError ? 'text-red-400' : timeColor}`}>
              {urlLoading ? '...' : urlError ? 'Khalad' : formatDuration(totalDuration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
