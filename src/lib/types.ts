export type CampaignStatus = "pending" | "in_review" | "reviewed";

export type Campaign = {
  id: string;
  owner_id: string;
  ads_manager_link: string;
  nickname: string | null;
  owner_notes: string | null;
  status: CampaignStatus;
  review_count: number;
  created_at: string;
  updated_at: string;
};

export type Review = {
  id: string;
  campaign_id: string;
  reviewer_id: string;
  overall_notes: string | null;
  created_at: string;
};

export type ReviewChecklistItem = {
  id: string;
  review_id: string;
  item_key: string;
  item_label: string;
  status: "pass" | "fail" | "not_sure";
  notes: string | null;
  created_at: string;
};

export type InboxNotification = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  review_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};
