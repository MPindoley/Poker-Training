import { useNavigate } from 'react-router-dom';
import { betSizeTable, formatPercent, outsTable } from '../../engine';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GameButton, Panel } from '../../components/ui';

const OUT_NAMES: Record<number, string> = {
  2: 'Pair → set',
  4: 'Gutshot',
  6: 'Two overs',
  8: 'Open-ender',
  9: 'Flush draw',
  12: 'Flush + over',
  15: 'Flush + OESD',
};

const th = 'px-1.5 py-1 text-left font-display text-xs text-gold-300';
const td = 'px-1.5 py-1 font-display text-sm tabular-nums';

export function CheatSheetScreen() {
  const navigate = useNavigate();
  const outs = outsTable(21);
  const sizes = betSizeTable();
  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Cheat Sheet"
        subtitle="Every number computed by the engine"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate(-1)}>
            Back
          </GameButton>
        }
      />

      <Panel tone="night" title="Bet sizes">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Bet</th>
                <th className={th}>Need to call</th>
                <th className={th}>Odds</th>
                <th className={th}>MDF</th>
                <th className={th}>Bluff BE</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((r) => (
                <tr key={r.label} className="odd:bg-white/5">
                  <td className={`${td} font-body font-bold`}>{r.label}</td>
                  <td className={td}>{formatPercent(r.potOdds)}</td>
                  <td className={td}>{r.oddsRatio.toFixed(1)}:1</td>
                  <td className={td}>{formatPercent(r.mdf)}</td>
                  <td className={td}>{formatPercent(r.bluffBreakeven)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs font-semibold text-cream/75">
          Need to call = call / (pot + bet + call). MDF = pot / (pot + bet). Bluff breakeven = bet / (pot + bet).
        </p>
      </Panel>

      <Panel tone="night" title="Outs to percent">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Outs</th>
                <th className={th}>Flop→Turn</th>
                <th className={th}>Flop→River</th>
                <th className={th}>Turn→River</th>
                <th className={th}>Rule 2/4</th>
              </tr>
            </thead>
            <tbody>
              {outs.map((r) => (
                <tr key={r.outs} className="odd:bg-white/5">
                  <td className={td}>
                    {r.outs}
                    {OUT_NAMES[r.outs] && <span className="block font-body text-[10px] font-bold text-cream/70">{OUT_NAMES[r.outs]}</span>}
                  </td>
                  <td className={td}>{formatPercent(r.flopToTurn)}</td>
                  <td className={td}>{formatPercent(r.flopToRiver)}</td>
                  <td className={td}>{formatPercent(r.turnToRiver)}</td>
                  <td className={`${td} text-cream/70`}>
                    {formatPercent(r.ruleOf2, 0)} / {formatPercent(r.ruleOf4, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs font-semibold text-cream/75">
          Flop→River assumes you see both cards (e.g. all-in). Exact: 1 − C(47 − outs, 2) / C(47, 2).
        </p>
      </Panel>
    </div>
  );
}
