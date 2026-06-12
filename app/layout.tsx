import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Rajdhani, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-google",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-google",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-google",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Task Maestro",
  description: "Backlog をベースにした個人タスク統合管理",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ja"
      className={`${inter.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <header className="app-header">
          <Link href="/" className="brand" aria-label="Task Maestro ホーム">
            <Image
              src="/logo.png"
              alt="Task Maestro"
              width={228}
              height={64}
              priority
              className="brand-logo"
            />
          </Link>
          <span className="system-tag" aria-hidden="true">{"// SYSTEM ONLINE"}</span>
          <nav className="nav">
            <Link href="/">ダッシュボード</Link>
            <Link href="/kanban">カンバン</Link>
            <Link href="/gantt">ガント</Link>
            <Link href="/issues">チケット一覧</Link>
            <Link href="/documents">ドキュメント</Link>
            <Link href="/meetings">議事録</Link>
            <Link href="/manual">マニュアル</Link>
            <Link href="/settings">設定</Link>
          </nav>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
