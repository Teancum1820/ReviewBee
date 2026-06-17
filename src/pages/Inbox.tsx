import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { REVIEW_CHECKLIST } from "../lib/checklist";
import { notifyNotificationCounterUpdated } from "../lib/notificationEvents";
import { supabase } from "../lib/supabaseClient";
import type { Campaign, InboxNotification, ReviewChecklistItem } from "../lib/types";

type ReviewResult = "passed" | "failed";

type InboxNotificationView = InboxNotification & {
  campaign?: Pick<Campaign, "id" | "ads_manager_link" | "nickname">;
  result?: ReviewResult;
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

      const [campaignResponse, checklistResponse] = await Promise.all([
        campaignIds.length > 0
          ? supabase.from("campaigns").select("id, ads_manager_link, nickname").in("id", campaignIds)
          : Promise.resolve({ data: [], error: null }),
        reviewIds.length > 0
          ? supabase.from("review_checklist_items").select("review_id, status").in("review_id", reviewIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (campaignResponse.error) {
        setError(campaignResponse.error.message);
      }

      if (checklistResponse.error) {
        setError(checklistResponse.error.message);
      }

      const campaignsById = new Map(
        ((campaignResponse.data ?? []) as Pick<Campaign, "id" | "ads_manager_link" | "nickname">[]).map((campaign) => [
          campaign.id,
          campaign,
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
          const result =
            checklistItems.length >= REVIEW_CHECKLIST.length && checklistItems.every((item) => item.status === "pass")
              ? "passed"
              : checklistItems.length > 0
                ? "failed"
                : undefined;

          return {
            ...notification,
            campaign: notification.campaign_id ? campaignsById.get(notification.campaign_id) : undefined,
            result,
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
                    {notification.result === "passed" ? "Passed" : "Failed"}
                  </span>
                ) : null}
                <span className={notification.is_read ? "read-label" : "unread-label"}>
                  {notification.is_read ? "Read" : "Unread"}
                </span>
              </div>
              <p className="muted">{formatDate(notification.created_at)}</p>
              {notification.campaign ? (
                <p className="muted notification-campaign-name">
                  {notification.campaign.nickname || "Untitled campaign"}
                </p>
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
