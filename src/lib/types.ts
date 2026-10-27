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

export interface LandingStat {
  value: string;
  label: string;
}

export interface PlatformSettings {
  platform_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  teacher_name: string;
  /** Әр жол — бір пункт */
  teacher_bio: string;
  landing_stats: LandingStat[];
  exam_countdown_title: string;
  exam_date: string | null;
  instagram_url: string | null;
  telegram_url: string | null;
  whatsapp_phone: string | null;
  /** «Курсқа қосылу» батырмасының сілтемесі (WhatsApp т.б.) */
  join_url: string | null;
}

export interface Testimonial {
  id: string;
  student_name: string;
  score: number | null;
  score_label: string | null;
  text: string;
  photo_path: string | null;
  video_url: string | null;
  position: number;
  is_published: boolean;
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
  /** «Апта үздігі» (migration 20261031 болмаса — undefined) */
  week_id?: string | null;
  contest_starts_at?: string | null;
  contest_ends_at?: string | null;
  /** Черновик және конспект: Google Classroom сілтемесі және дедлайн */
  classroom_url?: string | null;
  homework_deadline?: string | null;
}

export interface ContestWeek {
  id: string;
  course_id: string;
  title: string;
  position: number;
  is_published: boolean;
}

export type HomeworkStatus = "on_time" | "late" | "missing";

export interface HomeworkCheck {
  variant_id: string;
  student_id: string;
  draft_status: HomeworkStatus | null;
  notes_status: HomeworkStatus | null;
}

export interface LeaderboardRow {
  rank: number;
  student_id: string | null;
  full_name: string;
  test_points: number;
  homework_points: number;
  total: number;
  contest_tests: number;
  is_me: boolean;
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
