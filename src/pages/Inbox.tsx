import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import type { InboxNotification } from "../lib/types";

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
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
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
      setNotifications((data ?? []) as InboxNotification[]);
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
                <span className={notification.is_read ? "read-label" : "unread-label"}>
                  {notification.is_read ? "Read" : "Unread"}
                </span>
              </div>
              <p className="muted">{formatDate(notification.created_at)}</p>
              {notification.campaign_id ? (
                <Link className="inline-link" to={`/campaign/${notification.campaign_id}`}>
                  View campaign
                </Link>
              ) : null}
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
