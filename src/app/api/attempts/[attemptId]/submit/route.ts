import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAnswersSchema } from "@/lib/attempts/validation";
import { AttemptError, getOwnAttempt, submitAttempt } from "@/lib/attempts/server";

/** Тестті аяқтау. Балл тек осы жерде (серверде) есептеледі. */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });

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
