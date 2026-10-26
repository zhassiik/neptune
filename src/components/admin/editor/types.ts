import type { QuestionType } from "@/lib/scoring";

export interface EditorQuestion {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  explanation: string | null;
  updatedAt: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  matchingOptions: { id: string; text: string }[];
  matchingItems: { label: "A" | "B"; text: string; correctOptionId: string | null }[];
  issue: string | null;
}
