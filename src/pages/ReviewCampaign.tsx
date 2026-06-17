import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ChecklistForm, { createInitialChecklistState, type ChecklistFormState } from "../components/ChecklistForm";
import { REVIEW_CHECKLIST, type ChecklistStatus } from "../lib/checklist";
import { supabase } from "../lib/supabaseClient";
import type { Campaign } from "../lib/types";

type ReviewState = "loading" | "ready" | "own_campaign" | "already_reviewed" | "unavailable" | "submitted";

export default function ReviewCampaign() {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>("loading");
  const [checklist, setChecklist] = useState<ChecklistFormState>(() => createInitialChecklistState());
  const [overallNotes, setOverallNotes] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCampaign() {
      if (!campaignId) {
        setReviewState("unavailable");
        return;
      }

      setReviewState("loading");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setReviewState("unavailable");
        return;
      }

      const { data, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();

      if (campaignError || !data) {
        setReviewState("unavailable");
        return;
      }

      const nextCampaign = data as Campaign;
      setCampaign(nextCampaign);

      if (nextCampaign.owner_id === user.id) {
        setReviewState("own_campaign");
        return;
      }

      if (!["pending", "in_review"].includes(nextCampaign.status)) {
        setReviewState("unavailable");
        return;
      }

      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("campaign_id", nextCampaign.id)
        .eq("reviewer_id", user.id)
        .maybeSingle();

      setReviewState(existingReview ? "already_reviewed" : "ready");
    }

    loadCampaign();
  }, [campaignId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationAttempted(true);
    setError("");

    if (!campaign) {
      setError("This campaign is not available for review.");
      return;
    }

    const missingItems = REVIEW_CHECKLIST.filter((item) => !checklist[item.key]?.status);

    if (missingItems.length > 0) {
      setError("Complete every checklist item before submitting the review.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setSubmitting(false);
      setError("You need to be logged in to submit a review.");
      return;
    }

    if (campaign.owner_id === user.id) {
      setSubmitting(false);
      setReviewState("own_campaign");
      return;
    }

    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .insert({
        campaign_id: campaign.id,
        reviewer_id: user.id,
        overall_notes: overallNotes.trim() || null,
      })
      .select("id")
      .single();

    if (reviewError) {
      setSubmitting(false);
      if (reviewError.code === "23505") {
        setReviewState("already_reviewed");
        return;
      }

      setError(reviewError.message);
      return;
    }

    const checklistRows = REVIEW_CHECKLIST.map((item) => ({
      review_id: review.id,
      item_key: item.key,
      item_label: item.label,
      status: checklist[item.key].status as ChecklistStatus,
      notes: checklist[item.key].notes.trim() || null,
    }));

    const { error: checklistError } = await supabase.from("review_checklist_items").insert(checklistRows);

    setSubmitting(false);

    if (checklistError) {
      setError(checklistError.message);
      return;
    }

    setReviewState("submitted");
  }

  if (reviewState === "loading") {
    return <div className="narrow-page muted">Loading campaign...</div>;
  }

  if (reviewState === "submitted") {
    return (
      <div className="narrow-page page-stack">
        <div className="empty-state">
          <h1>Review submitted</h1>
          <p>The campaign owner has received an in-app inbox notification.</p>
          <div className="button-row centered-actions">
            <Link className="button button-primary" to="/review">
              Review another campaign
            </Link>
            <button className="button button-secondary" type="button" onClick={() => navigate("/")}>
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (reviewState === "own_campaign") {
    return (
      <div className="narrow-page empty-state">
        <h1>You cannot review your own campaign</h1>
        <p>Open the review queue to find a campaign from another user.</p>
        <Link className="button button-primary" to="/review">
          Review Queue
        </Link>
      </div>
    );
  }

  if (reviewState === "already_reviewed") {
    return (
      <div className="narrow-page empty-state">
        <h1>You already reviewed this campaign</h1>
        <p>Each reviewer can submit one review per campaign.</p>
        <Link className="button button-primary" to="/review">
          Back to Review Queue
        </Link>
      </div>
    );
  }

  if (reviewState === "unavailable" || !campaign) {
    return (
      <div className="narrow-page empty-state">
        <h1>Campaign unavailable</h1>
        <p>This campaign may have already been reviewed or you may not have access to it.</p>
        <Link className="button button-primary" to="/review">
          Back to Review Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="review-page page-stack">
      <section className="section-header">
        <div>
          <p className="eyebrow">Campaign review</p>
          <h1>{campaign.nickname || "Untitled campaign"}</h1>
          <p className="muted">Open the Ads Manager link in a new tab, then complete each checklist item.</p>
        </div>
        <a className="button button-secondary" href={campaign.ads_manager_link} target="_blank" rel="noreferrer">
          Open Ads Manager
        </a>
      </section>

      {campaign.owner_notes ? (
        <div className="notes-box">
          <strong>Owner notes</strong>
          <p>{campaign.owner_notes}</p>
        </div>
      ) : null}

      <form className="page-stack" onSubmit={handleSubmit}>
        <ChecklistForm value={checklist} onChange={setChecklist} validationAttempted={validationAttempted} />

        <section className="card form-stack">
          <label className="field-label" htmlFor="overall-notes">
            Overall notes
          </label>
          <textarea
            id="overall-notes"
            value={overallNotes}
            onChange={(event) => setOverallNotes(event.target.value)}
            placeholder="Summarize the most important setup feedback"
            rows={5}
          />
        </section>

        {error ? <p className="alert alert-error">{error}</p> : null}

        <button className="button button-primary submit-review-button" type="submit" disabled={submitting}>
          {submitting ? "Submitting review..." : "Submit Review"}
        </button>
      </form>
    </div>
  );
}
