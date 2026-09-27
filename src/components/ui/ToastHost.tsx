import { AnimatePresence, motion } from 'framer-motion';
import { useToasts, type ToastTone } from '../../state/toastStore';

const TONE: Record<ToastTone, string> = {
  best: 'from-felt-300 to-emerald-dark',
  acceptable: 'from-[#6fb2ff] to-sapphire-dark',
  mistake: 'from-[#ff7a6e] to-ruby-dark',
  info: 'from-[#b88bff] to-grape-dark',
};

/** Renders transient toasts at the top of the screen. Mount once in the app shell. */
export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-[430px] flex-col gap-2 px-4 pt-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            onClick={() => dismiss(t.id)}
            initial={{ y: -60, opacity: 0, scale: 0.8 }}
            animate={
              t.tone === 'mistake'
                ? { y: 0, opacity: 1, scale: 1, x: [0, -8, 8, -5, 5, 0] }
                : { y: 0, opacity: 1, scale: 1 }
            }
            exit={{ y: -40, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            className={`pointer-events-auto rounded-2xl border-[3px] border-ink bg-gradient-to-b ${TONE[t.tone]} px-4 py-2 text-left text-white shadow-chunky`}
          >
            <div className="text-outline-sm font-display text-lg">{t.title}</div>
            {t.message && <div className="text-sm font-semibold text-white/95">{t.message}</div>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
