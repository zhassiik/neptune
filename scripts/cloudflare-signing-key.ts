/**
 * Cloudflare Stream signing key жасау: npm run cf:signing-key
 * Талап: .env.local ішінде CLOUDFLARE_ACCOUNT_ID және CLOUDFLARE_API_TOKEN.
 * Signing key-ді Cloudflare Dashboard-та жасау мүмкін емес — тек API арқылы.
 * Нәтижені .env.local-ға қойыңыз. Кілтті ешкімге жібермеңіз.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    console.error("✗ .env.local ішінде CLOUDFLARE_ACCOUNT_ID және CLOUDFLARE_API_TOKEN болуы керек");
    process.exit(1);
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: { message: string }[];
    result?: { id: string; pem: string };
  } | null;

  if (!res.ok || !body?.success || !body.result) {
    console.error("✗ Cloudflare қатесі:", body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`);
    console.error("  API token-да «Stream: Edit» рұқсаты бар екенін тексеріңіз.");
    process.exit(1);
  }

  console.log("\n✓ Signing key жасалды. Мына екі жолды .env.local файлына қойыңыз:\n");
  console.log(`CLOUDFLARE_STREAM_SIGNING_KEY_ID=${body.result.id}`);
  console.log(`CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY=${body.result.pem}`);
  console.log("\nСодан кейін серверді қайта іске қосыңыз (Ctrl+C → npm run dev).\n");
}

main();
