"use client";

import { useEffect, useState } from "react";

/** Watermark орналасатын аймақтар (% бойынша) — басқару панелінен жоғары, ортаға жақын емес */
const SPOTS = [
  { top: 6, left: 6 },
  { top: 6, left: 60 },
  { top: 24, left: 10 },
  { top: 22, left: 58 },
  { top: 40, left: 6 },
  { top: 42, left: 60 },
  { top: 14, left: 34 },
  { top: 34, left: 36 },
];

const nextDelay = () => 20_000 + Math.random() * 10_000; // 20–30 секунд

/**
 * Оқушының аты мен email-і бар жартылай мөлдір белгі.
 * Видеоны жаппайды (pointer-events: none), 20–30 секунд сайын орнын ауыстырады.
 */
export function Watermark({ name, email }: { name: string; email: string }) {
  const [spot, setSpot] = useState(() => Math.floor(Math.random() * SPOTS.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let fade: ReturnType<typeof setTimeout>;
    const move = () => {
      setVisible(false);
      fade = setTimeout(() => {
        setSpot((current) => {
          let next = current;
          while (next === current) next = Math.floor(Math.random() * SPOTS.length);
          return next;
        });
        setVisible(true);
      }, 600);
      timer = setTimeout(move, nextDelay());
    };
    timer = setTimeout(move, nextDelay());
    return () => {
      clearTimeout(timer);
      clearTimeout(fade);
    };
  }, []);

  const { top, left } = SPOTS[spot];
  // Кішкене кездейсоқ ығысу — белгіні дәл бір жерден кесіп тастау қиынырақ болады
  const [jitter] = useState(() => ({ x: Math.random() * 4 - 2, y: Math.random() * 4 - 2 }));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 max-w-[45%] transition-opacity duration-500 select-none"
      style={{ top: `${top + jitter.y}%`, left: `${left + jitter.x}%`, opacity: visible ? 1 : 0 }}
    >
      <div className="rounded-md px-2 py-1 font-sans text-[11px] leading-tight font-semibold text-white/35 [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] sm:text-sm">
        <div className="truncate">{name}</div>
        <div className="truncate">{email}</div>
      </div>
    </div>
  );
}
