export function ScoreDonut({ score, max }: { score: number; max: number }) {
  const pct = max ? score / max : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = pct >= 0.8 ? "#10b981" : pct >= 0.5 ? "#2f7cf6" : pct >= 0.3 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative size-44 shrink-0 sm:size-52">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`${score}/${max} балл`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#eef5ff" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="font-display text-4xl font-extrabold text-navy-900 sm:text-5xl">
          {score}
          <span className="text-xl text-slate-400 sm:text-2xl">/{max}</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-500">{Math.round(pct * 100)}%</div>
      </div>
    </div>
  );
}
