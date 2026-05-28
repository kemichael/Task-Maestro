import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <h1>Task Maestro へようこそ</h1>
      <p>セットアップが完了したら、ここにダッシュボード (BD-104) が表示されます。</p>
      <p>
        まずは <Link href="/settings">設定画面</Link> で各 API 認証情報の状況を確認してください。
      </p>
    </div>
  );
}
