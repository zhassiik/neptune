import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE, isUuid, loginErrorForStatus } from "@/lib/devices/config";
import { isMissingObject, registerDevice } from "@/lib/devices/register";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/**
 * Ашық беттің сессия тексерісі (SessionGuard әр 60 секунд сайын шақырады).
 * Құрылғы өшірілсе/аккаунт бұғатталса — сессия жабылып, клиент кіру бетіне жіберіледі.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "anonymous" }, { headers: noStore });

  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value;
  let status: string;
  if (!isUuid(deviceId)) status = "mismatch";
  else {
    const { data, error } = await supabase.rpc("check_device_session", { p_device_id: deviceId });
    if (error) return NextResponse.json({ status: isMissingObject(error) ? "ok" : "error" }, { headers: noStore });
    status = data as string;
    if (status === "unregistered") {
      const { data: claims } = await supabase.auth.getClaims();
      const sid = claims?.claims?.session_id;
      if (typeof sid === "string") {
        const reg = await registerDevice({ userId: user.id, sessionId: sid, deviceId, headers: await headers() });
        status = reg.status === "error" ? "error" : reg.status;
      }
    }
  }

  if (status === "ok" || status === "error" || status === "anonymous") {
    return NextResponse.json({ status }, { headers: noStore });
  }
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ status, redirect: `/login?error=${loginErrorForStatus(status)}` }, { headers: noStore });
}
