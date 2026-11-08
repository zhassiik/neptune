import { cn } from "@/lib/utils";
import { PLANETS, type PlanetKey, type RingStyle } from "@/lib/planets";

/** Сақина: артқы жартысы шардың артында (толық эллипс), алдыңғы жартысы шардың үстінде (доға) */
function Ring({ ring, part }: { ring: RingStyle; part: "back" | "front" }) {
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <g transform={`rotate(${ring.tilt} 100 100)`}>
        {ring.bands.map((b) => {
          const ry = b.rx * ring.ratio;
          const common = { fill: "none", stroke: b.color, strokeWidth: b.width, strokeDasharray: b.dash };
          return part === "back" ? (
            <ellipse key={b.rx} cx="100" cy="100" rx={b.rx} ry={ry} strokeOpacity={b.opacity * 0.55} {...common} />
          ) : (
            // Төменгі (алдыңғы) жарты доға: сол нүктеден оң нүктеге, төмен қарай
            <path key={b.rx} d={`M ${100 - b.rx} 100 A ${b.rx} ${ry} 0 0 0 ${100 + b.rx} 100`} strokeOpacity={b.opacity} {...common} />
          );
        })}
      </g>
    </svg>
  );
}

/**
 * Айналып тұратын ғаламшар (CSS): негізгі шар + жылжитын беті + (бар болса) бұлттар, мұз, атмосфера және сақина.
 * Айналу — бет текстурасының көлденең жылжуы; «қозғалысты азайту» баптауында тоқтайды.
 */
export function Planet({ planet, className, slow = false }: { planet: PlanetKey; className?: string; slow?: boolean }) {
  const p = PLANETS[planet];
  return (
    <div className={cn("relative aspect-square shrink-0", className)} aria-hidden>
      <div className="absolute inset-[-14%] rounded-full blur-xl" style={{ background: `radial-gradient(circle, ${p.glow}, transparent 65%)` }} />
      {p.ring && <Ring ring={p.ring} part="back" />}
      <div
        className="absolute inset-[10%] overflow-hidden rounded-full"
        style={{ background: p.base, boxShadow: p.atmosphere ? `0 0 0 1px ${p.atmosphere}, 0 0 10px 1px ${p.atmosphere}` : undefined }}
      >
        <div className={cn("planet-surface absolute inset-0", slow && "[animation-duration:60s]")} style={{ backgroundImage: p.texture }} />
        {p.clouds && <div className={cn("planet-surface absolute inset-0", slow ? "[animation-duration:42s]" : "[animation-duration:19s]")} style={{ backgroundImage: p.clouds }} />}
        {p.overlay && <div className="absolute inset-0" style={{ backgroundImage: p.overlay }} />}
        {/* Көлеңке мен жарық — қозғалмайды */}
        <div className="absolute inset-0 rounded-full shadow-[inset_-14px_-12px_28px_rgb(2_6_23/0.75),inset_8px_6px_18px_rgb(255_255_255/0.25)]" />
        {/* Атмосфераның ішкі жиегі */}
        {p.atmosphere && <div className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 6px 1px ${p.atmosphere}` }} />}
      </div>
      {p.ring && <Ring ring={p.ring} part="front" />}
    </div>
  );
}
