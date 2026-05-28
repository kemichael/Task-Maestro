import { getEnvStatus } from "@/lib/env";
import { getAppSettings } from "@/lib/db/settingsRepository";
import { getTodayList } from "@/lib/services/todayService";
import { TodayList } from "@/components/TodayList";
import { CalendarPane } from "@/components/CalendarPane";
import { SyncButton } from "@/components/SyncButton";
import { CreateTicketLauncher } from "@/components/CreateTicketLauncher";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const envStatuses = getEnvStatus();
  const missingRequired = envStatuses.filter((s) => s.required && s.status !== "ok");
  const settings = getAppSettings();

  if (missingRequired.length > 0) {
    return (
      <div>
        <h1>ダッシュボード</h1>
        <div className="error-banner">
          必須の環境変数が未設定です: {missingRequired.map((s) => s.key).join(", ")}
          <br />
          <Link href="/settings">設定画面</Link> で詳細を確認し、`.env.local` を編集してください。
        </div>
      </div>
    );
  }

  const today = getTodayList();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>今日のタスク</h1>
        <div className="dashboard-actions">
          <CreateTicketLauncher projects={settings.backlog.projects} />
          <SyncButton />
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-left">
          <h2>今日やる</h2>
          <TodayList issues={today} />
        </section>
        <section className="dashboard-right">
          <h2>カレンダー</h2>
          <CalendarPane />
        </section>
      </div>
    </div>
  );
}
