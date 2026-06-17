import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function looksLikeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SubmitCampaign() {
  const [adsManagerLink, setAdsManagerLink] = useState("");
  const [nickname, setNickname] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const urlWarning = useMemo(() => {
    if (!adsManagerLink.trim() || looksLikeUrl(adsManagerLink.trim())) {
      return "";
    }

    return "This does not look like a full URL. You can still submit it, but reviewers may have trouble opening it.";
  }, [adsManagerLink]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedLink = adsManagerLink.trim();

    if (!trimmedLink) {
      setError("Ads Manager link is required.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setSubmitting(false);
      setError("You need to be logged in to submit a campaign.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        owner_id: user.id,
        ads_manager_link: trimmedLink,
        nickname: nickname.trim() || null,
        owner_notes: ownerNotes.trim() || null,
        status: "pending",
        review_count: 0,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    navigate(`/campaign/${data.id}`);
  }

  return (
    <div className="narrow-page page-stack">
      <section className="section-header">
        <div>
          <p className="eyebrow">Submit campaign</p>
          <h1>Request a peer review</h1>
          <p className="muted">Paste the Meta Ads Manager link and add any context a reviewer should know.</p>
        </div>
      </section>

      <form className="card form-stack" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="ads-manager-link">
          Ads Manager link
        </label>
        <input
          id="ads-manager-link"
          type="text"
          value={adsManagerLink}
          onChange={(event) => setAdsManagerLink(event.target.value)}
          placeholder="https://adsmanager.facebook.com/..."
          required
        />
        {urlWarning ? <p className="field-hint">{urlWarning}</p> : null}

        <label className="field-label" htmlFor="campaign-nickname">
          Campaign nickname
        </label>
        <input
          id="campaign-nickname"
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Spring offer retargeting"
        />

        <label className="field-label" htmlFor="owner-notes">
          Notes for reviewer
        </label>
        <textarea
          id="owner-notes"
          value={ownerNotes}
          onChange={(event) => setOwnerNotes(event.target.value)}
          placeholder="Mention anything the reviewer should pay close attention to"
          rows={5}
        />

        {error ? <p className="alert alert-error">{error}</p> : null}

        <button className="button button-primary button-full" type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Campaign"}
        </button>
      </form>
    </div>
  );
}
