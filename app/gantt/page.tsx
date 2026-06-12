// app/gantt/page.tsx
import { getEnvStatus } from "@/lib/env";
import { getAppSettings } from "@/lib/db/settingsRepository";
import { listLocalIssues } from "@/lib/services/backlogIssueService";
import { getLocalTasksForToday } from "@/lib/services/localTaskService";
import { buildGanttRows } from "@/lib/services/ganttService";
import { GanttChart } from "@/components/GanttChart";
import { SyncButton } from "@/components/SyncButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GanttPage() {
  const envStatuses = getEnvStatus();
  const missingRequired = envStatuses.filter((s) => s.required && s.status !== "ok");

  if (missingRequired.length > 0) {
    return (
      <div>
        <h1>ガントチャート</h1>
        <div className="error-banner">
          必須の環境変数が未設定です: {missingRequired.map((s) => s.key).join(", ")}
          <br />
          <Link href="/settings">設定画面</Link> で詳細を確認し、`.env.local` を編集してください。
        </div>
      </div>
    );
  }

  const settings = getAppSettings();
  const issues = listLocalIssues();
  const localTasks = getLocalTasksForToday();
  const model = buildGanttRows(issues, localTasks, settings.backlog.projects);

  return (
    <div>
      <div className="page-header">
        <h1>ガントチャート</h1>
        <div className="page-actions">
          <SyncButton />
        </div>
      </div>
      <GanttChart model={model} />
    </div>
  );
}
