import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { CHEST_ODDS, RARITY_NAMES, SLOT_NAMES, formatPercent, type ChestResult, type Rarity } from '../../engine';
import { haptic } from '../../lib/haptics';
import { sfx } from '../../lib/sound';
import { useEvents } from '../../state/eventsStore';
import { useRewards } from '../../state/rewardsStore';
import { ChestIcon } from '../icons/ChestIcon';
import { Celebration, GameButton } from '../ui';
import { CosmeticPreview } from './CosmeticPreview';

export const RARITY_STYLE: Record<Rarity, string> = {
  common: 'bg-cream text-ink',
  rare: 'bg-sapphire text-white',
  epic: 'bg-grape text-white',
};

/** Full-screen chest opening: wobble → burst → reveal. */
export function ChestSheet() {
  const open = useEvents((s) => s.chestOpen);
  const setOpen = useEvents((s) => s.setChestOpen);
  const chests = useRewards((s) => s.chests);
  const openChest = useRewards((s) => s.openChest);
  const equip = useRewards((s) => s.equip);
  const [stage, setStage] = useState<'idle' | 'opening' | 'revealed'>('idle');
  const [result, setResult] = useState<ChestResult | null>(null);
  const [equipped, setEquipped] = useState(false);

  const close = () => {
    setOpen(false);
    setStage('idle');
    setResult(null);
  };
  const tapChest = () => {
    if (stage !== 'idle' || chests <= 0) return;
    setStage('opening');
    sfx('chest');
    haptic('light');
    setTimeout(() => {
      const r = openChest();
      setResult(r);
      setEquipped(false);
      setStage('revealed');
      sfx('reveal');
      haptic('success');
    }, 900);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 px-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Reward chest"
        >
          <div className="w-full max-w-[360px] text-center">
            {stage !== 'revealed' && (
              <>
                <div className="text-outline font-display text-3xl text-gold-300">{chests > 0 ? 'Reward Chest' : 'No chests yet'}</div>
                <motion.button
                  type="button"
                  aria-label="Open chest"
                  onClick={tapChest}
                  disabled={chests <= 0}
                  className="mx-auto mt-4 block min-h-11"
                  animate={
                    stage === 'opening'
                      ? { rotate: [0, -8, 8, -10, 10, -6, 0], scale: [1, 1.05, 1.1, 1.15, 1.2] }
                      : chests > 0
                        ? { rotate: [0, -4, 4, 0], y: [0, -6, 0] }
                        : {}
                  }
                  transition={stage === 'opening' ? { duration: 0.9 } : { repeat: Infinity, duration: 1.6, repeatDelay: 0.6 }}
                >
                  <ChestIcon className="h-40 w-40 drop-shadow-[0_8px_0_rgba(0,0,0,0.35)]" />
                </motion.button>
                <p className="mt-2 font-bold text-cream/90">
                  {chests > 0 ? `Tap to open · ${chests} waiting` : 'Level up, finish your daily tasks or unlock achievements to earn chests.'}
                </p>
                <p className="mt-2 text-xs font-bold text-cream/70">
                  Cosmetics only. Odds: {(Object.keys(CHEST_ODDS) as Rarity[]).map((r) => `${RARITY_NAMES[r]} ${formatPercent(CHEST_ODDS[r], 0)}`).join(' · ')}
                </p>
              </>
            )}
            {stage === 'revealed' && result && (
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }} className="relative">
                <Celebration count={44} />
                <ChestIcon open className="mx-auto h-24 w-24" />
                {result.item ? (
                  <>
                    <div className={`mx-auto mt-1 w-fit rounded-lg border-2 border-ink px-2 py-0.5 font-display text-sm ${RARITY_STYLE[result.item.rarity]}`}>
                      {RARITY_NAMES[result.item.rarity]} · {SLOT_NAMES[result.item.slot].replace(/s$/, '')}
                    </div>
                    <div className="mx-auto mt-3 w-fit rounded-3xl border-[3px] border-ink bg-cream p-3 shadow-chunky">
                      <CosmeticPreview item={result.item} className="h-24 w-24" />
                    </div>
                    <div className="text-outline mt-3 font-display text-3xl text-gold-300">{result.item.name}</div>
                  </>
                ) : (
                  <div className="text-outline mt-3 font-display text-2xl text-gold-300">Collection complete! You own every cosmetic.</div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {result.item ? (
                    <GameButton
                      color="green"
                      disabled={equipped}
                      onClick={() => {
                        equip(result.item!.slot, result.item!.id);
                        setEquipped(true);
                      }}
                    >
                      {equipped ? 'Equipped' : 'Equip'}
                    </GameButton>
                  ) : (
                    <span />
                  )}
                  {chests > 0 ? (
                    <GameButton color="gold" onClick={() => setStage('idle')}>
                      Next chest
                    </GameButton>
                  ) : (
                    <GameButton color="gold" onClick={close}>
                      Done
                    </GameButton>
                  )}
                </div>
              </motion.div>
            )}
            {stage !== 'opening' && (
              <button type="button" onClick={close} className="mt-4 min-h-11 px-4 font-display text-cream/80 underline">
                Close
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
