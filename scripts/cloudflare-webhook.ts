/**
 * Cloudflare Stream webhook тіркеу: npm run cf:webhook -- https://сайт-домені
 * Талап: .env.local ішінде CLOUDFLARE_ACCOUNT_ID және CLOUDFLARE_API_TOKEN (Stream: Edit).
 * Cloudflare бір аккаунтқа тек БІР webhook рұқсат етеді — production доменін көрсетіңіз.
 * Шыққан секретті Vercel-ге CLOUDFLARE_STREAM_WEBHOOK_SECRET ретінде қойыңыз. Ешкімге жібермеңіз.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = (process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN)?.trim();
  if (!accountId || !token) {
    console.error("✗ .env.local ішінде CLOUDFLARE_ACCOUNT_ID және CLOUDFLARE_API_TOKEN болуы керек");
    process.exit(1);
  }

  const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^/]+/.test(base)) {
    console.error("✗ Сайттың https мекенжайын көрсетіңіз: npm run cf:webhook -- https://neptune-pink-three.vercel.app");
    console.error("  (localhost жарамайды — Cloudflare оған жете алмайды)");
    process.exit(1);
  }
  const notificationUrl = `${base}/api/webhooks/cloudflare-stream`;

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/webhook`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ notificationUrl }),
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: { message: string }[];
    result?: { notificationUrl: string; secret: string };
  } | null;

  if (!res.ok || !body?.success || !body.result?.secret) {
    console.error("✗ Cloudflare қатесі:", body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`);
    console.error("  API token-да «Stream: Edit» рұқсаты бар екенін тексеріңіз.");
    process.exit(1);
  }

  console.log(`\n✓ Webhook тіркелді: ${body.result.notificationUrl}\n`);
  console.log("Мына жолды Vercel → Settings → Environment Variables-қа қосыңыз (және .env.local-ға):\n");
  console.log(`CLOUDFLARE_STREAM_WEBHOOK_SECRET=${body.result.secret}`);
  console.log("\nСодан кейін Vercel-де Redeploy жасаңыз.\n");
}

main();
