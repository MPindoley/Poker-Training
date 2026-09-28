import { useEffect } from 'react';

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Keep the screen awake while `active` (Screen Wake Lock API, iOS 16.4+ / Chrome). Re-acquires after
 * the app returns to the foreground. Silently does nothing where unsupported.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await nav.wakeLock!.request('screen');
        if (cancelled) void lock.release();
      } catch {
        lock = null;
      }
    };
    void acquire();
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
