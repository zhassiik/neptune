"use client";

import { useEffect } from "react";

const SELECTOR = "[data-anim-scope], .space-bg";

/**
 * Экраннан тыс тұрған безендіру анимацияларын тоқтатады (батарея мен процессорды үнемдейді):
 * ғарыш секциялары мен ғаламшарлардың ішіндегі CSS анимацияларын Web Animations API арқылы кідіртеді,
 * SVG <animateMotion> кометаларын да. Scroll-driven анимацияларға тиіспейді (олар экраннан тыс тұрмайды).
 */
export function AnimationScopes() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          // DOM атрибуттарын өзгертпейміз (React гидратациясымен қақтығыспау үшін) — Web Animations API арқылы кідіртеміз
          for (const a of el.getAnimations({ subtree: true })) {
            if (e.isIntersecting) {
              if (a.playState === "paused") a.play();
            } else if (a.playState === "running") a.pause();
          }
          el.querySelectorAll("svg").forEach((svg) => {
            if (!svg.querySelector("animate, animateMotion, animateTransform")) return;
            if (e.isIntersecting) svg.unpauseAnimations();
            else svg.pauseAnimations();
          });
        }
      },
      { rootMargin: "120px 0px" },
    );
    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    scan();
    // Беттер арасында жүргенде жаңа секциялар пайда болады
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mo = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      mo.disconnect();
      io.disconnect();
    };
  }, []);
  return null;
}
