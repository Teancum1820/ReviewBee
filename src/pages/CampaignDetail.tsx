import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { CHECKLIST_STATUS_LABELS, REVIEW_CHECKLIST, type ChecklistStatus } from "../lib/checklist";
import { supabase } from "../lib/supabaseClient";
import type { Campaign, Review, ReviewChecklistItem } from "../lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  return CHECKLIST_STATUS_LABELS[status as ChecklistStatus] ?? status;
}

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [items, setItems] = useState<ReviewChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaignDetail() {
      if (!campaignId) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setAccessDenied(false);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();

      if (campaignError || !campaignData || campaignData.owner_id !== user.id) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const nextCampaign = campaignData as Campaign;
      setCampaign(nextCampaign);

      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("*")
        .eq("campaign_id", nextCampaign.id)
        .order("created_at", { ascending: false });

      if (reviewError) {
        setError(reviewError.message);
        setLoading(false);
        return;
      }

      const nextReviews = (reviewData ?? []) as Review[];
      setReviews(nextReviews);

      if (nextReviews.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("review_checklist_items")
        .select("*")
        .in(
          "review_id",
          nextReviews.map((review) => review.id),
        );

      if (itemError) {
        setError(itemError.message);
      } else {
        setItems((itemData ?? []) as ReviewChecklistItem[]);
      }

      setLoading(false);
    }

    loadCampaignDetail();
  }, [campaignId]);

  const itemsByReviewId = useMemo(() => {
    return items.reduce<Record<string, ReviewChecklistItem[]>>((grouped, item) => {
      grouped[item.review_id] = grouped[item.review_id] ?? [];
      grouped[item.review_id].push(item);
      return grouped;
    }, {});
  }, [items]);

  if (loading) {
    return <div className="narrow-page muted">Loading campaign...</div>;
  }

  if (accessDenied || !campaign) {
    return (
      <div className="narrow-page empty-state">
        <h1>You do not have access to this campaign</h1>
        <p>Only the campaign owner can view full review details.</p>
        <Link className="button button-primary" to="/">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-header">
        <div>
          <p className="eyebrow">Campaign detail</p>
          <h1>{campaign.nickname || "Untitled campaign"}</h1>
          <p className="muted">Submitted {formatDate(campaign.created_at)}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </section>

      {error ? <p className="alert alert-error">{error}</p> : null}

      <section className="card detail-card">
        <dl className="detail-grid">
          <div>
            <dt>Ads Manager link</dt>
            <dd>
              <a className="inline-link" href={campaign.ads_manager_link} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{campaign.status.replace("_", " ")}</dd>
          </div>
          <div>
            <dt>Review count</dt>
            <dd>{campaign.review_count}</dd>
          </div>
          <div>
            <dt>Submitted date</dt>
            <dd>{formatDate(campaign.created_at)}</dd>
          </div>
        </dl>
        {campaign.owner_notes ? (
          <div className="notes-box">
            <strong>Owner notes</strong>
            <p>{campaign.owner_notes}</p>
          </div>
        ) : null}
      </section>

      <section className="section-header">
        <div>
          <h2>Reviews received</h2>
          <p className="muted">{reviews.length} review{reviews.length === 1 ? "" : "s"} submitted</p>
        </div>
      </section>

      {reviews.length === 0 ? (
        <div className="empty-state">
          <h3>No reviews yet</h3>
          <p>This campaign is still waiting for a peer review.</p>
        </div>
      ) : null}

      <div className="review-list">
        {reviews.map((review) => {
          const reviewItems = itemsByReviewId[review.id] ?? [];

          return (
            <article className="card review-card" key={review.id}>
              <div className="card-header">
                <div>
                  <h3>Review submitted</h3>
                  <p className="muted">{formatDate(review.created_at)}</p>
                </div>
              </div>

              <div className="checklist-results">
                {REVIEW_CHECKLIST.map((checklistItem) => {
                  const savedItem = reviewItems.find((item) => item.item_key === checklistItem.key);

                  return (
                    <div className="checklist-result-row" key={checklistItem.key}>
                      <div>
                        <strong>{checklistItem.label}</strong>
                        <p>{savedItem?.notes || "No item notes."}</p>
                      </div>
                      <span className={`result-pill result-${savedItem?.status ?? "missing"}`}>
                        {savedItem ? statusLabel(savedItem.status) : "Missing"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="notes-box">
                <strong>Overall notes</strong>
                <p>{review.overall_notes || "No overall notes provided."}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
