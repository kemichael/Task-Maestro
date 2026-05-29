import { getEnvStatus } from "@/lib/env";
import { getAppSettings } from "@/lib/db/settingsRepository";
import { getKanbanBoard } from "@/lib/services/kanbanService";
import {
  isDoneScope,
  type KanbanDoneScope,
  type KanbanFilterMode,
} from "@/lib/types/kanban";
import { KanbanBoard } from "@/components/KanbanBoard";
import { DoneScopeSelect } from "@/components/DoneScopeSelect";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mode?: string; doneScope?: string }>;
}

export default async function KanbanPage({ searchParams }: PageProps) {
  const envStatuses = getEnvStatus();
  const missingRequired = envStatuses.filter((s) => s.required && s.status !== "ok");

  if (missingRequired.length > 0) {
    return (
      <div>
        <h1>カンバン</h1>
        <div className="error-banner">
          必須の環境変数が未設定です: {missingRequired.map((s) => s.key).join(", ")}
          <br />
          <Link href="/settings">設定画面</Link> で詳細を確認し、`.env.local` を編集してください。
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const mode: KanbanFilterMode = params.mode === "assigned" ? "assigned" : "today";
  const doneScope: KanbanDoneScope = isDoneScope(params.doneScope) ? params.doneScope : "today";
  const board = getKanbanBoard(mode, doneScope);
  const settings = getAppSettings();

  return (
    <div className="kanban-page">
      <div className="dashboard-header">
        <h1>カンバン</h1>
        <div className="kanban-controls">
          <div className="kanban-mode-switch">
            <Link
              href={`/kanban?mode=today&doneScope=${doneScope}`}
              className={`mode-tab${mode === "today" ? " active" : ""}`}
            >
              今日
            </Link>
            <Link
              href={`/kanban?mode=assigned&doneScope=${doneScope}`}
              className={`mode-tab${mode === "assigned" ? " active" : ""}`}
            >
              担当全件
            </Link>
          </div>
          <DoneScopeSelect mode={mode} current={doneScope} />
        </div>
      </div>
      <KanbanBoard
        board={board}
        kanbanMappings={settings.kanban.projects}
      />
    </div>
  );
}
