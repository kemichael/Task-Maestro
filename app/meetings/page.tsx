import MeetingExtractPane from "@/components/MeetingExtractPane";

export const metadata = { title: "議事録抽出 | Task Maestro" };

export default function MeetingsPage() {
  return (
    <section className="page">
      <h1>議事録からタスク抽出</h1>
      <p className="page-desc">終了した予定に紐づく Meet 議事録を検出し、自分のネクストアクションを抽出します。</p>
      <MeetingExtractPane />
    </section>
  );
}
