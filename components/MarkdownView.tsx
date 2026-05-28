"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content?: string;
  emptyText?: string;
  className?: string;
}

export function MarkdownView({ content, emptyText = "(本文なし)", className }: Props) {
  if (!content || content.trim().length === 0) {
    return <p className="markdown-empty">{emptyText}</p>;
  }
  return (
    <div className={`markdown-body ${className ?? ""}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
