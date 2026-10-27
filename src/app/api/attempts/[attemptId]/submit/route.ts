import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAnswersSchema } from "@/lib/attempts/validation";
import { AttemptError, getOwnAttempt, submitAttempt } from "@/lib/attempts/server";

/** Тестті аяқтау. Балл тек осы жерде (серверде) есептеледі. */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  try {
    // getCurrentUser: аккаунт + белсенді, бұғатталмаған құрылғы тексерісі
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Сессия жарамсыз. Қайта кіріңіз", code: "session" }, { status: 401 });

    const body = saveAnswersSchema.safeParse((await request.json().catch(() => null)) ?? { answers: [] });
    if (!body.success) return NextResponse.json({ error: "Сұраныс форматы дұрыс емес" }, { status: 400 });

    const admin = createAdminClient();
    const attempt = await getOwnAttempt(admin, attemptId, user.id);
    await submitAttempt(admin, attempt, body.data.answers);

    revalidatePath("/cabinet");
    revalidatePath("/courses", "layout");
    return NextResponse.json({ ok: true, redirect: `/results/${attempt.id}` });
  } catch (err) {
    if (err instanceof AttemptError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[submit] failed", err);
    return NextResponse.json({ error: "Тестті аяқтау мүмкін болмады. Қайталап көріңіз" }, { status: 500 });
  }
}
