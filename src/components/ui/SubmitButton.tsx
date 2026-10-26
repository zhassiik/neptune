"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

/** Server action формасындағы батырма: жіберу кезінде автоматты түрде loading күйі. */
export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
