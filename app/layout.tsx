import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Maestro",
  description: "Backlog をベースにした個人タスク統合管理",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <header className="app-header">
          <Link href="/" className="brand">
            Task Maestro
          </Link>
          <nav className="nav">
            <Link href="/">ダッシュボード</Link>
            <Link href="/issues">チケット一覧</Link>
            <Link href="/settings">設定</Link>
          </nav>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
