import { listLocalIssues } from "@/lib/services/backlogIssueService";
import { SyncButton } from "@/components/SyncButton";
import { CreateTicketLauncher } from "@/components/CreateTicketLauncher";
import { IssueListClient } from "@/components/IssueListClient";
import { getAppSettings } from "@/lib/db/settingsRepository";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issues = listLocalIssues();
  const settings = getAppSettings();

  return (
    <div>
      <div className="page-header">
        <h1>チケット一覧</h1>
        <div className="page-actions">
          <CreateTicketLauncher projects={settings.backlog.projects} />
          <SyncButton />
        </div>
      </div>
      <IssueListClient issues={issues} />
    </div>
  );
}
