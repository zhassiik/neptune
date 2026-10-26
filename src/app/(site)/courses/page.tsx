import type { Metadata } from "next";
import { CourseGrid } from "@/components/courses/CourseGrid";

export const metadata: Metadata = { title: "Курстар" };
export const dynamic = "force-dynamic";

export default function CoursesPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold sm:text-5xl">Курстар</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-500">ҰБТ математикасына дайындыққа арналған курстар.</p>
      <div className="mt-10">
        <CourseGrid />
      </div>
    </div>
  );
}
