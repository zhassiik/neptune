/** Курсқа рұқсат ережесі (таза функция — серверде қолданылады, тестпен бекітілген) */

export type CourseAccessReason = "admin" | "open" | "enrolled" | "anonymous" | "not_published" | "not_enrolled";

export interface CourseAccess {
  allowed: boolean;
  reason: CourseAccessReason;
}

export function evaluateCourseAccess({
  loggedIn,
  isAdmin,
  course,
  enrolled,
}: {
  loggedIn: boolean;
  isAdmin: boolean;
  course: { status: string; access_mode: string };
  enrolled: boolean;
}): CourseAccess {
  if (isAdmin) return { allowed: true, reason: "admin" };
  if (!loggedIn) return { allowed: false, reason: "anonymous" };
  if (course.status !== "published") return { allowed: false, reason: "not_published" };
  if (course.access_mode !== "enrolled") return { allowed: true, reason: "open" };
  return enrolled ? { allowed: true, reason: "enrolled" } : { allowed: false, reason: "not_enrolled" };
}

export const ACCESS_DENIED_MESSAGE: Record<Exclude<CourseAccessReason, "admin" | "open" | "enrolled">, string> = {
  anonymous: "Алдымен жүйеге кіріңіз",
  not_published: "Курс әлі ашылмаған",
  not_enrolled: "Бұл курсқа рұқсатыңыз жоқ",
};
