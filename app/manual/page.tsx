import fs from "node:fs/promises";
import path from "node:path";
import { MarkdownView } from "@/components/MarkdownView";

export const dynamic = "force-static";

export default async function ManualPage() {
  const filePath = path.resolve(process.cwd(), "app/manual/manual.md");
  const content = await fs.readFile(filePath, "utf-8");
  return (
    <div className="manual-page">
      <MarkdownView content={content} />
    </div>
  );
}
