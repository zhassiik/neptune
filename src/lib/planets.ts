/**
 * Курс блоктарының ғаламшарлары. Әр ғаламшар — CSS-пен сызылған шар:
 *   base    — жарық/көлеңкесі бар негізгі түс (қозғалмайды)
 *   texture — бетіндегі жолақтар мен дақтар (көлденең қайталанады, «айналу» үшін жылжиды)
 */
export const PLANET_KEYS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "moon", "sun"] as const;
export type PlanetKey = (typeof PLANET_KEYS)[number];

export interface PlanetStyle {
  name: string;
  base: string;
  texture: string;
  glow: string;
  ring?: string;
}

const spots = (list: [string, string, string, string][]) => list.map(([x, y, size, color]) => `radial-gradient(${size} at ${x} ${y}, ${color}, transparent 70%)`).join(", ");

export const PLANETS: Record<PlanetKey, PlanetStyle> = {
  mercury: {
    name: "Меркурий",
    base: "radial-gradient(circle at 32% 28%, #e7e5e4, #a8a29e 45%, #44403c 100%)",
    texture: spots([
      ["12%", "30%", "9% 9%", "rgb(68 64 60 / 0.45)"],
      ["30%", "68%", "6% 6%", "rgb(68 64 60 / 0.4)"],
      ["47%", "40%", "11% 11%", "rgb(87 83 78 / 0.35)"],
      ["68%", "22%", "5% 5%", "rgb(68 64 60 / 0.45)"],
      ["82%", "62%", "8% 8%", "rgb(68 64 60 / 0.4)"],
    ]),
    glow: "rgb(214 211 209 / 0.35)",
  },
  venus: {
    name: "Шолпан",
    base: "radial-gradient(circle at 32% 28%, #fef3c7, #f59e0b 50%, #78350f 100%)",
    texture: `${spots([
      ["20%", "35%", "18% 8%", "rgb(255 251 235 / 0.35)"],
      ["62%", "60%", "22% 9%", "rgb(255 251 235 / 0.3)"],
      ["88%", "28%", "14% 7%", "rgb(255 251 235 / 0.3)"],
    ])}, repeating-linear-gradient(172deg, rgb(255 255 255 / 0.12) 0 7%, transparent 7% 15%)`,
    glow: "rgb(251 191 36 / 0.45)",
  },
  earth: {
    name: "Жер",
    base: "radial-gradient(circle at 32% 28%, #bae6fd, #2563eb 50%, #0c1e5b 100%)",
    texture: spots([
      ["14%", "38%", "14% 20%", "rgb(34 197 94 / 0.9)"],
      ["22%", "62%", "9% 12%", "rgb(22 163 74 / 0.85)"],
      ["52%", "30%", "18% 12%", "rgb(132 204 22 / 0.85)"],
      ["58%", "58%", "10% 16%", "rgb(22 163 74 / 0.85)"],
      ["84%", "45%", "12% 18%", "rgb(34 197 94 / 0.85)"],
      ["40%", "12%", "30% 6%", "rgb(255 255 255 / 0.6)"],
      ["75%", "82%", "26% 5%", "rgb(255 255 255 / 0.55)"],
    ]),
    glow: "rgb(56 189 248 / 0.45)",
  },
  mars: {
    name: "Марс",
    base: "radial-gradient(circle at 32% 28%, #fed7aa, #ea580c 50%, #7c2d12 100%)",
    texture: spots([
      ["18%", "45%", "16% 10%", "rgb(124 45 18 / 0.5)"],
      ["44%", "62%", "12% 8%", "rgb(124 45 18 / 0.45)"],
      ["70%", "35%", "18% 9%", "rgb(154 52 18 / 0.45)"],
      ["50%", "10%", "22% 5%", "rgb(255 247 237 / 0.7)"],
    ]),
    glow: "rgb(249 115 22 / 0.45)",
  },
  jupiter: {
    name: "Юпитер",
    base: "radial-gradient(circle at 32% 28%, #fef3c7, #d97706 55%, #451a03 100%)",
    texture: `${spots([["30%", "64%", "10% 6%", "rgb(185 28 28 / 0.75)"], ["80%", "34%", "6% 4%", "rgb(255 255 255 / 0.4)"]])}, repeating-linear-gradient(180deg, rgb(120 53 15 / 0.35) 0 6%, rgb(254 243 199 / 0.25) 6% 11%, transparent 11% 16%, rgb(146 64 14 / 0.3) 16% 20%)`,
    glow: "rgb(245 158 11 / 0.4)",
  },
  saturn: {
    name: "Сатурн",
    base: "radial-gradient(circle at 32% 28%, #fefce8, #eab308 55%, #713f12 100%)",
    texture: `repeating-linear-gradient(180deg, rgb(161 98 7 / 0.28) 0 7%, rgb(254 249 195 / 0.25) 7% 12%, transparent 12% 18%), ${spots([["60%", "40%", "14% 6%", "rgb(255 255 255 / 0.3)"]])}`,
    glow: "rgb(250 204 21 / 0.4)",
    ring: "#fde68a",
  },
  uranus: {
    name: "Уран",
    base: "radial-gradient(circle at 32% 28%, #ecfeff, #22d3ee 50%, #155e75 100%)",
    texture: `repeating-linear-gradient(180deg, rgb(255 255 255 / 0.12) 0 9%, transparent 9% 18%), ${spots([["30%", "45%", "16% 8%", "rgb(255 255 255 / 0.25)"]])}`,
    glow: "rgb(34 211 238 / 0.45)",
    ring: "#a5f3fc",
  },
  neptune: {
    name: "Нептун",
    base: "radial-gradient(circle at 32% 28%, #b8f3ff, #2f6bf0 52%, #131d52 100%)",
    texture: `${spots([["35%", "58%", "12% 7%", "rgb(10 18 56 / 0.55)"], ["70%", "35%", "16% 4%", "rgb(255 255 255 / 0.35)"]])}, repeating-linear-gradient(168deg, rgb(255 255 255 / 0.08) 0 6%, transparent 6% 13%)`,
    glow: "rgb(79 220 251 / 0.5)",
    ring: "#85eaff",
  },
  moon: {
    name: "Ай",
    base: "radial-gradient(circle at 32% 28%, #fafaf9, #a8a29e 55%, #292524 100%)",
    texture: spots([
      ["15%", "40%", "10% 10%", "rgb(87 83 78 / 0.4)"],
      ["38%", "65%", "13% 13%", "rgb(87 83 78 / 0.35)"],
      ["58%", "30%", "7% 7%", "rgb(87 83 78 / 0.4)"],
      ["78%", "58%", "11% 11%", "rgb(87 83 78 / 0.35)"],
    ]),
    glow: "rgb(245 245 244 / 0.35)",
  },
  sun: {
    name: "Күн",
    base: "radial-gradient(circle at 40% 36%, #fffbeb, #fde047 35%, #f97316 75%, #c2410c 100%)",
    texture: spots([
      ["20%", "40%", "14% 14%", "rgb(255 255 255 / 0.35)"],
      ["55%", "65%", "12% 12%", "rgb(234 88 12 / 0.4)"],
      ["80%", "30%", "16% 16%", "rgb(255 255 255 / 0.3)"],
    ]),
    glow: "rgb(251 191 36 / 0.75)",
  },
};

export function isPlanetKey(v: unknown): v is PlanetKey {
  return typeof v === "string" && (PLANET_KEYS as readonly string[]).includes(v);
}

/** Жаңа блокқа әдепкі ғаламшар: реті бойынша (1 — Меркурий … 8 — Нептун, 9 — Ай, 10 — Күн) */
export function defaultPlanet(position: number): PlanetKey {
  return PLANET_KEYS[(Math.max(1, position) - 1) % PLANET_KEYS.length];
}
