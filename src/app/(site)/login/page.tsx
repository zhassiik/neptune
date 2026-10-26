import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Кіру" };

const notices: Record<string, string> = {
  confirm: "Email расталған болуы мүмкін — email мен құпиясөзіңізбен кіріп көріңіз. Кіре алмасаңыз, сілтеме ескірген: қайта тіркеліп, жаңа хатты сол браузерде ашыңыз.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Қош келдіңіз!"
      subtitle="Нұсқаларды орындау үшін аккаунтыңызға кіріңіз."
      footer={
        <>
          Аккаунтыңыз жоқ па?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
            Тіркелу
          </Link>
        </>
      }
    >
      <LoginForm next={next} notice={error ? notices[error] : undefined} />
    </AuthCard>
  );
}
