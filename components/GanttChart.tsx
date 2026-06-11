// components/GanttChart.tsx
"use client";

import { GANTT_DAYS, TODAY_COL } from "@/lib/services/ganttService";
import type { GanttModel, GanttRow } from "@/lib/types/gantt";

/** YYYY-MM-DD → "M/D" */
function shortDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

/** 0=日, 6=土 を返す（UTC 0 時基準で判定） */
function weekday(d: string): number {
  return new Date(`${d}T00:00:00Z`).getUTCDay();
}

function Bar({ row }: { row: GanttRow }) {
  if (row.barState === "none") return null;
  return (
    <div
      className={`gantt-bar gantt-bar--${row.barState}`}
      style={{ gridColumn: `${row.startCol} / span ${row.span}` }}
      title={
        row.barState === "overdue"
          ? `期限 ${row.dueDate}（${row.daysOverdue}日超過）`
          : `期限 ${row.dueDate}`
      }
    >
      {row.clipLeft && <span className="gantt-clip gantt-clip--left">◂</span>}
      <span className="gantt-bar-label">
        {row.barState === "overdue" ? `${row.daysOverdue}日超過` : ""}
      </span>
      {row.clipRight && <span className="gantt-clip gantt-clip--right">▸</span>}
    </div>
  );
}

export function GanttChart({ model }: { model: GanttModel }) {
  const hasRows = model.groups.length > 0;
  const gridTemplate = `repeat(${GANTT_DAYS}, minmax(28px, 1fr))`;

  return (
    <div className="gantt">
      {/* 横軸ヘッダー */}
      <div className="gantt-row gantt-row--header">
        <div className="gantt-label gantt-label--header" />
        <div className="gantt-timeline" style={{ gridTemplateColumns: gridTemplate }}>
          {model.days.map((d, i) => {
            const wd = weekday(d);
            const isToday = i === TODAY_COL - 1;
            const isPast = i < TODAY_COL - 1;
            const cls = [
              "gantt-day",
              isToday ? "gantt-day--today" : "",
              isPast ? "gantt-day--past" : "",
              wd === 0 || wd === 6 ? "gantt-day--weekend" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={d} className={cls}>
                {shortDate(d)}
              </div>
            );
          })}
        </div>
      </div>

      {/* グループ + 行 */}
      {!hasRows && <p className="gantt-empty">表示できる予定がありません。</p>}
      {model.groups.map((group) => (
        <div key={group.groupName} className="gantt-group">
          <div className="gantt-group-head">▸ {group.groupName}</div>
          {group.rows.map((row) => (
            <div key={row.id} className="gantt-row">
              <div className="gantt-label" title={row.title}>
                {row.key && <span className="gantt-key">{row.key}</span>}
                <span className="gantt-title">{row.title}</span>
              </div>
              <div className="gantt-timeline" style={{ gridTemplateColumns: gridTemplate }}>
                <Bar row={row} />
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* 期限未設定リスト */}
      {model.undated.length > 0 && (
        <div className="gantt-undated">
          <div className="gantt-undated-head">⚠ 期限未設定</div>
          <ul>
            {model.undated.map((row) => (
              <li key={row.id}>
                {row.key && <span className="gantt-key">{row.key}</span>}
                <span className="gantt-title">{row.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
