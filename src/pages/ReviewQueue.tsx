import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import type { Campaign } from "../lib/types";

export default function ReviewQueue() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadQueue() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const [campaignResponse, reviewedResponse] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*")
          .neq("owner_id", user.id)
          .in("status", ["pending", "in_review"])
          .order("created_at", { ascending: true })
          .limit(50),
        supabase.from("reviews").select("campaign_id").eq("reviewer_id", user.id),
      ]);

      if (campaignResponse.error) {
        setError(campaignResponse.error.message);
        setLoading(false);
        return;
      }

      const reviewedIds = new Set((reviewedResponse.data ?? []).map((review) => review.campaign_id));
      const nextCampaign = ((campaignResponse.data ?? []) as Campaign[]).find((item) => !reviewedIds.has(item.id)) ?? null;

      setCampaign(nextCampaign);
      setLoading(false);
    }

    loadQueue();
  }, []);

  return (
    <div className="narrow-page page-stack">
      <section className="section-header">
        <div>
          <p className="eyebrow">Review queue</p>
          <h1>Next campaign ready for review</h1>
          <p className="muted">Open the Ads Manager link, check the setup manually, then submit the checklist.</p>
        </div>
      </section>

      {error ? <p className="alert alert-error">{error}</p> : null}
      {loading ? <p className="muted">Finding an available campaign...</p> : null}

      {!loading && !campaign ? (
        <div className="empty-state">
          <h3>You&apos;re all caught up.</h3>
          <p>No campaigns are ready for review right now.</p>
        </div>
      ) : null}

      {campaign ? (
        <article className="card review-queue-card">
          <div className="card-header">
            <div>
              <h2>{campaign.nickname || "Untitled campaign"}</h2>
              <p className="muted">Oldest available campaign in the queue</p>
            </div>
          </div>

          {campaign.owner_notes ? (
            <div className="notes-box">
              <strong>Owner notes</strong>
              <p>{campaign.owner_notes}</p>
            </div>
          ) : null}

          <div className="button-row">
            <a className="button button-secondary" href={campaign.ads_manager_link} target="_blank" rel="noreferrer">
              Open Ads Manager
            </a>
            <Link className="button button-primary" to={`/review/${campaign.id}`}>
              Start review
            </Link>
          </div>
        </article>
      ) : null}
    </div>
  );
}
