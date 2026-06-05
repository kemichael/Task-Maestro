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
import { resolveEventColor } from "@/lib/constants/googleEventColors";
import type { CalendarEvent, GoogleEventColorId } from "@/lib/types/calendar";
import { EventEditModal } from "./EventEditModal";

async function fetchEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const res = await fetch(`/api/google/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!res.ok) {
    throw new Error(`カレンダー取得に失敗 (${res.status})`);
  }
  return (await res.json()) as CalendarEvent[];
}

export function CalendarPane() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // FullCalendar の Draggable を初期化 (document.body を監視して .today-item / .issue-card / .local-task-item を D&D 可能化)
  // インライン編集中のメモタスク (.local-task-item.is-editing) は、入力欄が onPointerDown の
  // preventDefault / preventSelection で編集不能になるのを避けるため除外する。
  useEffect(() => {
    const draggable = new Draggable(document.body, {
      itemSelector: ".today-item, .issue-card, .local-task-item:not(.is-editing)",
      eventData: (eventEl) => {
        const el = eventEl as HTMLElement;
        // ローカルメモタスクは issueKey を持たない
        if (el.classList.contains("local-task-item")) {
          const localId = el.dataset.localTaskId ?? "";
          const title = el.dataset.localTaskTitle ?? "";
          return {
            title: `📝 ${title}`,
            duration: "01:00",
            extendedProps: { localTaskId: Number(localId), summary: title },
          };
        }
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

  // 外部からドロップされたチケット / メモタスクを Google カレンダー予定として作成
  const handleEventReceive = useCallback(async (arg: EventReceiveArg) => {
    setError(null);
    const issueKey = String(arg.event.extendedProps.issueKey ?? "");
    const summary = String(arg.event.extendedProps.summary ?? "");
    const localTaskId = arg.event.extendedProps.localTaskId as number | undefined;
    const isLocal = !!localTaskId;
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || (!issueKey && !isLocal)) {
      arg.event.remove();
      setError("ドラッグデータの読み取りに失敗しました");
      return;
    }
    try {
      const title = isLocal ? `📝 ${summary}` : `${issueKey}: ${summary}`;
      const body: Record<string, unknown> = {
        title,
        start: start.toISOString(),
        end: end?.toISOString(),
      };
      if (issueKey) body.issueKey = issueKey;
      const res = await fetch("/api/google/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const ev = arg.event;
    const colorIdRaw = ev.extendedProps.colorId;
    const colorId =
      typeof colorIdRaw === "string" && /^([1-9]|1[01])$/.test(colorIdRaw)
        ? (colorIdRaw as GoogleEventColorId)
        : undefined;
    setEditingEvent({
      id: ev.id,
      title: ev.title,
      start: ev.start?.toISOString() ?? "",
      end: ev.end?.toISOString() ?? "",
      description: (ev.extendedProps.description as string | undefined) ?? undefined,
      htmlLink: (ev.extendedProps.htmlLink as string | undefined) ?? undefined,
      colorId,
    });
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
            const inputs: EventInput[] = events.map((e) => {
              const c = resolveEventColor(e.colorId);
              return {
                id: e.id,
                title: e.title,
                start: e.start,
                end: e.end,
                backgroundColor: c.background,
                borderColor: c.background,
                textColor: c.foreground,
                extendedProps: {
                  description: e.description,
                  htmlLink: e.htmlLink,
                  colorId: e.colorId,
                },
              };
            });
            success(inputs);
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
      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={() => {
            setEditingEvent(null);
            calendarRef.current?.getApi().refetchEvents();
          }}
          onDeleted={() => {
            setEditingEvent(null);
            calendarRef.current?.getApi().refetchEvents();
          }}
        />
      )}
    </div>
  );
}
