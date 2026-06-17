import type { CampaignStatus } from "../lib/types";

const statusLabels: Record<CampaignStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  reviewed: "Reviewed",
};

type StatusBadgeProps = {
  status: CampaignStatus;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}
