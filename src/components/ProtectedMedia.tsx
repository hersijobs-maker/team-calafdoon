import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

let secureFlagSet = false;

function setAndroidSecureFlag(secure: boolean) {
  if (secureFlagSet === secure) return;
  secureFlagSet = secure;
  try {
    const bridge = (window as unknown as { AndroidSecureScreen?: { setSecure: (v: boolean) => void } }).AndroidSecureScreen;
    if (bridge?.setSecure) {
      bridge.setSecure(secure);
    }
  } catch {
    // Not running in Android WebView — no-op
  }
}

interface ProtectedImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
}

export function ProtectedImage({ src, alt = '', className, style }: ProtectedImageProps) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    el.addEventListener('dragstart', block);
    return () => {
      el.removeEventListener('contextmenu', block);
      el.removeEventListener('dragstart', block);
    };
  }, []);

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      style={style}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    />
  );
}

interface ProtectedVideoProps {
  src: string;
  className?: string;
  style?: CSSProperties;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  onEnded?: () => void;
}

export function ProtectedVideo({
  src,
  className,
  style,
  controls = true,
  autoPlay,
  muted,
  loop,
  playsInline,
  onEnded,
}: ProtectedVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => {
      el.removeEventListener('contextmenu', block);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      style={style}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline={playsInline}
      onEnded={onEnded}
      onContextMenu={(e) => e.preventDefault()}
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
    />
  );
}

export function SecureScreen({ children }: { children: ReactNode }) {
  useEffect(() => {
    setAndroidSecureFlag(true);
    return () => setAndroidSecureFlag(false);
  }, []);

  return <>{children}</>;
}
