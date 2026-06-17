import { REVIEW_CHECKLIST } from "./checklist";
import type { Profile, ReviewChecklistItem } from "./types";

export type ReviewResult = "passed" | "failed";

export function getReviewResult(items: Pick<ReviewChecklistItem, "status">[]): ReviewResult | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items.length >= REVIEW_CHECKLIST.length && items.every((item) => item.status === "pass")
    ? "passed"
    : "failed";
}

export function getReviewResultLabel(result: ReviewResult) {
  return result === "passed" ? "Passed" : "Failed";
}

export function getReviewerName(profile: Pick<Profile, "display_name" | "email"> | undefined, reviewerId: string) {
  return profile?.display_name || profile?.email || `Reviewer ${reviewerId.slice(0, 8)}`;
}
