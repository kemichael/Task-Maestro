import { getAppSettings } from "@/lib/db/settingsRepository";
import { getEnvStatus } from "@/lib/env";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = getAppSettings();
  const envStatuses = getEnvStatus();

  return (
    <div>
      <h1>設定</h1>

      <section>
        <h2>認証情報 (.env.local)</h2>
        <p className="hint">
          このセクションは表示専用。値は `.env.local` を直接編集してください (シークレットは平文保存のため `.gitignore` 必須)。
        </p>
        <table className="env-table">
          <thead>
            <tr>
              <th>キー</th>
              <th>必須</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {envStatuses.map((e) => (
              <tr key={e.key}>
                <td>
                  <code>{e.key}</code>
                </td>
                <td>{e.required ? "必須" : "任意"}</td>
                <td>
                  {e.status === "ok" ? (
                    <span className="status-ok">設定済み</span>
                  ) : (
                    <span className="status-missing">未設定</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>アプリ設定</h2>
        <SettingsForm initial={settings} />
      </section>
    </div>
  );
}
