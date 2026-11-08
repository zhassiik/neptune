import type { Metadata } from "next";
import { UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { CuratorAddForm, CuratorRow, InviteRow } from "@/components/admin/CuratorForms";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Кураторлар" };

export default async function AdminCuratorsPage() {
  const supabase = await createClient();
  const [{ data: courses }, { data: curators, error }, { data: links }, { data: invites }] = await Promise.all([
    supabase.from("courses").select("id, title").order("position"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "curator").order("full_name"),
    supabase.from("course_curators").select("course_id, curator_id"),
    supabase.from("curator_invites").select("email, course_ids").order("created_at", { ascending: false }),
  ]);

  const byCurator = new Map<string, string[]>();
  for (const l of links ?? []) byCurator.set(l.curator_id, [...(byCurator.get(l.curator_id) ?? []), l.course_id]);
  const courseOptions = courses ?? [];

  return (
    <>
      <PageHeader title="Кураторлар" description="Куратор өзіне бекітілген курстардағы оқушылардың нәтижелерін көреді және черновик/конспектке белгі қояды" />
      {error ? (
        <Alert tone="error">Кураторлар кестесі табылмады: Supabase SQL Editor-да 20261112000001_curators.sql migration-ын іске қосыңыз.</Alert>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            {(curators ?? []).length === 0 && (invites ?? []).length === 0 ? (
              <EmptyState icon={UserCheck} title="Әзірге куратор жоқ" description="Оң жақтағы формамен куратордың gmail-ын енгізіп, курсын белгілеңіз." />
            ) : (
              <>
                {(curators ?? []).length > 0 && (
                  <ul className="card divide-y divide-slate-100 overflow-hidden">
                    {curators!.map((c) => (
                      <CuratorRow key={c.id} curator={{ id: c.id, name: c.full_name || c.email || "Куратор", email: c.email, courseIds: byCurator.get(c.id) ?? [] }} courses={courseOptions} />
                    ))}
                  </ul>
                )}
                {(invites ?? []).length > 0 && (
                  <section>
                    <h2 className="mb-2 text-sm font-semibold text-slate-500 uppercase">Тіркелуін күтіп тұрған шақырулар</h2>
                    <ul className="card divide-y divide-slate-100 overflow-hidden">
                      {invites!.map((i) => (
                        <InviteRow key={i.email} invite={{ email: i.email, courseIds: (i.course_ids as string[]) ?? [] }} courses={courseOptions} />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
          <CuratorAddForm courses={courseOptions} />
        </div>
      )}
    </>
  );
}
