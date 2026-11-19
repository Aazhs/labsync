import { useId } from 'react';
import type { Stage } from '@/lib/visualiser/animation';

export default function AnimationStage({ stage }: { stage: Stage }) {
  const { columns, slots, layout, tiles, links, focus, changed } = stage;
  const marker = useId().replace(/:/g, '');
  const rows = Math.ceil(slots / columns);
  const pitch = Math.min(layout === 'grid' ? 56 : 100, 500 / columns);
  const dy = layout === 'grid' ? pitch : Math.min(82, Math.max(34, 260 / rows));
  const w = columns * pitch + 24,
    h = rows * dy + 24;
  const width = pitch * (layout === 'grid' ? 0.93 : layout === 'graph' ? 0.62 : 0.84),
    height = dy * 0.79;
  const point = (slot: number) => [
    12 + ((slot % columns) + 0.5) * pitch,
    12 + (Math.floor(slot / columns) + 0.5) * dy,
  ];
  const transform = (slot: number) => {
    const [x, y] = point(slot);
    return `translate(${x}px, ${y}px)`;
  };
  return (
    <figure className={'vs-stage vs-stage-' + layout}>
      <figcaption>{stage.label}</figcaption>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={stage.label}
        style={{ maxHeight: layout === 'grid' ? 325 : 270 }}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="currentColor" />
          </marker>
        </defs>
        {links.map(([a, b], i) => {
          const [x, y] = point(a),
            [u, v] = point(b),
            angle = Math.atan2(v - y, u - x);
          // Stop at the tile's edge in this direction, so arrowheads stay visible beside wide tiles.
          const radius =
            Math.min(width / 2 / Math.abs(Math.cos(angle) || 1e-9), height / 2 / Math.abs(Math.sin(angle) || 1e-9)) +
            3;
          return (
            <line
              key={i}
              className={focus.includes(a) && focus.includes(b) ? 'hot' : ''}
              x1={x + radius * Math.cos(angle)}
              y1={y + radius * Math.sin(angle)}
              x2={u - radius * Math.cos(angle)}
              y2={v - radius * Math.sin(angle)}
              markerEnd={`url(#${marker})`}
            />
          );
        })}
        {tiles.map((t) => {
          const active = focus.includes(t.slot),
            write = changed.includes(t.slot);
          return (
            <g
              className={
                'vs-moving-tile' +
                (active ? ' active' : '') +
                (write ? ' write' : '') +
                (t.value || t.label ? '' : ' empty')
              }
              key={t.id}
              data-slot={t.slot}
              style={{ transform: transform(t.slot) }}
            >
              <title>{(t.label || String(t.slot)) + ' · ' + t.value}</title>
              <rect
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                rx={layout === 'graph' ? height / 2 : layout === 'grid' ? 4 : 8}
              />
              {t.label && (
                <text className="vs-tile-name" y={-height * 0.19} textAnchor="middle">
                  {t.label.slice(0, 14)}
                </text>
              )}
              <text
                key={t.value}
                className="vs-tile-value"
                y={t.label ? height * 0.19 : 0}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(22, height * 0.52, (width * 1.35) / Math.max(2, t.value.length))}
              >
                {t.value}
              </text>
            </g>
          );
        })}
        {focus.slice(0, 1).map((slot) => (
          <g key="cursor" className="vs-stage-cursor" style={{ transform: transform(slot) }}>
            <rect
              x={-width / 2 - 2}
              y={-height / 2 - 2}
              width={width + 4}
              height={height + 4}
              rx={layout === 'graph' ? height / 2 : 6}
            />
          </g>
        ))}
      </svg>
    </figure>
  );
}
