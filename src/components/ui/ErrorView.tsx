"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "./Button";

export function ErrorView({ error, reset, homeHref = "/" }: { error: Error & { digest?: string }; reset: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error.message && !error.digest ? error.message : "Күтпеген қате пайда болды. Қайталап көріңіз.";

  return (
    <div className="container-page grid place-items-center py-20">
      <div className="card w-full max-w-lg p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <TriangleAlert className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Бірдеңе дұрыс болмады</h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={reset}>
            <RefreshCw className="size-4" /> Қайталау
          </Button>
          <ButtonLink href={homeHref} variant="outline">
            Басты бетке
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
