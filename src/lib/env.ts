export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase баптаулары табылмады. .env.local файлында NEXT_PUBLIC_SUPABASE_URL және NEXT_PUBLIC_SUPABASE_ANON_KEY көрсетіңіз (README қараңыз).",
    );
  }
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * SUPABASE_SERVICE_ROLE_KEY дұрыс кілт пе? Қате болса — түсінікті себебін қайтарады.
 * Жарамды: жаңа «sb_secret_...» кілті немесе role=service_role JWT.
 */
export function serviceKeyProblem(key: string | undefined): string | null {
  const hint = "Supabase → Project Settings → API Keys бөліміндегі secret (service_role) кілтін .env.local ішіндегі SUPABASE_SERVICE_ROLE_KEY-ге қойып, серверді қайта іске қосыңыз.";
  if (!key) return `SUPABASE_SERVICE_ROLE_KEY орнатылмаған. ${hint}`;
  if (key.startsWith("sb_secret_")) return null;
  if (key.startsWith("sb_publishable_")) return `SUPABASE_SERVICE_ROLE_KEY ішінде publishable кілт тұр — secret кілт керек. ${hint}`;
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
      if (payload.role === "service_role") return null;
      return `SUPABASE_SERVICE_ROLE_KEY ішінде «${payload.role ?? "белгісіз"}» кілті тұр — service_role кілті керек. ${hint}`;
    } catch {
      /* төменде */
    }
  }
  return `SUPABASE_SERVICE_ROLE_KEY жарамсыз (үлгі мән қалып қойған сияқты). ${hint}`;
}
