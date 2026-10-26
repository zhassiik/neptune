import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

// cyrillic-ext — қазақ әріптері (ә, ғ, қ, ң, ө, ұ, ү, һ, і) үшін міндетті
const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Neptune UBT | Жазира Тұрғымбай — ҰБТ математикасына дайындық",
    template: "%s · Neptune UBT",
  },
  description: "Жазира Тұрғымбайдың авторлық ҰБТ математика нұсқалары: онлайн тапсырып, нәтижеңізді бірден біліңіз және видео-талдауын қараңыз.",
};

export const viewport: Viewport = {
  themeColor: "#2f7cf6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
