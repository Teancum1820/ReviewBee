import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { notifyNotificationCounterUpdated } from "../lib/notificationEvents";
import { getReviewerName, getReviewResult, getReviewResultLabel, type ReviewResult } from "../lib/reviewResults";
import { supabase } from "../lib/supabaseClient";
import type { Campaign, InboxNotification, Profile, Review, ReviewChecklistItem } from "../lib/types";

type InboxNotificationView = InboxNotification & {
  campaign?: Pick<Campaign, "id" | "ads_manager_link" | "nickname" | "status">;
  result?: ReviewResult;
  reviewerName?: string;
  isLatestReview?: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Inbox() {
  const [notifications, setNotifications] = useState<InboxNotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resubmittingCampaignId, setResubmittingCampaignId] = useState("");

  async function loadNotifications() {
    setLoading(true);
    setError("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (notificationError) {
      setError(notificationError.message);
    } else {
      const notificationRows = (data ?? []) as InboxNotification[];
      const campaignIds = Array.from(
        new Set(notificationRows.map((notification) => notification.campaign_id).filter(Boolean) as string[]),
      );
      const reviewIds = Array.from(
        new Set(notificationRows.map((notification) => notification.review_id).filter(Boolean) as string[]),
      );

      const [campaignResponse, reviewResponse, latestReviewResponse, checklistResponse] = await Promise.all([
        campaignIds.length > 0
          ? supabase.from("campaigns").select("id, ads_manager_link, nickname, status").in("id", campaignIds)
          : Promise.resolve({ data: [], error: null }),
        reviewIds.length > 0
          ? supabase.from("reviews").select("id, reviewer_id").in("id", reviewIds)
          : Promise.resolve({ data: [], error: null }),
        campaignIds.length > 0
          ? supabase
              .from("reviews")
              .select("id, campaign_id, created_at")
              .in("campaign_id", campaignIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        reviewIds.length > 0
          ? supabase.from("review_checklist_items").select("review_id, status").in("review_id", reviewIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (campaignResponse.error) {
        setError(campaignResponse.error.message);
      }

      if (reviewResponse.error) {
        setError(reviewResponse.error.message);
      }

      if (latestReviewResponse.error) {
        setError(latestReviewResponse.error.message);
      }

      if (checklistResponse.error) {
        setError(checklistResponse.error.message);
      }

      const reviewRows = (reviewResponse.data ?? []) as Pick<Review, "id" | "reviewer_id">[];
      const reviewerIds = Array.from(new Set(reviewRows.map((review) => review.reviewer_id)));
      const profileResponse =
        reviewerIds.length > 0
          ? await supabase.from("profiles").select("id, display_name, email").in("id", reviewerIds)
          : { data: [], error: null };

      if (profileResponse.error) {
        setError(profileResponse.error.message);
      }

      const campaignsById = new Map(
        ((campaignResponse.data ?? []) as Pick<Campaign, "id" | "ads_manager_link" | "nickname" | "status">[]).map(
          (campaign) => [campaign.id, campaign],
        ),
      );
      const reviewsById = new Map(reviewRows.map((review) => [review.id, review]));
      const latestReviewIdByCampaignId = new Map<string, string>();
      ((latestReviewResponse.data ?? []) as Pick<Review, "id" | "campaign_id">[]).forEach((review) => {
        if (!latestReviewIdByCampaignId.has(review.campaign_id)) {
          latestReviewIdByCampaignId.set(review.campaign_id, review.id);
        }
      });
      const profilesById = new Map(
        ((profileResponse.data ?? []) as Pick<Profile, "id" | "display_name" | "email">[]).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      const checklistItemsByReviewId = ((checklistResponse.data ?? []) as Pick<
        ReviewChecklistItem,
        "review_id" | "status"
      >[]).reduce<Record<string, Pick<ReviewChecklistItem, "review_id" | "status">[]>>((grouped, item) => {
        grouped[item.review_id] = grouped[item.review_id] ?? [];
        grouped[item.review_id].push(item);
        return grouped;
      }, {});

      setNotifications(
        notificationRows.map((notification) => {
          const checklistItems = notification.review_id ? checklistItemsByReviewId[notification.review_id] ?? [] : [];
          const review = notification.review_id ? reviewsById.get(notification.review_id) : undefined;

          return {
            ...notification,
            campaign: notification.campaign_id ? campaignsById.get(notification.campaign_id) : undefined,
            result: getReviewResult(checklistItems),
            reviewerName: review ? getReviewerName(profilesById.get(review.reviewer_id), review.reviewer_id) : undefined,
            isLatestReview:
              Boolean(notification.campaign_id && notification.review_id) &&
              latestReviewIdByCampaignId.get(notification.campaign_id ?? "") === notification.review_id,
          };
        }),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markAsRead(notificationId: string) {
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, is_read: true } : notification,
      ),
    );
    notifyNotificationCounterUpdated();
  }

  async function resubmitCampaign(campaign: NonNullable<InboxNotificationView["campaign"]>) {
    setError("");
    setResubmittingCampaignId(campaign.id);

    const { data, error: updateError } = await supabase
      .from("campaigns")
      .update({ status: "pending" })
      .eq("id", campaign.id)
      .select("status")
      .single();

    setResubmittingCampaignId("");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.campaign?.id === campaign.id
          ? { ...notification, campaign: { ...notification.campaign, status: data.status } }
          : notification,
      ),
    );
  }

  async function markAllAsRead() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    notifyNotificationCounterUpdated();
  }

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="page-stack">
      <section className="section-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1>Notifications</h1>
          <p className="muted">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={markAllAsRead} disabled={unreadCount === 0}>
          Mark all as read
        </button>
      </section>

      {error ? <p className="alert alert-error">{error}</p> : null}
      {loading ? <p className="muted">Loading notifications...</p> : null}

      {!loading && notifications.length === 0 ? (
        <div className="empty-state">
          <h3>No notifications yet</h3>
          <p>When a campaign is reviewed, the notification will appear here.</p>
        </div>
      ) : null}

      <div className="notification-list">
        {notifications.map((notification) => (
          <article className={`card notification-card ${notification.is_read ? "" : "notification-unread"}`} key={notification.id}>
            <div>
              <div className="notification-title-row">
                <h3>{notification.message}</h3>
                {notification.result ? (
                  <span className={`result-pill ${notification.result === "passed" ? "result-pass" : "result-fail"}`}>
                    {getReviewResultLabel(notification.result)}
                  </span>
                ) : null}
                <span className={notification.is_read ? "read-label" : "unread-label"}>
                  {notification.is_read ? "Read" : "Unread"}
                </span>
              </div>
              <p className="muted">{formatDate(notification.created_at)}</p>
              {notification.campaign ? (
                <p className="muted notification-campaign-name">
                  Campaign:{" "}
                  <Link className="inline-link" to={`/campaign/${notification.campaign.id}`}>
                    {notification.campaign.nickname || "Untitled campaign"}
                  </Link>
                </p>
              ) : null}
              {notification.reviewerName ? (
                <p className="muted notification-campaign-name">Reviewed by {notification.reviewerName}</p>
              ) : null}
              <div className="notification-actions">
                {notification.campaign ? (
                  <a
                    className="button button-secondary"
                    href={notification.campaign.ads_manager_link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open campaign link
                  </a>
                ) : null}
                {notification.campaign_id ? (
                  <Link className="button button-ghost" to={`/campaign/${notification.campaign_id}`}>
                    View details
                  </Link>
                ) : null}
                {notification.result === "failed" &&
                notification.campaign?.status === "reviewed" &&
                notification.isLatestReview ? (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => resubmitCampaign(notification.campaign!)}
                    disabled={resubmittingCampaignId === notification.campaign.id}
                  >
                    {resubmittingCampaignId === notification.campaign.id ? "Resubmitting..." : "Resubmit campaign"}
                  </button>
                ) : null}
                {notification.result === "failed" &&
                notification.campaign &&
                notification.campaign.status !== "reviewed" &&
                notification.isLatestReview ? (
                  <span className="resubmitted-label">Resubmitted for review</span>
                ) : null}
              </div>
            </div>
            {!notification.is_read ? (
              <button className="button button-ghost" type="button" onClick={() => markAsRead(notification.id)}>
                Mark read
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
