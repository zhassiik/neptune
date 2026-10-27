import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { attachDeviceToSession } from "@/lib/devices/server";

/** Email растау / OAuth сілтемесінен кейін сессия құру (+ құрылғыны тіркеу) */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/cabinet";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/cabinet";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      const device = await attachDeviceToSession(data.session.user.id, data.session.access_token);
      if (!device.ok) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(`${origin}/login?error=limit_reached`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
