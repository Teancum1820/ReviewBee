import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { usernameFromUser } from "../lib/auth";
import { getReviewerName, getReviewResult, getReviewResultLabel, type ReviewResult } from "../lib/reviewResults";
import { supabase } from "../lib/supabaseClient";
import type { Campaign, Profile, Review, ReviewChecklistItem } from "../lib/types";

type DashboardStats = {
  totalReviews: number;
  weekReviews: number;
  monthReviews: number;
  unreadNotifications: number;
};

type ReviewSummary = Pick<Review, "id" | "campaign_id" | "reviewer_id" | "created_at"> & {
  result?: ReviewResult;
  reviewerName: string;
};

type DashboardCampaign = Campaign & {
  reviews: ReviewSummary[];
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
  const [campaigns, setCampaigns] = useState<DashboardCampaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalReviews: 0,
    weekReviews: 0,
    monthReviews: 0,
    unreadNotifications: 0,
  });
  const [username, setUsername] = useState("");
  const [resubmittingCampaignId, setResubmittingCampaignId] = useState("");
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

      const profileResponse = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      setUsername(profileResponse.data?.display_name || usernameFromUser(user));

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
        const campaignRows = (campaignResponse.data ?? []) as Campaign[];
        const campaignIds = campaignRows.map((campaign) => campaign.id);
        let reviewsByCampaignId = new Map<string, ReviewSummary[]>();

        if (campaignIds.length > 0) {
          const { data: reviewData, error: reviewError } = await supabase
            .from("reviews")
            .select("id, campaign_id, reviewer_id, created_at")
            .in("campaign_id", campaignIds)
            .order("created_at", { ascending: false });

          if (reviewError) {
            setError(reviewError.message);
          } else {
            const reviewRows = (reviewData ?? []) as Pick<
              Review,
              "id" | "campaign_id" | "reviewer_id" | "created_at"
            >[];
            const reviewIds = reviewRows.map((review) => review.id);
            const reviewerIds = Array.from(new Set(reviewRows.map((review) => review.reviewer_id)));

            const [checklistResponse, profileResponse] = await Promise.all([
              reviewIds.length > 0
                ? supabase.from("review_checklist_items").select("review_id, status").in("review_id", reviewIds)
                : Promise.resolve({ data: [], error: null }),
              reviewerIds.length > 0
                ? supabase.from("profiles").select("id, display_name, email").in("id", reviewerIds)
                : Promise.resolve({ data: [], error: null }),
            ]);

            if (checklistResponse.error) {
              setError(checklistResponse.error.message);
            }

            if (profileResponse.error) {
              setError(profileResponse.error.message);
            }

            const checklistItemsByReviewId = ((checklistResponse.data ?? []) as Pick<
              ReviewChecklistItem,
              "review_id" | "status"
            >[]).reduce<Record<string, Pick<ReviewChecklistItem, "review_id" | "status">[]>>((grouped, item) => {
              grouped[item.review_id] = grouped[item.review_id] ?? [];
              grouped[item.review_id].push(item);
              return grouped;
            }, {});

            const profilesById = new Map(
              ((profileResponse.data ?? []) as Pick<Profile, "id" | "display_name" | "email">[]).map((profile) => [
                profile.id,
                profile,
              ]),
            );

            reviewsByCampaignId = reviewRows.reduce<Map<string, ReviewSummary[]>>((grouped, review) => {
              const campaignReviews = grouped.get(review.campaign_id) ?? [];
              campaignReviews.push({
                ...review,
                result: getReviewResult(checklistItemsByReviewId[review.id] ?? []),
                reviewerName: getReviewerName(profilesById.get(review.reviewer_id), review.reviewer_id),
              });
              grouped.set(review.campaign_id, campaignReviews);
              return grouped;
            }, new Map());
          }
        }

        setCampaigns(
          campaignRows.map((campaign) => ({
            ...campaign,
            reviews: reviewsByCampaignId.get(campaign.id) ?? [],
          })),
        );
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

  async function resubmitCampaign(campaign: DashboardCampaign) {
    setError("");
    setResubmittingCampaignId(campaign.id);

    const { data, error: updateError } = await supabase
      .from("campaigns")
      .update({ status: "pending", review_round: campaign.review_round + 1 })
      .eq("id", campaign.id)
      .eq("review_round", campaign.review_round)
      .select("review_round, status")
      .single();

    setResubmittingCampaignId("");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCampaigns((current) =>
      current.map((currentCampaign) =>
        currentCampaign.id === campaign.id
          ? { ...currentCampaign, review_round: data.review_round, status: data.status }
          : currentCampaign,
      ),
    );
  }

  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">ReviewBee</p>
          <h1>Review better ads together.</h1>
          <p className="muted">Signed in as {username}</p>
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
        {campaigns.map((campaign) => {
          const latestReview = campaign.reviews[0];
          const result = latestReview?.result;
          const canResubmit = result === "failed" && campaign.status === "reviewed";

          return (
            <article className="card campaign-card" key={campaign.id}>
              <div className="card-header">
                <div>
                  <h3>
                    <Link className="inline-link" to={`/campaign/${campaign.id}`}>
                      {campaign.nickname || "Untitled campaign"}
                    </Link>
                  </h3>
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
                  <dt>Latest result</dt>
                  <dd>
                    {result ? (
                      <span className={`result-pill ${result === "passed" ? "result-pass" : "result-fail"}`}>
                        {getReviewResultLabel(result)}
                      </span>
                    ) : (
                      "Not reviewed"
                    )}
                  </dd>
                </div>
              </dl>

              {campaign.reviews.length > 0 ? (
                <div className="reviewer-summary-list">
                  <span>Reviewed by</span>
                  {campaign.reviews.map((review) => (
                    <div className="reviewer-summary-row" key={review.id}>
                      <strong>{review.reviewerName}</strong>
                      {review.result ? (
                        <span className={`result-pill ${review.result === "passed" ? "result-pass" : "result-fail"}`}>
                          {getReviewResultLabel(review.result)}
                        </span>
                      ) : (
                        <span className="result-pill result-missing">Pending result</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted campaign-card-note">No reviews yet.</p>
              )}

              <div className="campaign-actions">
                <a className="button button-secondary" href={campaign.ads_manager_link} target="_blank" rel="noreferrer">
                  Open campaign link
                </a>
                <Link className="button button-ghost" to={`/campaign/${campaign.id}`}>
                  View details
                </Link>
                {canResubmit ? (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => resubmitCampaign(campaign)}
                    disabled={resubmittingCampaignId === campaign.id}
                  >
                    {resubmittingCampaignId === campaign.id ? "Resubmitting..." : "Resubmit campaign"}
                  </button>
                ) : null}
                {result === "failed" && campaign.status !== "reviewed" ? (
                  <span className="resubmitted-label">Resubmitted for review</span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
