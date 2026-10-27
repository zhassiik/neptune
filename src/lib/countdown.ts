/** Кері санақ: ай / күн / сағат / минут (күнтізбелік айлармен) */
export interface CountdownParts {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  done: boolean;
}

export function countdownParts(nowMs: number, targetMs: number): CountdownParts {
  if (!Number.isFinite(targetMs) || targetMs <= nowMs) return { months: 0, days: 0, hours: 0, minutes: 0, done: true };
  const now = new Date(nowMs);
  let months = 0;
  // Ай санын күнтізбе бойынша қосамыз (мысалы, 3 қазан → 3 қаңтар = 3 ай)
  for (;;) {
    const next = new Date(now);
    next.setMonth(now.getMonth() + months + 1);
    if (next.getTime() > targetMs) break;
    months++;
  }
  const anchor = new Date(now);
  anchor.setMonth(now.getMonth() + months);
  let rest = Math.floor((targetMs - anchor.getTime()) / 60000);
  const days = Math.floor(rest / 1440);
  rest -= days * 1440;
  const hours = Math.floor(rest / 60);
  const minutes = rest - hours * 60;
  return { months, days, hours, minutes, done: false };
}
