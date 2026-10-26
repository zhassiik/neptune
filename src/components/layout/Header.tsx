import { getCurrentUser } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";
import { HeaderNav } from "./HeaderNav";

export async function Header() {
  const [user, settings] = await Promise.all([getCurrentUser(), getPlatformSettings()]);
  return (
    <HeaderNav
      platformName={settings.platform_name}
      user={user ? { name: user.profile?.full_name || user.email || "Профиль", isAdmin: user.profile?.role === "admin" } : null}
    />
  );
}
