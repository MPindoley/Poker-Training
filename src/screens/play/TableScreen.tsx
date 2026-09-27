import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { HERO, SPEED_MS, useTable } from '../../state/tableStore';
import { PokerTable } from '../../components/table/PokerTable';
import { ActionBar } from '../../components/table/ActionBar';
import { CoachPanel } from '../../components/table/CoachPanel';
import { HandReviewSheet } from '../../components/table/HandReviewSheet';
import { CardView, GameButton } from '../../components/ui';
import { indexToString } from '../../engine';
import { bbText } from '../../components/table/layout';

export function TableScreen() {
  const navigate = useNavigate();
  const t = useTable();
  const hand = t.hand;

  // Bots act on a timer so you can follow the action.
  useEffect(() => {
    if (!hand || hand.finished || hand.toAct === null || hand.toAct === HERO) return;
    const id = setTimeout(() => useTable.getState().botStep(), SPEED_MS[t.config.speed]);
    return () => clearTimeout(id);
  }, [hand, t.config.speed]);

  if (!t.active || !hand) return <Navigate to="/play" replace />;
  const heroTurn = !hand.finished && hand.toAct === HERO;
  const heroNet = (t.stacks[HERO] ?? 0) - (t.buyIns[HERO] ?? 0);

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col gap-2 pt-1">
      <div className="flex items-center justify-between gap-2">
        <GameButton size="sm" color="cream" onClick={() => navigate('/play')} aria-label="Leave table">
          ✕
        </GameButton>
        <div className="text-center font-display text-sm leading-tight">
          Hand #{hand.handNo}
          <div className={heroNet >= 0 ? 'text-felt-300' : 'text-[#ff9c94]'}>
            Session {heroNet >= 0 ? '+' : ''}
            {bbText(heroNet)}bb
          </div>
        </div>
        <GameButton size="sm" color="purple" onClick={() => navigate('/play/summary')}>
          Stats
        </GameButton>
      </div>

      <PokerTable hand={hand} bots={t.bots} positions={t.positions} showBadges={t.config.showBadges} />

      <div className="mt-auto space-y-2 pb-3">
        {hand.seats[HERO]!.hole.length > 0 && (
          <div className="-mt-3 flex items-end justify-center gap-3">
            <div className={`flex gap-1 transition-opacity ${hand.seats[HERO]!.folded ? 'opacity-40' : ''}`}>
              {hand.seats[HERO]!.hole.map((c) => (
                <CardView key={`${hand.handNo}-${c}`} card={indexToString(c)} size="md" dealt />
              ))}
            </div>
            <div className="mb-1 rounded-2xl border-2 border-ink bg-ink/60 px-2 py-1 font-display text-sm text-cream">
              {hand.seats[HERO]!.folded ? 'Folded' : `${bbText(hand.seats[HERO]!.stack)}bb`}
            </div>
          </div>
        )}
        {heroTurn && t.config.coach && <CoachPanel hand={hand} analysis={t.coach.analysis} preflop={t.coach.preflop} loading={t.coach.loading} error={t.coach.error} />}
        {heroTurn && <ActionBar hand={hand} onAct={t.heroAct} bbDollars={t.config.bigBlindDollars} />}
        {hand.finished && <HandReviewSheet hand={hand} review={t.lastReview} onNext={t.nextHand} onSummary={() => navigate('/play/summary')} />}
        {!heroTurn && !hand.finished && <div className="py-3 text-center font-display text-sm text-cream/70">{hand.seats[hand.toAct ?? 0]?.name} is thinking…</div>}
      </div>
    </div>
  );
}
