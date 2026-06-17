import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { supabase } from "../lib/supabaseClient";
import type { Campaign } from "../lib/types";

type DashboardStats = {
  totalReviews: number;
  weekReviews: number;
  monthReviews: number;
  unreadNotifications: number;
};

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalReviews: 0,
    weekReviews: 0,
    monthReviews: 0,
    unreadNotifications: 0,
  });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      const now = new Date();
      const weekStart = startOfWeek(now).toISOString();
      const monthStart = startOfMonth(now).toISOString();

      const [campaignResponse, totalResponse, weekResponse, monthResponse, unreadResponse] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("reviewer_id", user.id),
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("reviewer_id", user.id)
          .gte("created_at", weekStart),
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("reviewer_id", user.id)
          .gte("created_at", monthStart),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false),
      ]);

      if (campaignResponse.error) {
        setError(campaignResponse.error.message);
      } else {
        setCampaigns((campaignResponse.data ?? []) as Campaign[]);
      }

      setStats({
        totalReviews: totalResponse.count ?? 0,
        weekReviews: weekResponse.count ?? 0,
        monthReviews: monthResponse.count ?? 0,
        unreadNotifications: unreadResponse.count ?? 0,
      });

      setLoading(false);
    }

    loadDashboard();
  }, []);

  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">ReviewBee</p>
          <h1>Review better ads together.</h1>
          <p className="muted">Signed in as {email}</p>
        </div>
        <div className="hero-actions">
          <Link className="button button-primary" to="/submit">
            Submit Campaign
          </Link>
          <Link className="button button-secondary" to="/review">
            Review Queue
          </Link>
          <Link className="button button-ghost" to="/inbox">
            Inbox
          </Link>
        </div>
      </section>

      <section className="stats-grid" aria-label="Review stats">
        <article className="stat-card">
          <span>Total reviews completed</span>
          <strong>{stats.totalReviews}</strong>
        </article>
        <article className="stat-card">
          <span>Reviews completed this week</span>
          <strong>{stats.weekReviews}</strong>
        </article>
        <article className="stat-card">
          <span>Reviews completed this month</span>
          <strong>{stats.monthReviews}</strong>
        </article>
        <article className="stat-card">
          <span>Unread inbox notifications</span>
          <strong>{stats.unreadNotifications}</strong>
        </article>
      </section>

      <section className="section-header">
        <div>
          <h2>My submitted campaigns</h2>
          <p className="muted">Track status and open reviews for campaigns you submitted.</p>
        </div>
        <Link className="button button-secondary" to="/submit">
          Submit Campaign
        </Link>
      </section>

      {error ? <p className="alert alert-error">{error}</p> : null}
      {loading ? <p className="muted">Loading campaigns...</p> : null}

      {!loading && campaigns.length === 0 ? (
        <div className="empty-state">
          <h3>No campaigns submitted yet</h3>
          <p>Submit an Ads Manager link when you are ready for another set of eyes.</p>
          <Link className="button button-primary" to="/submit">
            Submit Campaign
          </Link>
        </div>
      ) : null}

      <div className="campaign-grid">
        {campaigns.map((campaign) => (
          <article className="card campaign-card" key={campaign.id}>
            <div className="card-header">
              <div>
                <h3>{campaign.nickname || "Untitled campaign"}</h3>
                <p className="muted">Submitted {formatDate(campaign.created_at)}</p>
              </div>
              <StatusBadge status={campaign.status} />
            </div>
            <dl className="compact-list">
              <div>
                <dt>Reviews received</dt>
                <dd>{campaign.review_count}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{campaign.status.replace("_", " ")}</dd>
              </div>
            </dl>
            <Link className="button button-secondary button-full" to={`/campaign/${campaign.id}`}>
              View campaign
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
