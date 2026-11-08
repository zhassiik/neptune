/**
 * Курс блоктарының ғаламшарлары. Әр ғаламшар — CSS-пен сызылған шар:
 *   base    — жарық/көлеңкесі бар негізгі түс (қозғалмайды)
 *   texture — бетіндегі жолақтар мен дақтар (көлденең қайталанады, «айналу» үшін жылжиды)
 */
export const PLANET_KEYS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "moon", "sun"] as const;
export type PlanetKey = (typeof PLANET_KEYS)[number];

/** Сақинаның бір жолағы (viewBox 0..200, шар радиусы 80) */
export interface RingBand {
  rx: number;
  width: number;
  color: string;
  opacity: number;
  /** Үзік доғалар (Нептунның Адамс сақинасы сияқты) */
  dash?: string;
}

export interface RingStyle {
  /** Еңкіштік, градус (Уран — тікке жақын) */
  tilt: number;
  /** ry / rx — сақинаның қаншалықты «жалпақ» көрінетіні */
  ratio: number;
  bands: RingBand[];
}

export interface PlanetStyle {
  name: string;
  base: string;
  texture: string;
  glow: string;
  /** Бұлттар — бетінен жылдамырақ жылжитын бөлек қабат */
  clouds?: string;
  /** Қозғалмайтын қабат: полюстегі мұз және т.б. */
  overlay?: string;
  /** Атмосфераның жіңішке жарқыраған шеті */
  atmosphere?: string;
  ring?: RingStyle;
}

const spots = (list: [string, string, string, string][]) => list.map(([x, y, size, color]) => `radial-gradient(${size} at ${x} ${y}, ${color}, transparent 70%)`).join(", ");
/** Құрлық: жиегі айқынырақ эллипстер (бірнешеуі қабаттасып, пішін құрайды) */
const land = (list: [string, string, string, string][]) =>
  list.map(([x, y, size, color]) => `radial-gradient(${size} at ${x} ${y}, ${color} 0 72%, transparent 92%)`).join(", ");

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
    atmosphere: "rgb(254 243 199 / 0.6)",
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
    // Мұхит: жарық жағы көгілдір, көлеңкесі терең көк
    base: "radial-gradient(circle at 32% 28%, #7dd3fc, #1d64d8 42%, #0b2a6b 78%, #061536 100%)",
    // Текстура плиткасы шардан 2 есе кең: x — плиткадағы орны
    texture: land([
      // Солтүстік Америка
      ["12%", "28%", "15% 22.1%", "#2f9e44"],
      ["19%", "18%", "12% 13%", "#3fae4f"],
      ["8%", "40%", "7.5% 11.7%", "#4d9a3a"],
      ["16%", "44%", "6% 9.1%", "#3b8f3a"],
      // Оңтүстік Америка
      ["21%", "64%", "9.8% 19.5%", "#2f8f3f"],
      ["19%", "80%", "5.2% 10.4%", "#4c8a2f"],
      // Гренландия
      ["30%", "12%", "6.8% 9.1%", "#e8f1f7"],
      // Еуропа
      ["46%", "24%", "10.5% 11.7%", "#4aa34a"],
      // Африка (ортасы — Сахара)
      ["50%", "52%", "12.8% 22.1%", "#3f9a3f"],
      ["49%", "43%", "9.8% 10.4%", "#c9a35b"],
      ["54%", "66%", "7.5% 13%", "#358f39"],
      // Азия
      ["64%", "25%", "22.5% 16.9%", "#4e9f3d"],
      ["72%", "38%", "13.5% 11.7%", "#5aa83f"],
      ["65%", "31%", "9% 7.8%", "#b9975a"],
      ["68%", "48%", "5.2% 10.4%", "#3f9440"],
      ["77%", "52%", "6.8% 7.8%", "#3a9a46"],
      // Аустралия
      ["84%", "70%", "10.5% 10.4%", "#c08b4a"],
      ["85%", "68%", "6.8% 6.5%", "#a7753a"],
      // Антарктида жағалауы
      ["40%", "96%", "45% 7.8%", "#eef4f8"],
    ]),
    clouds: [
      ...[
        ["8%", "24%", "13% 2.6%"],
        ["30%", "58%", "16% 2.4%"],
        ["44%", "36%", "10% 2.2%"],
        ["60%", "72%", "14% 2.8%"],
        ["76%", "18%", "12% 2.2%"],
        ["92%", "46%", "15% 2.6%"],
        ["22%", "84%", "11% 2.2%"],
      ].map(([x, y, size]) => `radial-gradient(${size} at ${x} ${y}, rgb(255 255 255 / 0.9) 0 30%, transparent 75%)`),
      ...[
        ["16%", "42%", "5% 4%"],
        ["54%", "20%", "4% 3.5%"],
        ["86%", "62%", "5% 4%"],
      ].map(([x, y, size]) => `radial-gradient(${size} at ${x} ${y}, rgb(255 255 255 / 0.55), transparent 70%)`),
    ].join(", "),
    // Полюстегі мұз
    overlay: "radial-gradient(42% 10% at 50% 0%, rgb(248 250 252 / 0.95) 0 55%, transparent 80%), radial-gradient(36% 8% at 50% 100%, rgb(248 250 252 / 0.9) 0 50%, transparent 80%)",
    atmosphere: "rgb(125 211 252 / 0.75)",
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
    // Юпитердің сақинасы өте күңгірт әрі жіңішке
    ring: { tilt: -8, ratio: 0.2, bands: [{ rx: 100, width: 3, color: "#fde68a", opacity: 0.35 }] },
  },
  saturn: {
    name: "Сатурн",
    base: "radial-gradient(circle at 32% 28%, #fefce8, #eab308 55%, #713f12 100%)",
    texture: `repeating-linear-gradient(180deg, rgb(161 98 7 / 0.28) 0 7%, rgb(254 249 195 / 0.25) 7% 12%, transparent 12% 18%), ${spots([["60%", "40%", "14% 6%", "rgb(255 255 255 / 0.3)"]])}`,
    glow: "rgb(250 204 21 / 0.4)",
    // Сатурн: жалпақ, жарық сақиналар — C (күңгірт), B (ең жарық), Кассини саңылауы, A
    ring: {
      tilt: -18,
      ratio: 0.3,
      bands: [
        { rx: 93, width: 6, color: "#cbb98f", opacity: 0.35 },
        { rx: 105, width: 13, color: "#f6e3b4", opacity: 0.92 },
        { rx: 123, width: 10, color: "#e2c88f", opacity: 0.78 },
      ],
    },
  },
  uranus: {
    name: "Уран",
    base: "radial-gradient(circle at 32% 28%, #ecfeff, #22d3ee 50%, #155e75 100%)",
    texture: `repeating-linear-gradient(180deg, rgb(255 255 255 / 0.12) 0 9%, transparent 9% 18%), ${spots([["30%", "45%", "16% 8%", "rgb(255 255 255 / 0.25)"]])}`,
    glow: "rgb(34 211 238 / 0.45)",
    atmosphere: "rgb(207 250 254 / 0.55)",
    // Уран 98° жатып айналады — сақиналары тікке жақын, жіңішке
    ring: {
      tilt: 78,
      ratio: 0.24,
      bands: [
        { rx: 98, width: 3, color: "#cffafe", opacity: 0.55 },
        { rx: 110, width: 4.5, color: "#e0f2fe", opacity: 0.8 },
      ],
    },
  },
  neptune: {
    name: "Нептун",
    base: "radial-gradient(circle at 32% 28%, #b8f3ff, #2f6bf0 52%, #131d52 100%)",
    texture: `${spots([["35%", "58%", "12% 7%", "rgb(10 18 56 / 0.55)"], ["70%", "35%", "16% 4%", "rgb(255 255 255 / 0.35)"]])}, repeating-linear-gradient(168deg, rgb(255 255 255 / 0.08) 0 6%, transparent 6% 13%)`,
    glow: "rgb(79 220 251 / 0.5)",
    atmosphere: "rgb(133 234 255 / 0.6)",
    // Нептун: күңгірт жіңішке сақиналар, сыртқысы (Адамс) — үзік доғалар
    ring: {
      tilt: -14,
      ratio: 0.26,
      bands: [
        { rx: 100, width: 3, color: "#bfdbfe", opacity: 0.45 },
        { rx: 116, width: 4, color: "#a5f3fc", opacity: 0.6, dash: "46 10 22 34" },
      ],
    },
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
