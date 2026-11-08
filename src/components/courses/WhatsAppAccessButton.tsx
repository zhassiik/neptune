import { WhatsAppIcon } from "@/components/landing/SocialIcons";
import { cn } from "@/lib/utils";

/** «WhatsApp арқылы жазу» — курсқа рұқсат сұрау (сілтеме Баптаулардағы WhatsApp нөмірінен құралады) */
export function WhatsAppAccessButton({ href, className, label = "WhatsApp арқылы жазу" }: { href: string; className?: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-[#1ebe5a] active:scale-[0.98]",
        className,
      )}
    >
      <WhatsAppIcon className="size-5" /> {label}
    </a>
  );
}
