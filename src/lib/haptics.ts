/**
 * Haptic feedback. Android/Chrome supports navigator.vibrate. iOS Safari doesn't, but since iOS 18 a
 * tap on a native <input type="checkbox" switch> plays the system haptic, so we toggle a hidden one.
 * Both only work inside a user gesture (a tap handler), which is where we call them.
 */
import { useSettings } from '../state/settingsStore';

export type Haptic = 'light' | 'success' | 'error';

const PATTERNS: Record<Haptic, number | number[]> = { light: 8, success: [10, 40, 18], error: [30, 50, 30] };

let iosSwitch: HTMLLabelElement | null = null;

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind: Haptic = 'light') {
  if (typeof window === 'undefined' || !useSettings.getState().hapticsOn) return;
  // Browsers reject haptics before the first tap; skip instead of logging warnings.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind]);
      return;
    }
    iosTick();
    if (kind !== 'light') setTimeout(iosTick, 90);
  } catch {
    // Haptics are best-effort.
  }
}
