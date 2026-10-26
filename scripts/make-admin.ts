/**
 * Тіркелген пайдаланушыны әкімші ету: npm run make-admin -- teacher@mail.kz
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) {
  console.error("Қолданылуы: npm run make-admin -- email@example.kz");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("✗ .env.local ішінде NEXT_PUBLIC_SUPABASE_URL және SUPABASE_SERVICE_ROLE_KEY болуы керек");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase.from("profiles").update({ role: "admin" }).ilike("email", email).select("id, email, full_name");
  if (error) {
    console.error("✗ Қате:", error.message);
    process.exit(1);
  }
  if (!data?.length) {
    console.error(`✗ ${email} табылмады. Алдымен сайтта тіркеліңіз.`);
    process.exit(1);
  }
  console.log(`✓ ${data[0].full_name || data[0].email} енді әкімші.`);
}

main();
