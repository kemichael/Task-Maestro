import { getEnvStatus } from "@/lib/env";
import { getAppSettings } from "@/lib/db/settingsRepository";
import { getTodayList } from "@/lib/services/todayService";
import { listLocalIssuesByIds } from "@/lib/services/backlogIssueService";
import { getLocalTasksForToday } from "@/lib/services/localTaskService";
import { TodayList } from "@/components/TodayList";
import { LocalTaskList } from "@/components/LocalTaskList";
import { CalendarPane } from "@/components/CalendarPane";
import { SyncButton } from "@/components/SyncButton";
import { CreateTicketLauncher } from "@/components/CreateTicketLauncher";
import type { BacklogIssueRef } from "@/lib/types/backlog";
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
  const localTasks = getLocalTasksForToday();

  const parentIds = Array.from(
    new Set(today.map((i) => i.parentIssueId).filter((id): id is number => !!id)),
  );
  const parentIssues = parentIds.length > 0 ? listLocalIssuesByIds(parentIds) : [];
  const parentMap: Record<number, BacklogIssueRef & { issueKey: string }> = {};
  for (const p of parentIssues) {
    parentMap[p.id] = { id: p.id, name: p.summary, issueKey: p.issueKey };
  }

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
          <span className="cyber-label" style={{ display: "block", marginBottom: 4 }}>{"DAILY OPS →"}</span>
          <h2>今日やる</h2>
          <LocalTaskList tasks={localTasks} />
          <TodayList issues={today} projects={settings.backlog.projects} parentMap={parentMap} />
        </section>
        <section className="dashboard-right">
          <span className="cyber-label" style={{ display: "block", marginBottom: 4 }}>{"CALENDAR →"}</span>
          <h2>カレンダー</h2>
          <CalendarPane />
        </section>
      </div>
    </div>
  );
}
