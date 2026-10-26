import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAnswersSchema } from "@/lib/attempts/validation";
import { AttemptError, buildAnswerRows, getOwnAttempt, isPastDeadline, loadQuestionMeta } from "@/lib/attempts/server";

/** Оқушы жауаптарын автоматты сақтау (бірнеше жауап бір сұраныспен) */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });

    const body = saveAnswersSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Сұраныс форматы дұрыс емес" }, { status: 400 });

    const admin = createAdminClient();
    const attempt = await getOwnAttempt(admin, attemptId, user.id);
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Тест аяқталған", code: "submitted" }, { status: 409 });
    }
    if (isPastDeadline(attempt)) {
      return NextResponse.json({ error: "Уақыт аяқталды", code: "deadline" }, { status: 409 });
    }

    const meta = await loadQuestionMeta(admin, attempt.variant_id);
    const rows = buildAnswerRows(attempt.id, body.data.answers, meta);

    if (rows.length > 0) {
      // Пайдаланушы клиенті арқылы жазамыз — RLS иелікті және мерзімді қосымша тексереді
      const { error } = await supabase.from("student_answers").upsert(rows, { onConflict: "attempt_id,question_id" });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, saved: rows.length, savedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof AttemptError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[answers] save failed", err);
    return NextResponse.json({ error: "Жауаптарды сақтау мүмкін болмады" }, { status: 500 });
  }
}
