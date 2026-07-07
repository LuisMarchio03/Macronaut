export function CalorieRing({ consumido, meta }: { consumido: number; meta: number }) {
  const restante = Math.round(meta - consumido);
  const pct = meta > 0 ? Math.min(100, (consumido / meta) * 100) : 0;
  const acima = restante < 0;
  const c = 92;
  const r = 54;
  const circ = 2 * Math.PI * r;

  const NTICKS = 44;
  const ticks = Array.from({ length: NTICKS }, (_, k) => {
    const ang = (k / NTICKS) * 2 * Math.PI - Math.PI / 2;
    const on = k / NTICKS < pct / 100;
    return {
      x1: c + 66 * Math.cos(ang),
      y1: c + 66 * Math.sin(ang),
      x2: c + 72 * Math.cos(ang),
      y2: c + 72 * Math.sin(ang),
      on,
    };
  });

  return (
    <div className="relative flex flex-col items-center gap-3">
      {/* glow atrás do anel */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1 h-36 w-36 rounded-full bg-primary/20 blur-3xl"
      />
      <svg width="184" height="184" viewBox="0 0 184 184" className="relative">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" />
            <stop offset="100%" stopColor="var(--chart-4)" />
          </linearGradient>
        </defs>

        {/* ticks do mostrador */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.on ? "var(--primary)" : "var(--muted)"}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={t.on ? 0.9 : 0.4}
          />
        ))}

        {/* trilho + progresso */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="12"
          strokeDasharray={circ}
          strokeDashoffset={circ - (pct / 100) * circ}
          strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: "stroke-dashoffset 650ms cubic-bezier(0.22,1,0.36,1)" }}
        />

        <text
          x={c}
          y={c - 4}
          textAnchor="middle"
          className="fill-foreground text-3xl font-bold tabular-nums"
        >
          {Math.round(consumido)}
        </text>
        <text
          x={c}
          y={c + 18}
          textAnchor="middle"
          className="fill-muted-foreground font-mono text-[0.62rem] uppercase tracking-[0.15em]"
        >
          / {Math.round(meta)} kcal
        </text>
      </svg>

      <div className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary tabular-nums">
          {Math.round(pct)}%
        </span>
        <span className={acima ? "text-destructive" : "text-muted-foreground"}>
          {acima ? `+${-restante} kcal` : `restam ${restante} kcal`}
        </span>
      </div>
    </div>
  );
}
