import { motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { haptic } from '../../lib/haptics';
import { sfx } from '../../lib/sound';
import { CONFIDENCE_LABEL, GRADE_LABEL, SOURCE_LABEL, type AnswerSource, type Confidence } from '../../engine';
import type { ToastTone } from '../../state/toastStore';
import { Celebration } from './Celebration';
import { RichText } from './RichText';

const TONE: Record<ToastTone, { bar: string; badge: string; label: string; icon: string }> = {
  best: { bar: 'from-felt-300 to-emerald-dark', badge: 'bg-gold-500 text-ink', label: GRADE_LABEL.best, icon: '★' },
  acceptable: { bar: 'from-[#6fb2ff] to-sapphire-dark', badge: 'bg-cream text-ink', label: GRADE_LABEL.acceptable, icon: '✓' },
  mistake: { bar: 'from-[#ff7a6e] to-ruby-dark', badge: 'bg-ink text-cream', label: GRADE_LABEL.mistake, icon: '✕' },
  info: { bar: 'from-[#b88bff] to-grape-dark', badge: 'bg-cream text-ink', label: 'Tip', icon: 'i' },
};

export interface FeedbackBannerProps {
  tone: ToastTone;
  title: ReactNode;
  /** The WHY. Every trainer answer must explain itself. */
  children?: ReactNode;
  /** Lines of worked math, shown in a dark box. {Ah} tokens render as mini cards. */
  math?: string[];
  /** Play confetti/coins (best) or shake (mistake) on mount. Default true. */
  animate?: boolean;
  className?: string;
  /** How sure the grade is: shows a small badge ("Clear", "Close spot", "Depends on reads"). */
  confidence?: Confidence;
  /** One line on why (shown under the badges). */
  confidenceNote?: string;
  /** Where the answer comes from ("Solver data", "Chart (approximation)", "Model estimate"). */
  source?: AnswerSource;
}

const CONF_STYLE: Record<Confidence, string> = {
  clear: 'bg-felt-300 text-ink',
  close: 'bg-gold-300 text-ink',
  'model-dependent': 'bg-[#c9a8ff] text-ink',
};

/** Answer feedback: grade badge, headline, explanation and worked math. */
export function FeedbackBanner({ tone, title, children, math, animate = true, className = '', confidence, confidenceNote, source }: FeedbackBannerProps) {
  const t = TONE[tone];
  const shake = animate && tone === 'mistake';
  useEffect(() => {
    if (!animate) return;
    if (tone === 'best') {
      sfx('correct');
      haptic('success');
    } else if (tone === 'acceptable') sfx('acceptable');
    else if (tone === 'mistake') {
      sfx('wrong');
      haptic('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div
      initial={{ y: 30, opacity: 0, scale: 0.9 }}
      animate={shake ? { y: 0, opacity: 1, scale: 1, x: [0, -10, 10, -7, 7, -3, 0] } : { y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, x: { duration: 0.45, delay: 0.1 } }}
      className={`relative rounded-3xl border-[3px] border-ink bg-gradient-to-b ${t.bar} p-3 text-white shadow-chunky ${className}`}
      role="status"
    >
      {animate && tone === 'best' && <Celebration />}
      <div className="pointer-events-none absolute inset-x-4 top-1.5 h-3 rounded-full bg-white/30" />
      <div className="relative flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-full border-[3px] border-ink font-display text-lg ${t.badge}`}>
          {t.icon}
        </span>
        <span className={`rounded-lg border-2 border-ink px-2 py-0.5 font-display text-sm ${t.badge}`}>{t.label}</span>
        <span className="text-outline-sm font-display text-xl">{title}</span>
      </div>
      {(confidence || source) && (
        <div className="relative mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {confidence && <span className={`rounded-md border-2 border-ink px-1.5 py-0.5 ${CONF_STYLE[confidence]}`}>{CONFIDENCE_LABEL[confidence]}</span>}
          {source && <span className="rounded-md border-2 border-ink bg-ink/60 px-1.5 py-0.5 text-cream">{SOURCE_LABEL[source]}</span>}
        </div>
      )}
      {(children || math) && (
        <div className="relative mt-2 rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-semibold text-ink">
          {children}
          {confidenceNote && <p className="mt-1.5 text-xs text-ink/70">{confidenceNote}</p>}
          {math && (
            <div className="mt-2 space-y-1 rounded-lg bg-ink px-2.5 py-2 font-mono text-[12px] leading-relaxed text-gold-300">
              {math.map((line, i) => (
                <div key={i}>
                  <RichText text={line} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
