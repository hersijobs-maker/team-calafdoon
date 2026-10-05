import { useEffect, useRef } from 'react';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const INACTIVITY_MESSAGE_KEY = 'inactivity_logout_message';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'touchmove',
  'click',
  'wheel',
];

export function setInactivityLogoutMessage() {
  sessionStorage.setItem(
    INACTIVITY_MESSAGE_KEY,
    'Waxaa lagaa saaray akoonka sababo la xiriira inaadan wax activity ah samayn 5 daqiiqo. Fadlan mar kale gal.',
  );
}

export function getInactivityLogoutMessage(): string | null {
  return sessionStorage.getItem(INACTIVITY_MESSAGE_KEY);
}

export function clearInactivityLogoutMessage() {
  sessionStorage.removeItem(INACTIVITY_MESSAGE_KEY);
}

export function useInactivityTimeout(
  active: boolean,
  onTimeout: () => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onTimeout);
  callbackRef.current = onTimeout;

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current();
      }, INACTIVITY_TIMEOUT_MS);
    };

    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [active]);
}
