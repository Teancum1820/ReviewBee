export const REVIEW_CHECKLIST = [
  { key: "name", label: "Name" },
  { key: "performance_goal", label: "Performance goal" },
  { key: "exclude_custom_audiences", label: "Exclude these custom audiences" },
  { key: "placements", label: "Placements" },
  { key: "comment_permissions", label: "Who can comment on your ads?" },
  { key: "identity", label: "Identity" },
  { key: "instant_form", label: "Instant form" },
  { key: "crm", label: "CRM" },
] as const;

export type ChecklistKey = (typeof REVIEW_CHECKLIST)[number]["key"];
export type ChecklistStatus = "pass" | "fail" | "not_sure";

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  not_sure: "Not sure",
};
