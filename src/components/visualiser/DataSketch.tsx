import type { Frame } from '@/lib/visualiser/trace';

// For Hanoi the program itself announces each move. Rebuild the rods from that output,
// so stepping backwards and replaying a different input always agree with the run.
export function HanoiSketch({ count, output }: { count: number; output: string }) {
  if (!Number.isInteger(count) || count < 1 || count > 15) return null;
  const rods: number[][] = [Array.from({ length: count }, (_, i) => count - i), [], []];
  for (const match of output.matchAll(/Move disk (\d+) from ([ABC]) to ([ABC])/g)) {
    const disk = Number(match[1]);
    const from = rods['ABC'.indexOf(match[2])];
    if (from[from.length - 1] !== disk) return null;
    from.pop();
    rods['ABC'.indexOf(match[3])].push(disk);
  }
  const height = Math.min(17, 108 / count);
  return (
    <figure className="vs-hanoi" aria-label="Tower of Hanoi rods">
      <div className="vs-rods">
        {rods.map((rod, i) => (
          <div key={i} className="vs-rod">
            <span>{'ABC'[i]}</span>
            <span className="sr-only">{rod.join(', ') || 'empty'}</span>
          </div>
        ))}
        {Array.from({ length: count }, (_, i) => {
          const disk = i + 1,
            r = rods.findIndex((rod) => rod.includes(disk));
          return (
            <div
              key={disk}
              className="vs-disk"
              aria-hidden="true"
              style={{
                left: ((r + 0.5) * 100) / 3 + '%',
                bottom: rods[r].indexOf(disk) * height + 4,
                height,
                width: 9 + (disk / count) * 20 + '%',
                background: ['#e3b66c', '#9bcab6', '#b7b7d8', '#dfaba8'][i % 4],
              }}
            >
              {height >= 13 ? disk : ''}
            </div>
          );
        })}
      </div>
    </figure>
  );
}

// Bar positions follow the captured array. Stable keys let an in-place swap travel
// across the sketch; a second occurrence index distinguishes equal values.
export function ArraySketch({ frame }: { frame: Frame }) {
  const entry = Object.entries(frame.values).find(
    ([, v]) =>
      Array.isArray(v) &&
      v.length > 0 &&
      v.length <= 12 &&
      v.every((x) => x.trim() && Number.isFinite(Number(x))),
  );
  if (!entry || !Array.isArray(entry[1])) return null;
  const [name, values] = entry as [string, string[]];
  const magnitude = Math.max(1, ...values.map((x) => Math.abs(Number(x))));
  const pointers = ['low', 'high', 'mid', 'i'].filter((k) => frame.values[k] !== undefined);
  return (
    <figure className="vs-array" aria-label={name + ' array diagram'}>
      <figcaption>{name}</figcaption>
      <div className="vs-bars">
        {values.map((v, i) => {
          const key = v + '/' + values.slice(0, i).filter((x) => x === v).length;
          const flags = pointers.filter((k) => Number(frame.values[k]) === i);
          return (
            <div
              className={'vs-bar-slot' + (flags.length ? ' vs-pointed' : '')}
              key={key}
              style={{ left: (i * 100) / values.length + '%', width: 100 / values.length + '%' }}
            >
              <span className="vs-bar" style={{ height: 19 + (Math.abs(Number(v)) / magnitude) * 37 }}>
                {v}
              </span>
              <small>{i}</small>
              <strong>{flags.join(' · ')}</strong>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
