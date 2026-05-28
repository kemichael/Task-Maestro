import {
  listLocalIssues,
  listLocalIssuesByIds,
} from "@/lib/services/backlogIssueService";
import { SyncButton } from "@/components/SyncButton";
import { CreateTicketLauncher } from "@/components/CreateTicketLauncher";
import { IssueListClient } from "@/components/IssueListClient";
import { getAppSettings } from "@/lib/db/settingsRepository";
import type { BacklogIssueRef } from "@/lib/types/backlog";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issues = listLocalIssues();
  const settings = getAppSettings();

  // 親課題の lookup マップを作成 (自分担当外の親もキャッシュから引いて渡す)
  const parentIds = Array.from(
    new Set(issues.map((i) => i.parentIssueId).filter((id): id is number => !!id)),
  );
  const parentIssues = parentIds.length > 0 ? listLocalIssuesByIds(parentIds) : [];
  const parentMap: Record<number, BacklogIssueRef & { issueKey: string }> = {};
  for (const p of parentIssues) {
    parentMap[p.id] = { id: p.id, name: p.summary, issueKey: p.issueKey };
  }

  return (
    <div>
      <div className="page-header">
        <h1>チケット一覧</h1>
        <div className="page-actions">
          <CreateTicketLauncher projects={settings.backlog.projects} />
          <SyncButton />
        </div>
      </div>
      <IssueListClient issues={issues} parentMap={parentMap} />
    </div>
  );
}
