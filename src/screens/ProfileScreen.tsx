import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ACHIEVEMENTS,
  ARENAS,
  COSMETICS,
  RARITY_NAMES,
  SLOT_NAMES,
  arenaForLevel,
  chestCosmeticsLeft,
  nextArena,
  type CosmeticSlot,
} from '../engine';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameButton, Panel, ProgressBar, Toggle, XPBadge } from '../components/ui';
import { ChipGroup } from '../components/ui/Chips';
import { FlameIcon } from '../components/icons/FlameIcon';
import { ChestIcon } from '../components/icons/ChestIcon';
import { TrophyIcon } from '../components/icons/TrophyIcon';
import { CosmeticPreview } from '../components/progression/CosmeticPreview';
import { RARITY_STYLE } from '../components/progression/ChestSheet';
import { SkillRadar } from '../components/progression/SkillRadar';
import { useEvents } from '../state/eventsStore';
import { useAchievementSnapshot, useLevel, useRadar } from '../state/progression';
import { liveStreak, useProgress } from '../state/progressStore';
import { ownedSet, useRewards } from '../state/rewardsStore';
import { useSettings } from '../state/settingsStore';
import { useCosmetics } from '../state/useCosmetics';

const SLOTS: CosmeticSlot[] = ['theme', 'felt', 'cardBack', 'chips'];

export function ProfileScreen() {
  const navigate = useNavigate();
  const lvl = useLevel();
  const streak = useProgress((s) => s.streak);
  const bestStreak = useProgress((s) => s.bestStreak);
  const last = useProgress((s) => s.lastPracticeDay);
  const radar = useRadar();
  const snapshot = useAchievementSnapshot();
  const rewards = useRewards();
  const equipped = useCosmetics();
  const setChestOpen = useEvents((s) => s.setChestOpen);
  const settings = useSettings();
  const [slot, setSlot] = useState<CosmeticSlot>('theme');

  const arena = arenaForLevel(lvl.level);
  const next = nextArena(lvl.level);
  const owned = ownedSet(rewards.owned, lvl.level);
  const unlockedCount = ACHIEVEMENTS.filter((a) => rewards.achievements[a.id]).length;
  const autoSlot = slot === 'theme' || slot === 'felt';

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Profile"
        subtitle={`${arena.name} · Level ${lvl.level}`}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/')}>
            Home
          </GameButton>
        }
      />

      <Panel tone="night">
        <div className="flex items-center gap-3">
          <XPBadge level={lvl.level} progress={lvl.progress} />
          <div className="flex-1">
            <ProgressBar value={lvl.progress} color="gold" label={`${lvl.xpIntoLevel} / ${lvl.xpForNextLevel} XP`} />
            <div className="mt-1.5 flex justify-between text-sm font-bold">
              <span className="flex items-center gap-1 text-gold-300">
                <FlameIcon className="h-5 w-5" /> {liveStreak(streak, last)} day streak
              </span>
              <span className="text-cream/75">Best {Math.max(bestStreak ?? 0, streak)}</span>
            </div>
          </div>
        </div>
      </Panel>

      <Panel tone="wood" title="Arenas">
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {ARENAS.map((a) => {
            const open = lvl.level >= a.minLevel;
            const current = a.id === arena.id;
            return (
              <div
                key={a.id}
                className={`w-32 shrink-0 snap-start rounded-2xl border-[3px] border-ink p-2 text-center ${current ? 'bg-gold-500 text-ink' : open ? 'bg-felt-700' : 'bg-ink/50 text-cream/60'}`}
              >
                <div className="font-display text-base leading-tight">{a.name}</div>
                <div className="text-[11px] font-bold">{open ? (current ? 'You are here' : 'Unlocked') : `Level ${a.minLevel}`}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs font-bold text-cream/90">
          {next ? `Next: ${next.name} at level ${next.minLevel} (new table theme). ${arena.blurb}.` : `${arena.blurb}. You've reached the top arena!`}
        </p>
      </Panel>

      <Panel tone="night" title="Skill radar">
        <SkillRadar radar={radar} />
      </Panel>

      <Panel tone="cream" title={`Achievements ${unlockedCount}/${ACHIEVEMENTS.length}`}>
        <ul className="space-y-2">
          {ACHIEVEMENTS.map((a) => {
            const done = !!rewards.achievements[a.id];
            const p = done ? 1 : a.progress(snapshot);
            return (
              <li key={a.id} className={`flex items-center gap-3 rounded-2xl border-2 border-ink p-2 ${done ? 'bg-gold-300/60' : 'bg-white/50'}`}>
                <TrophyIcon locked={!done} className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-display text-base leading-tight">
                    {a.name}
                    {a.chest && <ChestIcon className="h-5 w-5" />}
                  </div>
                  <div className="text-xs font-bold text-ink/75">{a.description}</div>
                  {!done && <ProgressBar className="mt-1" value={p} color="green" />}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel tone="felt" title="Locker">
        <GameButton color="gold" fullWidth icon={<ChestIcon className="h-7 w-7" />} onClick={() => setChestOpen(true)}>
          {rewards.chests > 0 ? `Open chest (${rewards.chests})` : 'Chests'}
        </GameButton>
        <p className="mt-1 text-center text-xs font-bold text-cream/80">{chestCosmeticsLeft(owned)} cosmetics still to find · cosmetics never change the math</p>
        <div className="mt-3">
          <ChipGroup options={SLOTS.map((s) => ({ value: s, label: SLOT_NAMES[s] }))} value={[slot]} onChange={(v) => v[0] && setSlot(v[0])} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {autoSlot && (
            <button
              type="button"
              onClick={() => rewards.equip(slot, undefined)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-2xl border-[3px] border-ink p-2 ${!rewards.loadout[slot] ? 'bg-gold-500 text-ink' : 'bg-ink/40'}`}
            >
              <span className="font-display text-lg">Auto</span>
              <span className="text-[11px] font-bold">{slot === 'theme' ? 'Follows arena' : 'Matches theme'}</span>
            </button>
          )}
          {COSMETICS.filter((c) => c.slot === slot).map((c) => {
            const have = owned.has(c.id);
            const on = equipped[slot].id === c.id && (!autoSlot || rewards.loadout[slot] === c.id);
            return (
              <motion.button
                key={c.id}
                type="button"
                whileTap={have ? { scale: 0.92 } : undefined}
                disabled={!have}
                onClick={() => rewards.equip(slot, c.id)}
                aria-label={`${c.name}${have ? '' : ' (locked)'}`}
                className={`relative flex min-h-11 flex-col items-center gap-1 rounded-2xl border-[3px] border-ink p-2 ${on ? 'bg-gold-500 text-ink' : 'bg-ink/40'} ${have ? '' : 'opacity-60'}`}
              >
                <div className={have ? '' : 'brightness-[0.25] grayscale'}>
                  <CosmeticPreview item={c} className="h-12 w-12" />
                </div>
                <span className="text-center text-[11px] font-bold leading-tight">{have ? c.name : c.source === 'arena' ? 'Arena reward' : '???'}</span>
                <span className={`rounded-md border border-ink px-1 text-[10px] font-bold ${RARITY_STYLE[c.rarity]}`}>{RARITY_NAMES[c.rarity]}</span>
              </motion.button>
            );
          })}
        </div>
      </Panel>

      <Panel tone="night" title="Settings">
        <Toggle label="Sound effects" on={settings.soundOn} onChange={settings.setSoundOn} />
        <Toggle label="Haptics" hint="Vibration on Android; on iPhone needs iOS 18+" on={settings.hapticsOn} onChange={settings.setHapticsOn} />
        <Toggle label="Four-colour deck" hint="Blue diamonds, green clubs" on={settings.fourColorDeck} onChange={settings.setFourColorDeck} />
      </Panel>
    </div>
  );
}
