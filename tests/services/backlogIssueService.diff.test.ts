import { describe, expect, it } from "vitest";
import { diffRemovedIssueIds } from "@/lib/services/backlogIssueService";

describe("diffRemovedIssueIds", () => {
  it("ローカルにあって fetch に無い ID を返す", () => {
    const fetched = [1, 2, 3];
    const local = [1, 2, 4, 5];
    expect(diffRemovedIssueIds(fetched, local).sort()).toEqual([4, 5]);
  });

  it("全部 fetch に含まれていれば空配列", () => {
    expect(diffRemovedIssueIds([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it("ローカルが空なら空配列", () => {
    expect(diffRemovedIssueIds([1, 2, 3], [])).toEqual([]);
  });

  it("fetch が空ならローカル全件が削除対象", () => {
    expect(diffRemovedIssueIds([], [10, 20, 30]).sort()).toEqual([10, 20, 30]);
  });

  it("fetch に余分があっても (新規担当) ローカル不在分は対象外", () => {
    // fetch に新しいチケット (99) が含まれても、ローカルにそれが無いだけで削除対象には影響しない
    const fetched = [1, 2, 99];
    const local = [1, 2, 3];
    expect(diffRemovedIssueIds(fetched, local)).toEqual([3]);
  });

  it("入力の順序を保持する (Set 化のみで並び替えない)", () => {
    const fetched = [3, 1, 2];
    const local = [9, 1, 8, 2, 7];
    // local の元の順序のうち、fetched に無いものを順序通り返す
    expect(diffRemovedIssueIds(fetched, local)).toEqual([9, 8, 7]);
  });
});
