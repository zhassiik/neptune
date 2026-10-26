"use client";

import { ErrorView } from "@/components/ui/ErrorView";

export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} homeHref="/admin" />;
}
