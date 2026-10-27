import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE, deviceCookieOptions, isUuid, loginErrorForStatus, sessionIdFromAccessToken } from "@/lib/devices/config";
import { isMissingObject, registerDevice } from "@/lib/devices/register";

const PROTECTED_PREFIXES = ["/cabinet", "/test", "/results", "/admin", "/preview"];
const AUTH_PAGES = ["/login", "/register"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // ---- Құрылғы бақылауы (тек бет сұраныстары; API route-тар өздері тексереді) ----
  if (user && !pathname.startsWith("/api/") && !pathname.startsWith("/auth/")) {
    let deviceId = request.cookies.get(DEVICE_COOKIE)?.value;
    let newCookie = false;
    if (!isUuid(deviceId)) {
      deviceId = crypto.randomUUID();
      newCookie = true;
    }

    let status: string | null = null;
    const { data, error } = await supabase.rpc("check_device_session", { p_device_id: newCookie ? null : deviceId });
    if (error) {
      // Migration іске қосылмаса — бұрынғыдай жұмыс істейміз; басқа қатеде сервер тексерісі (getCurrentUser) шешеді
      if (!isMissingObject(error)) console.error("[devices] check_device_session:", error.message);
    } else {
      status = data as string;
    }

    // Тіркелмеген сессия (мысалы, жүйе қосылғанға дейін кірген) — лимит шегінде тіркейміз.
    // Cookie жоғалған, бірақ сессия басқа құрылғыда тіркелген болса — mismatch.
    if (status === "unregistered" || (status === "ok" && newCookie)) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionId = sessionIdFromAccessToken(session?.access_token);
      if (sessionId) {
        const reg = await registerDevice({ userId: user.id, sessionId, deviceId, headers: request.headers });
        status = reg.status === "error" ? (reg.notMigrated ? null : "error") : reg.status;
      }
    }

    if (status && status !== "ok" && status !== "error" && status !== "anonymous") {
      // Рұқсат жоқ: сессияны жабамыз және хабарламамен кіру бетіне жібереміз
      await supabase.auth.signOut({ scope: "local" });
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = `?error=${loginErrorForStatus(status)}`;
      const redirect = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }

    if (newCookie) {
      // Cookie осы сұраныстағы server component-терге де көрінуі үшін request-ке қосамыз
      request.cookies.set(DEVICE_COOKIE, deviceId);
      const carried = response.cookies.getAll();
      response = NextResponse.next({ request });
      carried.forEach((c) => response.cookies.set(c));
      response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
    }
    if (status === "error") user = null; // сенімді тексеру мүмкін болмады — қорғалған бетке жібермейміз
  }

  if (!user && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const home = request.nextUrl.clone();
    home.pathname = "/cabinet";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
