import type { AnswerResult, QuestionType } from "@/lib/scoring";

export type UserRole = "student" | "admin";
export type VariantStatus = "draft" | "published";
export type AttemptStatus = "in_progress" | "submitted";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  created_at: string;
}

export interface PlatformSettings {
  platform_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
}

export type CourseStatus = "draft" | "coming_soon" | "published";

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_path: string | null;
  price: number | null;
  status: CourseStatus;
  /** open — барлық тіркелген оқушыларға; enrolled — тек рұқсат берілгендерге */
  access_mode: "open" | "enrolled";
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TestVariant {
  id: string;
  course_id: string;
  position: number;
  video_url: string | null;
  video_duration_minutes: number | null;
  /** url — video_url (YouTube/Vimeo/...); cloudflare — қорғалған Cloudflare Stream */
  video_provider: "url" | "cloudflare";
  cloudflare_video_uid: string | null;
  video_status: string | null;
  title: string;
  subject: string;
  description: string | null;
  status: VariantStatus;
  time_limit_minutes: number | null;
  show_correct_answers: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestAttempt {
  id: string;
  variant_id: string;
  student_id: string;
  status: AttemptStatus;
  started_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  total_score: number | null;
  max_score: number;
  correct_count: number | null;
  partial_count: number | null;
  incorrect_count: number | null;
  unanswered_count: number | null;
}

/* ---------- Оқушыға берілетін (дұрыс жауапсыз) сұрақ құрылымы ---------- */

export interface PublicOption {
  id: string;
  text: string;
}

export interface PublicQuestion {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string | null;
  imageUrl: string | null;
  options: PublicOption[]; // single / multiple
  matchingItems: { id: string; label: "A" | "B"; text: string }[];
  matchingOptions: PublicOption[];
}

/** Клиенттегі жауап форматы */
export interface ClientAnswer {
  selected?: string[];
  matching?: Record<string, string>;
}

export type AnswersMap = Record<string, ClientAnswer>;

/* ---------- Нәтиже беті ---------- */

export interface ReviewQuestion extends PublicQuestion {
  points: number;
  maxPoints: number;
  result: AnswerResult;
  studentSelected: string[];
  studentMatching: Record<string, string>;
  /** show_correct_answers=false болса null */
  correctOptionIds: string[] | null;
  correctMatching: Record<string, string | null> | null;
  explanation: string | null;
}
