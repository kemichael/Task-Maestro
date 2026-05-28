import "server-only";
import { getDb } from "./connection";
import { DatabaseError } from "../errors";
import type { UserIdentity, UserIdentityService } from "../types/settings";

interface UserIdentityRow {
  service: UserIdentityService;
  identifier: string;
  display_name: string | null;
}

function toUserIdentity(row: UserIdentityRow): UserIdentity {
  return {
    service: row.service,
    identifier: row.identifier,
    displayName: row.display_name ?? undefined,
  };
}

export function listIdentities(): UserIdentity[] {
  try {
    const db = getDb();
    const rows = db
      .prepare<[], UserIdentityRow>(
        "SELECT service, identifier, display_name FROM user_identity ORDER BY service, identifier",
      )
      .all();
    return rows.map(toUserIdentity);
  } catch (error) {
    throw new DatabaseError("利用者識別の取得に失敗", error);
  }
}

export function upsertIdentity(identity: UserIdentity): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO user_identity (service, identifier, display_name)
       VALUES (?, ?, ?)
       ON CONFLICT(service, identifier) DO UPDATE SET display_name = excluded.display_name`,
    ).run(identity.service, identity.identifier, identity.displayName ?? null);
  } catch (error) {
    throw new DatabaseError("利用者識別の保存に失敗", error);
  }
}

export function deleteIdentity(service: UserIdentityService, identifier: string): void {
  try {
    const db = getDb();
    db.prepare("DELETE FROM user_identity WHERE service = ? AND identifier = ?").run(
      service,
      identifier,
    );
  } catch (error) {
    throw new DatabaseError("利用者識別の削除に失敗", error);
  }
}
