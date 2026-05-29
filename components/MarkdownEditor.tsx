"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
}

export function MarkdownEditor({ value, onChange, placeholder, height = 240 }: Props) {
  return (
    <textarea
      className="plain-markdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ minHeight: height }}
      spellCheck={false}
    />
  );
}
