"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DropArg } from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventChangeArg,
  EventClickArg,
  EventInput,
} from "@fullcalendar/core";

interface DraggedIssue {
  id: number;
  summary: string;
  issueKey: string;
}

async function fetchEvents(from: string, to: string): Promise<EventInput[]> {
  const res = await fetch(`/api/google/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!res.ok) {
    throw new Error(`カレンダー取得に失敗 (${res.status})`);
  }
  return (await res.json()) as EventInput[];
}

export function CalendarPane() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback(async (info: DropArg) => {
    setError(null);

    let issue: DraggedIssue | null = null;

    // 方法1: jsEvent.dataTransfer から取得 (HTML5 D&D)
    const dt = (info.jsEvent as DragEvent | undefined)?.dataTransfer;
    const raw = dt?.getData("application/x-tm-issue");
    if (raw) {
      try {
        issue = JSON.parse(raw) as DraggedIssue;
      } catch {
        /* fall through to method 2 */
      }
    }

    // 方法2: draggedEl の data-* 属性 fallback
    if (!issue && info.draggedEl) {
      const el = info.draggedEl as HTMLElement;
      const id = Number(el.dataset.issueId);
      if (Number.isFinite(id) && id > 0) {
        issue = {
          id,
          issueKey: el.dataset.issueKey ?? "",
          summary: el.dataset.issueSummary ?? "",
        };
      }
    }

    if (!issue || !issue.id) {
      setError(
        "ドラッグしたチケットの情報を読み取れませんでした。ページを再読み込みしてからもう一度お試しください。",
      );
      return;
    }

    try {
      const res = await fetch("/api/google/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${issue.issueKey}: ${issue.summary}`,
          start: info.date.toISOString(),
          issueKey: issue.issueKey,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `予定作成失敗 (${res.status})`);
      }
      calendarRef.current?.getApi().refetchEvents();
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const handleEventChange = useCallback(async (arg: EventChangeArg) => {
    setError(null);
    try {
      const res = await fetch(`/api/google/calendar/events/${arg.event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: arg.event.start?.toISOString(),
          end: arg.event.end?.toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`予定更新失敗 (${res.status})`);
    } catch (e) {
      setError((e as Error).message);
      arg.revert();
    }
  }, []);

  const handleEventClick = useCallback(async (arg: EventClickArg) => {
    if (!confirm(`「${arg.event.title}」を削除しますか？`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/google/calendar/events/${arg.event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`予定削除失敗 (${res.status})`);
      arg.event.remove();
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const handleSelect = useCallback(async (arg: DateSelectArg) => {
    const title = prompt("予定タイトル", "");
    if (!title) {
      arg.view.calendar.unselect();
      return;
    }
    try {
      const res = await fetch("/api/google/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          start: arg.start.toISOString(),
          end: arg.end.toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`予定作成失敗 (${res.status})`);
      arg.view.calendar.refetchEvents();
      arg.view.calendar.unselect();
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // 親側で drop ハンドラを attach できないため、FullCalendar の drop プロパティを利用
  }, []);

  return (
    <div className="calendar-pane">
      {error && <div className="error-banner">{error}</div>}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={async (info, success, failure) => {
          try {
            const events = await fetchEvents(info.start.toISOString(), info.end.toISOString());
            success(events);
          } catch (e) {
            setError((e as Error).message);
            failure(e as Error);
          }
        }}
        editable
        selectable
        droppable
        drop={handleDrop}
        eventChange={handleEventChange}
        eventClick={handleEventClick}
        select={handleSelect}
        height="80vh"
        locale="ja"
        firstDay={1}
        nowIndicator
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
      />
    </div>
  );
}
