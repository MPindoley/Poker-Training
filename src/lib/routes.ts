/** Where to send the player to practise a drill kind. */
export function routeForKind(kind: string): string {
  if (kind.startsWith('math.')) return `/train/math/play?kind=${kind}&d=bronze`;
  if (kind === 'preflop.paint') return '/train/preflop/paint';
  if (kind.startsWith('preflop.')) return `/train/preflop/play?kind=${kind}&d=bronze`;
  if (kind.startsWith('postflop.')) return `/train/postflop/play?theme=${kind.slice('postflop.'.length)}`;
  if (kind.startsWith('exploit.')) return `/train/exploit/play?pack=${kind}`;
  if (kind === 'lab.guess') return '/train/lab?guess=1';
  if (kind.startsWith('equity.')) return `/train/math/play?kind=${kind}&d=bronze`;
  return '/train';
}
