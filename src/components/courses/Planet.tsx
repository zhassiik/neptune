import { cn } from "@/lib/utils";
import { PLANETS, type PlanetKey } from "@/lib/planets";

/**
 * Айналып тұратын ғаламшар (CSS): негізгі шар + бетіндегі жылжитын жолақтар/дақтар + көлеңке + (бар болса) сақина.
 * Айналу — бет текстурасының көлденең жылжуы; «қозғалысты азайту» баптауында тоқтайды.
 */
export function Planet({ planet, className, slow = false }: { planet: PlanetKey; className?: string; slow?: boolean }) {
  const p = PLANETS[planet];
  return (
    <div className={cn("relative aspect-square shrink-0", className)} aria-hidden>
      <div className="absolute inset-[-14%] rounded-full blur-xl" style={{ background: `radial-gradient(circle, ${p.glow}, transparent 65%)` }} />
      {p.ring && (
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible">
          <ellipse cx="100" cy="100" rx="120" ry="30" transform="rotate(-18 100 100)" fill="none" stroke={p.ring} strokeOpacity="0.35" strokeWidth="9" />
        </svg>
      )}
      <div className="absolute inset-[10%] overflow-hidden rounded-full" style={{ background: p.base }}>
        <div className={cn("planet-surface absolute inset-0", slow && "[animation-duration:60s]")} style={{ backgroundImage: p.texture }} />
        {/* Көлеңке мен жарық — қозғалмайды */}
        <div className="absolute inset-0 rounded-full shadow-[inset_-14px_-12px_28px_rgb(2_6_23/0.75),inset_8px_6px_18px_rgb(255_255_255/0.25)]" />
      </div>
      {p.ring && (
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible">
          <path d="M -13.6 137.1 A 120 30 -18 0 0 213.6 62.9" fill="none" stroke={p.ring} strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
