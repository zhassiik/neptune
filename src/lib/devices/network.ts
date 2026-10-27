/** IP адрес және шамамен орналасу (Edge және Node ортасында жұмыс істейді) */

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]{2,39}$/i;

export function isValidIp(value: string | null | undefined): value is string {
  if (!value) return false;
  return IPV4.test(value) || (IPV6.test(value) && value.includes(":"));
}

/** Клиенттің IP-і: x-forwarded-for бірінші мәні (Vercel/прокси), x-real-ip */
export function clientIpFromHeaders(headers: Headers): string | null {
  const candidates = [headers.get("x-forwarded-for")?.split(",")[0], headers.get("x-real-ip"), headers.get("cf-connecting-ip")];
  for (const c of candidates) {
    const ip = c?.trim().replace(/^::ffff:/, "");
    if (isValidIp(ip)) return ip;
  }
  return null;
}

/** Интерфейсте IP толық көрсетілмейді: 192.168.0.107 → 192.168.0.*** ; 2001:db8:85a3::1 → 2001:db8:85a3:**** */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  const clean = ip.replace(/\/\d+$/, "");
  if (IPV4.test(clean)) return clean.split(".").slice(0, 3).join(".") + ".***";
  if (clean.includes(":")) return clean.split(":").filter(Boolean).slice(0, 3).join(":") + ":****";
  return "—";
}

/** Шамамен орналасу: тек хостинг берген сенімді header-лерден (Vercel, Cloudflare) */
export function locationFromHeaders(headers: Headers): string | null {
  const decode = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v);
    } catch {
      return "";
    }
  };
  const city = decode(headers.get("x-vercel-ip-city")).replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 40);
  const country = (headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || "").replace(/[^A-Z]/g, "").slice(0, 2);
  const parts = [city, country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
