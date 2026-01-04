import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import type { ContentItem } from "../data/contentApi";
import { saveItem, unsaveItem, getUserId } from "../data/savesApi";
import { listWavesForItem } from "../data/wavesApi";
import { requireAuth } from "../auth/requireAuth";
import { isInternalContentItem } from "../utils/contentFilters";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [isSaved, setIsSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const [waves, setWaves] = useState<{ usage_tag: string; uses: number; last_used_at: string }[]>([]);
  const [waveTag, setWaveTag] = useState("");
  const [waveBusy, setWaveBusy] = useState(false);
  const [waveErr, setWaveErr] = useState("");

  const isUnlinked = useMemo(() => {
    if (!item) return false;
    return isInternalContentItem(item);
  }, [item]);

  async function loadItem(contentId: string) {
    setErr("");
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,usage_tags,source,created_at"
        )
        .eq("id", contentId)
        .maybeSingle();

      if (error) throw error;
      setItem((data as ContentItem) || null);

      const uid = await getUserId();
      if (uid) {
        const { data: srows } = await supabase
          .from("saves_v2")
          .select("content_item_id")
          .eq("user_id", uid)
          .eq("content_item_id", contentId)
          .limit(1);

        setIsSaved((srows || []).length > 0);
      } else {
        setIsSaved(false);
      }

      await loadWaves(contentId);
    } catch (e: any) {
      setErr(e?.message || "Could not load item.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWaves(contentId: string) {
    const rows = await listWavesForItem(contentId, 25);
    setWaves(rows || []);
  }

  useEffect(() => {
    if (!id) return;
    loadItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleSave() {
    if (!item?.id) return;

    const uid = await requireAuth(navigate, `/item/${item.id}`);
    if (!uid) return;

    if (saveBusy) return;
    setSaveBusy(true);

    const next = !isSaved;
    setIsSaved(next); // optimistic

    try {
      if (next) await saveItem(item.id);
      else await unsaveItem(item.id);
    } catch (e) {
      console.error(e);
      setIsSaved(!next);
      alert("Couldn’t update saved right now.");
    } finally {
      setSaveBusy(false);
    }
  }

  async function postWave() {
    if (!item?.id) return;
    if (isUnlinked) return;

    const uid = await requireAuth(navigate, `/item/${item.id}`);
    if (!uid) return;

    const raw = waveTag.trim();
    if (!raw) {
      setWaveErr("Add a tag first (example: reset, comfort, clarity).");
      return;
    }

    const tag = norm(raw);
    setWaveErr("");
    setWaveBusy(true);

    try {
      // waves_events(content_item_id, usage_tag, created_at)
      const { error } = await supabase.from("waves_events").insert([
        { content_item_id: item.id, usage_tag: tag },
      ]);

      if (error) throw error;

      setWaveTag("");
      await loadWaves(item.id);
    } catch (e: any) {
      console.error(e);
      setWaveErr(e?.message || "Couldn’t post a wave right now.");
    } finally {
      setWaveBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <p className="muted">Loading…</p>
          </Card>
        </div>
      </div>
    );
  }

  if (err || !item) {
    return (
      <div className="page">
        <div className="center-wrap">
          <Card className="center card-pad">
            <p className="muted">{err || "Not found."}</p>
            <div className="spacer-16" />
            <button className="btn" type="button" onClick={() => navigate("/explore")}>
              Back to Explore →
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad">
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className="btn-back" onClick={() => navigate(-1)} type="button">
                ← Back
              </button>
            </div>

            <div className="spacer-16" />

            <div className="kivaw-detail-head">
              <div className="kivaw-detail-kind">{item.kind}</div>

              <h1 className="kivaw-detail-title">{item.title}</h1>

              {item.byline ? <div className="kivaw-detail-byline">{item.byline}</div> : null}

              {item.meta ? <div className="kivaw-detail-meta">{item.meta}</div> : null}

              <div className="spacer-16" />

              <div className="item-detail-actions">
                <div className="item-detail-action-group">
                  <h3 className="item-detail-action-title">Want to remember what happened?</h3>
                  <p className="item-detail-action-desc">Save to Echo</p>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => navigate(`/echo?contentId=${item.id}`)}
                  >
                    Save to Echo →
                  </button>
                  <p className="item-detail-action-hint">Write full reflection, add personal tags, keep it private</p>
                </div>

                <div className="item-detail-action-group">
                  <h3 className="item-detail-action-title">Want to help others?</h3>
                  <p className="item-detail-action-desc">Save to Waves</p>
                  <button className="btn btn-ghost" type="button" onClick={toggleSave} disabled={saveBusy}>
                    {saveBusy ? "Saving…" : isSaved ? "Saved to Waves ♥" : "Save to Waves ♡"}
                  </button>
                  <p className="item-detail-action-hint">Add one anonymous tag, shows how you used it, no personal details</p>
                </div>
              </div>

              {item.url ? (
                <>
                  <div className="spacer-12" />
                  <a className="btn btn-ghost" href={item.url} target="_blank" rel="noreferrer">
                    Open source →
                  </a>
                </>
              ) : null}
            </div>

            <div className="spacer-24" />

            <div className="kivaw-detail-section">
              <h2 className="kivaw-detail-h2">Community Waves</h2>
              <p className="kivaw-detail-section-desc">See how others are using this activity</p>

              {isUnlinked ? (
                <div className="echo-empty">This item is internal and can't receive Waves.</div>
              ) : (
                <>
                  {waveErr ? <div className="echo-alert">{waveErr}</div> : null}

                  <div className="kivaw-wave-row">
                    <input
                      className="input"
                      placeholder="Add one anonymous tag (example: reset, comfort, clarity)"
                      value={waveTag}
                      onChange={(e) => setWaveTag(e.target.value)}
                    />
                    <button className="btn btn-ghost" type="button" onClick={postWave} disabled={waveBusy}>
                      {waveBusy ? "Posting…" : "Share to Waves →"}
                    </button>
                  </div>
                  <p className="item-detail-wave-hint">Your tag will be anonymous and help others discover new ways to use this activity</p>

                  <div className="spacer-12" />

                  {waves.length === 0 ? (
                    <div className="muted">No waves yet.</div>
                  ) : (
                    <div className="kivaw-wave-list">
                      {waves.map((w) => (
                        <div key={w.usage_tag} className="kivaw-wave-pill">
                          <span className="tag">{w.usage_tag}</span>
                          <span className="kivaw-meta-dot">•</span>
                          <span className="kivaw-meta-strong">{w.uses}</span>
                          <span className="kivaw-meta-soft">uses</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}









