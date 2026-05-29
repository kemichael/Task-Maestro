"use client";

import { useRouter } from "next/navigation";
import {
  DONE_SCOPES,
  DONE_SCOPE_LABEL,
  type KanbanDoneScope,
  type KanbanFilterMode,
} from "@/lib/types/kanban";

interface Props {
  mode: KanbanFilterMode;
  current: KanbanDoneScope;
}

export function DoneScopeSelect({ mode, current }: Props) {
  const router = useRouter();
  return (
    <label className="kanban-done-scope">
      <span>完了列:</span>
      <select
        value={current}
        onChange={(e) => {
          const next = e.target.value as KanbanDoneScope;
          router.push(`/kanban?mode=${mode}&doneScope=${next}`);
        }}
      >
        {DONE_SCOPES.map((s) => (
          <option key={s} value={s}>
            {DONE_SCOPE_LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
