import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Pause,
  Play,
  Square,
  X,
  Send,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, durationSeconds: number) => Promise<void>;
  onStateChange?: (active: boolean) => void;
  disabled?: boolean;
}

type RecorderState = 'idle' | 'recording' | 'paused' | 'processing' | 'stopped';

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({ onSend, onStateChange, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string | undefined>(undefined);
  const finalBlobRef = useRef<Blob | null>(null);

  const isActive = state !== 'idle';
  useEffect(() => {
    onStateChange?.(isActive);
  }, [isActive, onStateChange]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      cleanupStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Browser-kaagu ma taageero qaabka kulantu.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      mimeRef.current = mimeType;

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const type = mimeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        finalBlobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setState('stopped');
        cleanupStream();
      };

      recorder.start(250);
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err: unknown) {
      cleanupStream();
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Lama siin ogolaanshaha makarafoonka. Fadlan oggool makarafoonka.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('Makarafoon lama helin. Hubi inuu jiro.');
      } else {
        setError('Khalad ayaa dhacay marka la bilaabayay qaabka kulanka.');
      }
    }
  }, [previewUrl]);

  const pauseRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state === 'recording') {
      r.pause();
      setState('paused');
      stopTimer();
    }
  };

  const resumeRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state === 'paused') {
      r.resume();
      setState('recording');
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
  };

  const finishRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && (r.state === 'recording' || r.state === 'paused')) {
      setState('processing');
      r.stop();
    }
    stopTimer();
  };

  const cancelRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && (r.state === 'recording' || r.state === 'paused')) {
      r.onstop = null;
      r.stop();
    }
    stopTimer();
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setDuration(0);
    setState('idle');
    setError(null);
    finalBlobRef.current = null;
  };

  const handleSend = async () => {
    const blob = finalBlobRef.current;
    if (!blob) return;

    setSending(true);
    try {
      await onSend(blob, duration);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setDuration(0);
      setState('idle');
      finalBlobRef.current = null;
    } catch {
      setError('Lama soo dirin fariinta codka. Fadlan isku day mar kale.');
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-red-50 border border-red-200 text-xs text-red-700 flex-1 min-w-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => { setError(null); setState('idle'); }}
          aria-label="Close"
          className="flex items-center justify-center w-10 h-10 rounded-full text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        aria-label="Kulan cod"
        className="flex items-center justify-center w-10 h-10 rounded-full text-slate-500 hover:bg-slate-100 hover:text-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  if (state === 'processing') {
    return (
      <div className="flex items-center gap-2 w-full bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 flex-shrink-0" />
        <span className="text-sm text-slate-500">Farsamaynta codka...</span>
      </div>
    );
  }

  if (state === 'recording' || state === 'paused') {
    return (
      <div className="flex items-center gap-2 w-full bg-red-50 border border-red-200 rounded-full px-3 py-2">
        <span
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            state === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-red-400'
          }`}
        />
        <span className="text-sm font-semibold text-red-700 tabular-nums">
          {formatDuration(duration)}
        </span>
        <div className="flex-1" />
        {state === 'recording' ? (
          <button
            type="button"
            onClick={pauseRecording}
            aria-label="Sababi"
            className="flex items-center justify-center w-9 h-9 rounded-full text-red-600 hover:bg-red-100 transition-colors flex-shrink-0"
          >
            <Pause className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={resumeRecording}
            aria-label="Sii wad"
            className="flex items-center justify-center w-9 h-9 rounded-full text-red-600 hover:bg-red-100 transition-colors flex-shrink-0"
          >
            <Play className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={cancelRecording}
          aria-label="Tirtir"
          className="flex items-center justify-center w-9 h-9 rounded-full text-red-600 hover:bg-red-100 transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={finishRecording}
          aria-label="Dhammee kalka"
          className="flex items-center justify-center w-11 h-9 rounded-full text-white bg-red-600 hover:bg-red-700 transition-colors flex-shrink-0 font-bold text-sm px-3"
        >
          <Square className="w-4 h-4 mr-1" />
          <span className="text-xs">Dhammee</span>
        </button>
      </div>
    );
  }

  // stopped: green preview bar with play, delete, and SEND
  return (
    <div className="flex items-center gap-2 w-full bg-emerald-50 border border-emerald-200 rounded-full px-3 py-2">
      {previewUrl && <VoicePreview audioUrl={previewUrl} duration={duration} />}
      <span className="text-xs text-emerald-700 font-semibold tabular-nums flex-shrink-0">
        {formatDuration(duration)}
      </span>
      <button
        type="button"
        onClick={cancelRecording}
        disabled={sending}
        aria-label="Tirtir"
        className="flex items-center justify-center w-9 h-9 rounded-full text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors flex-shrink-0 disabled:opacity-50"
      >
        <Trash2 className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        aria-label="Dir codka"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all hover:scale-105 flex-shrink-0 disabled:opacity-50"
      >
        {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
      </button>
    </div>
  );
}

function VoicePreview({ audioUrl, duration }: { audioUrl: string; duration: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Jooji' : 'Dhagay'}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex-shrink-0"
      >
        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>
      <div className="flex-1 h-1.5 bg-emerald-200 rounded-full overflow-hidden min-w-[40px]">
        <div
          className="h-full bg-emerald-600 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
