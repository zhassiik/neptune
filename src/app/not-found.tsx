import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <SearchX className="size-8" />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">Бет табылмады</h1>
        <p className="mt-2 text-slate-500">Сіз іздеген бет жоқ немесе оған рұқсатыңыз жоқ.</p>
        <ButtonLink href="/" className="mt-6">
          Басты бетке қайту
        </ButtonLink>
      </div>
    </div>
  );
}
