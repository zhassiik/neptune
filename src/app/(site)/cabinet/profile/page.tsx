import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, PhoneCall, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { ProfileForm } from "@/components/cabinet/ProfileForm";

export const metadata: Metadata = { title: "Менің профилім" };

function safeNext(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/cabinet/profile") ? value : undefined;
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ complete?: string; next?: string }> }) {
  const params = await searchParams;
  const user = await requireUser("/cabinet/profile");
  const profile = user.profile;
  const isStudent = (profile?.role ?? "student") === "student";
  const complete = params.complete === "1";

  return (
    <div className="bg-slate-50/60">
      <div className="container-page max-w-3xl py-8 sm:py-12">
        {!complete && (
          <Link href="/cabinet" className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-slate-500 transition hover:text-brand-600">
            <ChevronLeft className="size-4" /> Менің нәтижелерім
          </Link>
        )}

        <div className="mt-4 flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-neptune-500 text-white shadow-glow">
            <UserRound className="size-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{complete ? "Профильді толтырыңыз" : "Менің профилім"}</h1>
            <p className="mt-1 text-slate-500">{complete ? "Оқуды жалғастыру үшін бір рет қана толтырасыз." : "Аты-жөніңіз бен байланыс нөмірлерін өзгерте аласыз."}</p>
          </div>
        </div>

        {complete && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-navy-800">
            <PhoneCall className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <p>
              <b>Телефон нөміріңізді және ата-анаңыздың нөмірін</b> енгізіңіз. Куратор қажет болғанда сізбен және ата-анаңызбен байланыса алады.
            </p>
          </div>
        )}

        <div className="card mt-6 p-5 sm:p-8">
          <ProfileForm
            profile={{ full_name: profile?.full_name ?? "", phone: formatPhone(profile?.phone), parent_phone: formatPhone(profile?.parent_phone) }}
            email={user.email ?? profile?.email ?? ""}
            required={isStudent}
            complete={complete}
            next={safeNext(params.next)}
          />
        </div>
      </div>
    </div>
  );
}
