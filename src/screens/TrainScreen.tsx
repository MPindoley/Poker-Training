import { motion } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { toast } from '../state/toastStore';
import { SuitIcon } from '../components/ui';

const MODULES = [
  { name: 'Math', blurb: 'Pot odds, outs, equity, EV', color: 'from-[#ff7a6e] to-ruby-dark', glyph: '%', to: '/train/math' },
  { name: 'Preflop', blurb: 'Opening ranges at 40bb & 100bb', color: 'from-gold-300 to-gold-700', glyph: 'AK', to: '/train/preflop' },
  { name: 'Postflop', blurb: 'Bet sizing, value, bluffs', color: 'from-[#6fb2ff] to-sapphire-dark', glyph: <SuitIcon suit="d" className="h-8 w-8" />, to: '/train/postflop' },
  { name: 'Exploit Lab', blurb: 'Adjust to home-game regulars', color: 'from-[#b88bff] to-grape-dark', glyph: '?!', to: '/train/exploit' },
];

export function TrainScreen() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <ScreenHeader title="Train" subtitle="Pick a module" />
      <div className="grid grid-cols-2 gap-3">
        {MODULES.map((m, i) => (
          <motion.button
            key={m.name}
            type="button"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22, delay: i * 0.06 }}
            whileTap={{ scaleX: 1.04, scaleY: 0.92, y: 3 }}
            onClick={() => ('to' in m && m.to ? navigate(m.to) : toast({ tone: 'info', title: `${m.name} is coming soon`, message: 'Trainers arrive in the next steps.' }))}
            className={`gloss flex aspect-[4/5] flex-col justify-between rounded-3xl border-[3px] border-ink bg-gradient-to-b ${m.color} p-3 text-left shadow-chunky`}
          >
            <span className="text-outline grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-ink bg-ink/25 font-display text-2xl text-white">
              {m.glyph}
            </span>
            <span>
              <span className="text-outline-sm block font-display text-2xl leading-tight text-white">{m.name}</span>
              <span className="block text-xs font-bold text-white/90">{m.blurb}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
