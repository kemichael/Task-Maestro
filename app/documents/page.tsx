import DocumentExtractPane from "@/components/DocumentExtractPane";

export const metadata = { title: "ドキュメント抽出 | Task Maestro" };

export default function DocumentsPage() {
  return (
    <section className="page">
      <h1>ドキュメントからタスク抽出</h1>
      <p className="page-desc">Google ドキュメントの URL を入力し、本文を確認してから AI でタスク候補を抽出します。</p>
      <DocumentExtractPane />
    </section>
  );
}
