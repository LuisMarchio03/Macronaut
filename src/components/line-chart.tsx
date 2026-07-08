export function LineChart({
  pontos,
  unidade = "",
  msgVazia = "Registre mais treinos para ver a progressão.",
}: {
  pontos: { x: string; y: number }[];
  unidade?: string;
  msgVazia?: string;
}) {
  if (pontos.length < 2) {
    return (
      <p className="py-8 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
        {msgVazia}
      </p>
    );
  }

  const W = 320;
  const H = 160;
  const pad = 28;
  const ys = pontos.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;

  const px = (i: number) => pad + (i * (W - 2 * pad)) / (pontos.length - 1);
  const py = (y: number) => H - pad - ((y - minY) / range) * (H - 2 * pad);

  const linha = pontos.map((p, i) => `${px(i)},${py(p.y)}`).join(" ");
  const area = `${pad},${H - pad} ${linha} ${W - pad},${H - pad}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="max-w-full">
      <defs>
        <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* eixos */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--border)" />

      {/* área + linha */}
      <polygon points={area} fill="url(#chartArea)" />
      <polyline
        points={linha}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 4px var(--primary))" }}
      />
      {pontos.map((p, i) => (
        <circle
          key={i}
          cx={px(i)}
          cy={py(p.y)}
          r="3"
          fill="var(--primary)"
          stroke="var(--background)"
          strokeWidth="1.5"
        />
      ))}

      <text x={pad} y={pad - 8} className="fill-muted-foreground font-mono text-[10px] tabular-nums">
        {Math.round(maxY)} {unidade}
      </text>
      <text
        x={pad}
        y={H - pad + 14}
        className="fill-muted-foreground font-mono text-[10px] tabular-nums"
      >
        {Math.round(minY)} {unidade}
      </text>
    </svg>
  );
}
