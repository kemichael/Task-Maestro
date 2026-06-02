"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkdownView } from "./MarkdownView";

interface Props {
  /** ポップアップに表示するメモ本文 (Markdown) */
  content: string;
  /**
   * クラスプレフィックス。
   * 例: "local-task-notes" → 包含要素は `local-task-notes-wrap`、
   * トリガ表示は `local-task-notes`、ポップアップは `local-task-notes-popup`
   */
  classPrefix: string;
}

/**
 * メモ本文のホバープレビュー。
 *
 * 親要素 (`.local-task-item` / `.local-tasks` 等) に `clip-path` や
 * `overflow: hidden` が指定されていると、`position: absolute` の
 * 通常レンダリングではポップアップが切り取られて見えなくなる。
 *
 * これを回避するため、ポップアップを React portal で `document.body`
 * 直下に飛ばし、トリガ要素の画面座標を `getBoundingClientRect` で
 * 動的計算して `position: fixed` で配置する。
 *
 * スクロール発生時はトリガからずれるためポップアップを閉じる。
 */
export function NotesHoverPopover({ content, classPrefix }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  const showPopup = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  };

  return (
    <div
      ref={triggerRef}
      className={`${classPrefix}-wrap`}
      onMouseEnter={showPopup}
      onMouseLeave={() => setOpen(false)}
      onFocus={showPopup}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <div className={classPrefix}>{content}</div>
      {mounted && open
        ? createPortal(
            <div
              className={`${classPrefix}-popup is-floating`}
              role="tooltip"
              aria-label="メモ全文"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                display: "block",
              }}
            >
              <MarkdownView content={content} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
