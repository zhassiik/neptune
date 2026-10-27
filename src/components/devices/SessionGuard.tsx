"use client";

import { useEffect } from "react";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/devices/config";

/**
 * Heartbeat: әр минут сайын және бетке оралғанда сессияны тексереді.
 * Құрылғы өшірілген / аккаунт бұғатталған болса — 1–2 минут ішінде кіру бетіне жібереді.
 * (Деректерге қолжетімділікті RLS пен сервер бірден тоқтатады — бұл тек ашық тұрған бетті жабу үшін.)
 */
export function SessionGuard() {
  useEffect(() => {
    let last = 0;
    let stopped = false;
    const check = async () => {
      if (stopped || Date.now() - last < 15_000) return;
      last = Date.now();
      try {
        const res = await fetch("/api/session/heartbeat", { method: "POST", cache: "no-store" });
        const body = (await res.json()) as { status: string; redirect?: string };
        if (body.redirect) {
          stopped = true;
          window.location.assign(body.redirect);
        }
      } catch {
        /* желі қатесі — келесі жолы қайталанады */
      }
    };
    const id = setInterval(check, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
  return null;
}
