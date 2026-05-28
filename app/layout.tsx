import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Maestro",
  description: "Backlog をベースにした個人タスク統合管理",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <header className="app-header">
          <Link href="/" className="brand" aria-label="Task Maestro ホーム">
            <Image
              src="/logo.png"
              alt="Task Maestro"
              width={140}
              height={36}
              priority
              className="brand-logo"
            />
          </Link>
          <nav className="nav">
            <Link href="/">ダッシュボード</Link>
            <Link href="/issues">チケット一覧</Link>
            <Link href="/manual">マニュアル</Link>
            <Link href="/settings">設定</Link>
          </nav>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
