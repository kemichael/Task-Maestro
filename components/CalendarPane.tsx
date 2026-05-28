"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventChangeArg,
  EventClickArg,
  EventInput,
  EventReceiveArg,
} from "@fullcalendar/core";

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

  // FullCalendar の Draggable を初期化 (document.body を監視して .today-item / .issue-card を D&D 可能化)
  useEffect(() => {
    const draggable = new Draggable(document.body, {
      itemSelector: ".today-item, .issue-card",
      eventData: (eventEl) => {
        const el = eventEl as HTMLElement;
        const id = el.dataset.issueId ?? "";
        const issueKey = el.dataset.issueKey ?? "";
        const summary = el.dataset.issueSummary ?? "";
        return {
          title: `${issueKey}: ${summary}`,
          duration: "01:00",
          extendedProps: { issueId: Number(id), issueKey, summary },
        };
      },
    });
    return () => draggable.destroy();
  }, []);

  // 外部からドロップされたチケットを Google カレンダー予定として作成
  const handleEventReceive = useCallback(async (arg: EventReceiveArg) => {
    setError(null);
    const issueKey = String(arg.event.extendedProps.issueKey ?? "");
    const summary = String(arg.event.extendedProps.summary ?? "");
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !issueKey) {
      arg.event.remove();
      setError("ドラッグデータの読み取りに失敗しました");
      return;
    }
    try {
      const res = await fetch("/api/google/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${issueKey}: ${summary}`,
          start: start.toISOString(),
          end: end?.toISOString(),
          issueKey,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `予定作成失敗 (${res.status})`);
      }
      // 仮のローカルイベントを削除し、サーバ取得で正規イベントに置き換える
      arg.event.remove();
      calendarRef.current?.getApi().refetchEvents();
    } catch (e) {
      arg.event.remove();
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
        eventReceive={handleEventReceive}
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
