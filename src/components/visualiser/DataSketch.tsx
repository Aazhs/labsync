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
