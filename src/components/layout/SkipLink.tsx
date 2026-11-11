/** Клавиатурамен жүретіндерге: Tab басқанда пайда болады, мәзірді аттап мазмұнға өтеді */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-xl bg-white px-4 py-3 font-semibold text-navy-900 shadow-lift focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1100]"
    >
      Мазмұнға өту
    </a>
  );
}
