import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, serviceKeyProblem } from "@/lib/env";

/** Сервер баптауының қатесі (пайдаланушыға түсінікті мәтінмен) */
export class ServerConfigError extends Error {}

/**
 * service_role клиенті — RLS-ті айналып өтеді.
 * ТЕК серверде және пайдаланушы құқығы тексерілгеннен кейін ғана қолданыңыз.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const problem = serviceKeyProblem(serviceKey);
  if (problem) throw new ServerConfigError(problem);
  return createClient(url, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
