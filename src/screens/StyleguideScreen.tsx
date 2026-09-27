import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPercent, hitProbability, levelFromXp, potOdds } from '../engine';
import { useProgress } from '../state/progressStore';
import { useSettings } from '../state/settingsStore';
import { toast } from '../state/toastStore';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  CardView,
  Celebration,
  ChipStack,
  FeedbackBanner,
  GameButton,
  Panel,
  ProgressBar,
  RangeGrid,
  Toggle,
  XPBadge,
} from '../components/ui';

const SAMPLE_RANGE = ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'KQs', 'AKo', 'AQo'];

function Section({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-outline-sm font-display text-2xl text-cream">{name}</h2>
      {children}
    </section>
  );
}

export function StyleguideScreen() {
  const navigate = useNavigate();
  const [range, setRange] = useState<Set<string>>(new Set(SAMPLE_RANGE));
  const [burst, setBurst] = useState(0);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const { fourColorDeck, setFourColorDeck } = useSettings();
  const { xp, addXp } = useProgress();
  const lvl = levelFromXp(xp);

  // Every number in these examples comes from the engine.
  const halfPot = potOdds(30, 10); // pot 20, villain shoves 10
  const potBet = potOdds(40, 20); // pot 20, villain shoves 20
  const overbet = potOdds(60, 40); // pot 20, villain bets 40
  const flushDrawFlop = hitProbability(9, 47, 2); // flop, all-in: see turn + river
  const straightDrawFlop = hitProbability(8, 47, 2);
  const gutshotTurn = hitProbability(4, 46, 1);

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Styleguide"
        subtitle="Every building block in one place"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate(-1)}>
            Back
          </GameButton>
        }
      />

      <Section name="GameButton">
        <div className="grid grid-cols-3 gap-3">
          <GameButton color="green">Call</GameButton>
          <GameButton color="gold">Raise</GameButton>
          <GameButton color="red">Fold</GameButton>
          <GameButton color="blue" size="sm">Check</GameButton>
          <GameButton color="purple" size="sm">Info</GameButton>
          <GameButton color="cream" size="sm" disabled>
            Locked
          </GameButton>
        </div>
        <GameButton color="gold" size="lg" fullWidth>
          Deal Me In
        </GameButton>
      </Section>

      <Section name="Toggle">
        <Panel tone="night">
          <ToggleDemo />
        </Panel>
      </Section>

      <Section name="Panel">
        <Panel tone="cream" title="Cream">
          Default content panel for questions and explanations.
        </Panel>
        <div className="grid grid-cols-3 gap-3">
          <Panel tone="wood">Wood</Panel>
          <Panel tone="felt">Felt</Panel>
          <Panel tone="night">Night</Panel>
        </div>
      </Section>

      <Section name="CardView">
        <Panel tone="felt">
          <label className="mb-3 flex items-center justify-between font-display text-lg">
            Four-colour deck
            <GameButton size="sm" color={fourColorDeck ? 'gold' : 'cream'} onClick={() => setFourColorDeck(!fourColorDeck)}>
              {fourColorDeck ? 'On' : 'Off'}
            </GameButton>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2">
            <CardView card="As" size="lg" dealt />
            <CardView card="Kh" dealt />
            <CardView card="Td" dealt />
            <CardView card="7c" dealt />
            <CardView faceDown size="sm" />
          </div>
        </Panel>
      </Section>

      <Section name="ChipStack">
        <Panel tone="felt">
          <div className="grid grid-cols-2 items-end justify-items-center gap-y-5">
            <ChipStack amount={7} unit="$" />
            <ChipStack amount={135} unit="$" />
            <ChipStack amount={40} unit="bb" />
            <ChipStack amount={1765} />
          </div>
        </Panel>
      </Section>

      <Section name="ProgressBar & XPBadge">
        <Panel tone="night">
          <div className="flex items-center gap-3">
            <XPBadge level={lvl.level} progress={lvl.progress} size={72} />
            <div className="flex-1 space-y-2">
              <ProgressBar value={lvl.progress} color="gold" label={`${lvl.xpIntoLevel} / ${lvl.xpForNextLevel} XP`} />
              <GameButton size="sm" color="green" onClick={() => addXp(40)}>
                +40 XP
              </GameButton>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <ProgressBar value={0.25} color="red" size="sm" />
            <ProgressBar value={0.6} color="blue" size="sm" />
            <ProgressBar value={0.9} color="purple" size="sm" />
          </div>
          <div className="mt-3 flex justify-around">
            <XPBadge level={1} progress={0.1} size={48} />
            <XPBadge level={12} progress={0.5} size={48} />
            <XPBadge level={99} progress={0.95} size={48} />
          </div>
        </Panel>
      </Section>

      <Section name="RangeGrid">
        <Panel tone="night">
          <p className="mb-2 text-sm font-semibold text-cream/85">Tap or drag to paint hands in and out.</p>
          <RangeGrid selected={range} onChange={setRange} />
          <div className="mt-3 flex gap-2">
            <GameButton size="sm" color="cream" onClick={() => setRange(new Set())}>
              Clear
            </GameButton>
            <GameButton size="sm" color="gold" onClick={() => setRange(new Set(SAMPLE_RANGE))}>
              Sample
            </GameButton>
          </div>
        </Panel>
      </Section>

      <Section name="Feedback banner">
        <div key={feedbackKey} className="space-y-4">
          <FeedbackBanner
            tone="best"
            title="Call is best"
            math={[
              `Need: ${halfPot.working}`,
              `Have: 9 outs, 2 cards = 1 − C(38,2)/C(47,2) = ${formatPercent(flushDrawFlop)}`,
            ]}
          >
            Villain shoves half-pot on the flop and you hold a flush draw. You need {formatPercent(halfPot.requiredEquity)}{' '}
            and hit {formatPercent(flushDrawFlop)} of the time by the river.
          </FeedbackBanner>
          <FeedbackBanner
            tone="acceptable"
            title="Close call"
            math={[
              `Need: ${potBet.working}`,
              `Have: 8 outs, 2 cards = 1 − C(39,2)/C(47,2) = ${formatPercent(straightDrawFlop)}`,
            ]}
          >
            A pot-sized flop shove against your open-ender asks for {formatPercent(potBet.requiredEquity)}; you have{' '}
            {formatPercent(straightDrawFlop)}. Folding is slightly better, but calling only loses a sliver.
          </FeedbackBanner>
          <FeedbackBanner
            tone="mistake"
            title="Too loose"
            math={[`Need: ${overbet.working}`, `Have: 4 outs, 1 card = 4/46 = ${formatPercent(gutshotTurn)}`]}
          >
            A 2x-pot turn overbet needs {formatPercent(overbet.requiredEquity)} equity; a gutshot hits only{' '}
            {formatPercent(gutshotTurn)}.
          </FeedbackBanner>
        </div>
        <GameButton size="sm" color="cream" onClick={() => setFeedbackKey((k) => k + 1)}>
          Replay animations
        </GameButton>
      </Section>

      <Section name="Toasts & celebration">
        <div className="grid grid-cols-2 gap-3">
          <GameButton size="sm" color="green" onClick={() => toast({ tone: 'best', title: 'Nice!', message: '+20 XP' })}>
            Best toast
          </GameButton>
          <GameButton size="sm" color="blue" onClick={() => toast({ tone: 'acceptable', title: 'Not bad', message: '+10 XP' })}>
            OK toast
          </GameButton>
          <GameButton size="sm" color="red" onClick={() => toast({ tone: 'mistake', title: 'Oops', message: 'Check the pot odds.' })}>
            Mistake toast
          </GameButton>
          <GameButton size="sm" color="purple" onClick={() => toast({ tone: 'info', title: 'Tip', message: 'Tap a toast to dismiss.' })}>
            Info toast
          </GameButton>
        </div>
        <div className="relative">
          {burst > 0 && <Celebration key={burst} />}
          <GameButton color="gold" fullWidth onClick={() => setBurst((b) => b + 1)}>
            Confetti + Coins
          </GameButton>
        </div>
      </Section>
    </div>
  );
}

function ToggleDemo() {
  const [on, setOn] = useState(true);
  return <Toggle label="Sound effects" hint="Chunky switch, 44px tap target" on={on} onChange={setOn} />;
}
