import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import type { ContentItem } from "../data/contentApi";
import { createEcho, deleteEcho, getUserId, listMyEchoesForItem } from "../data/echoApi";
import { listWavesForItem, type WaveSummaryRow } from "../data/wavesApi";

function kindEmoji(kind: string) {
  switch ((kind || "").toLowerCase()) {
    case "album":
    case "playlist":
      return "🎧";
    case "concert":
    case "event":
      return "🎟️";
    case "film":
    case "movie":
      return "🎬";
    case "book":
      return "📖";
    case "practice":
      return "🕯️";
    default:
      return "✦";
  }
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default function ItemDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const param = useMemo(() => (id || "").trim(), [id]);

  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  // Echo
  const [isAuthed, setIsAuthed] = useState(false);
  const [echoBusy, setEchoBusy] = useState(false);
  const [usageTag, setUsageTag] = useState("");
  const [note, setNote] = useState("");
  const [shareToWaves, setShareToWaves] = useState(true);
  const [myEchoes, setMyEchoes] = useState<any[]>([]);

  // Waves
  const [waves, setWaves] = useState<WaveSummaryRow[]>([]);
  const [wavesLoading, setWavesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);
        setItem(null);
        setImgFailed(false);

        if (!param) {
          setErrMsg("Missing item id.");
          return;
        }

        // Fetch item (by UUID or external_id)
        if (isUuid(param)) {
          const byId = await supabase
            .from("content_items")
            .select(
              "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,source,created_at"
            )
            .eq("id", param)
            .maybeSingle();

          if (byId.error) throw byId.error;
          if (byId.data) {
            if (!cancelled) setItem(byId.data as ContentItem);
          } else {
            const byExternal = await supabase
              .from("content_items")
              .select(
                "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,source,created_at"
              )
              .eq("external_id", param)
              .maybeSingle();

            if (byExternal.error) throw byExternal.error;
            if (!byExternal.data) {
              setErrMsg(`Couldn’t find that item (id: ${param}).`);
              return;
            }
            if (!cancelled) setItem(byExternal.data as ContentItem);
          }
        } else {
          const byExternal = await supabase
            .from("content_items")
            .select(
              "id,external_id,kind,title,byline,meta,image_url,url,state_tags,focus_tags,source,created_at"
            )
            .eq("external_id", param)
            .maybeSingle();

          if (byExternal.error) throw byExternal.error;
          if (!byExternal.data) {
            setErrMsg(`Couldn’t find that item (id: ${param}).`);
            return;
          }
          if (!cancelled) setItem(byExternal.data as ContentItem);
        }
      } catch (e: any) {
        console.error("ItemDetail error:", e);
        const msg = e?.message || e?.details || e?.hint || "Item page failed to load.";
        if (!cancelled) setErrMsg(String(msg));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [param]);

  // Load auth + my echoes + waves once item is available
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!item?.id) return;

      try {
        setWavesLoading(true);

        const uid = await getUserId();
        if (cancelled) return;
        setIsAuthed(!!uid);

        const [mine, waveRows] = await Promise.all([
          uid ? listMyEchoesForItem(item.id, 20) : Promise.resolve([]),
          listWavesForItem(item.id, 25),
        ]);

        if (!cancelled) {
          setMyEchoes(mine as any[]);
          setWaves(waveRows);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setWavesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  async function addEcho() {
    if (!item?.id) return;
    if (!isAuthed) return alert("Sign in to use Echo.");
    if (echoBusy) return;

    const tag = usageTag.trim();
    if (!tag) return alert("Add a usage tag (how you used it).");

    try {
      setEchoBusy(true);

      await createEcho({
        contentId: item.id,
        usageTag: tag,
        note,
        shareToWaves,
      });

      // refresh both panels
      const [mine, waveRows] = await Promise.all([
        listMyEchoesForItem(item.id, 20),
        listWavesForItem(item.id, 25),
      ]);

      setMyEchoes(mine as any[]);
      setWaves(waveRows);

      setUsageTag("");
      setNote("");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Couldn’t save Echo.");
    } finally {
      setEchoBusy(false);
    }
  }

  async function removeEcho(echoId: string) {
    if (!item?.id) return;
    if (!isAuthed) return;
    if (echoBusy) return;

    try {
      setEchoBusy(true);
      await deleteEcho(echoId);
      const mine = await listMyEchoesForItem(item.id, 20);
      setMyEchoes(mine as any[]);
    } catch (e) {
      console.error(e);
      alert("Couldn’t remove right now.");
    } finally {
      setEchoBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center">
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className="btn-back" onClick={() => navigate(-1)}>
                ← Back
              </button>
            </div>

            {loading ? (
              <div style={{ marginTop: 18, textAlign: "center" }}>
                <p style={{ color: "var(--muted)" }}>Loading…</p>
              </div>
            ) : errMsg ? (
              <div style={{ marginTop: 18, textAlign: "center" }}>
                <p style={{ color: "var(--muted)" }}>Couldn’t load this page right now.</p>
                <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
                  <b>Debug:</b> {errMsg}
                </p>
              </div>
            ) : !item ? (
              <div style={{ marginTop: 18, textAlign: "center" }}>
                <p style={{ color: "var(--muted)" }}>No item.</p>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 18,
                  maxWidth: 560,
                  marginLeft: "auto",
                  marginRight: "auto",
                  textAlign: "center",
                }}
              >
                {/* Icon / Image */}
                <div
                  style={{
                    width: 92,
                    height: 92,
                    margin: "0 auto 18px",
                    borderRadius: 24,
                    overflow: "hidden",
                    background: "linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.02))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.image_url && !imgFailed ? (
                    <img
                      src={item.image_url}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <div style={{ fontSize: 34, opacity: 0.9 }}>{kindEmoji(item.kind)}</div>
                  )}
                </div>

                {/* Meta line */}
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {item.kind || "Item"}
                  <span style={{ margin: "0 8px" }}>•</span>
                  {item.meta || "—"}
                </div>

                {/* Title */}
                <h2
                  style={{
                    marginTop: 8,
                    fontSize: 24,
                    fontWeight: 850,
                    color: "var(--text)",
                    lineHeight: 1.15,
                  }}
                >
                  {item.title}
                </h2>

                {/* Byline */}
                {item.byline && (
                  <div style={{ marginTop: 6, fontSize: 14, color: "var(--muted)" }}>
                    {item.byline}
                  </div>
                )}

                {/* Tags */}
                <div style={{ marginTop: 18, fontSize: 13, color: "var(--muted)" }}>
                  <div>
                    <b>State tags:</b> {(item.state_tags || []).join(", ") || "—"}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Focus tags:</b> {(item.focus_tags || []).join(", ") || "—"}
                  </div>
                </div>

                {/* External link */}
                {item.url && (
                  <div style={{ marginTop: 18 }}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "10px 18px",
                        borderRadius: 999,
                        background: "var(--primary)",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 750,
                        textDecoration: "none",
                        minWidth: 140,
                      }}
                    >
                      Open →
                    </a>
                  </div>
                )}

                {/* ---------- Echo (private) ---------- */}
                <div
                  style={{
                    marginTop: 24,
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 800, color: "var(--text)" }}>Echo</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Private log (you only)
                    </div>
                  </div>

                  {!isAuthed ? (
                    <p style={{ color: "var(--muted)", marginTop: 10 }}>
                      Sign in to log echoes.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                        <input
                          value={usageTag}
                          onChange={(e) => setUsageTag(e.target.value)}
                          placeholder='Usage tag (ex: "soft reset", "focus sprint")'
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: 14,
                            border: "1px solid rgba(0,0,0,0.08)",
                            outline: "none",
                          }}
                        />

                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Optional note (private)"
                          rows={3}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: 14,
                            border: "1px solid rgba(0,0,0,0.08)",
                            outline: "none",
                            resize: "vertical",
                          }}
                        />

                        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={shareToWaves}
                            onChange={(e) => setShareToWaves(e.target.checked)}
                          />
                          <span style={{ color: "var(--muted)", fontSize: 13 }}>
                            Share anonymized tag to Waves
                          </span>
                        </label>

                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={addEcho}
                          disabled={echoBusy}
                        >
                          {echoBusy ? "Saving…" : "Save Echo →"}
                        </button>
                      </div>

                      {/* My echoes for this item */}
                      {myEchoes.length > 0 && (
                        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            Recent echoes
                          </div>
                          {myEchoes.slice(0, 6).map((e: any) => (
                            <div
                              key={e.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 12px",
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.55)",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: "var(--primary)" }}>
                                  {e.usage_tag}
                                </div>
                                {e.note && (
                                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                                    {e.note}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => removeEcho(e.id)}
                                disabled={echoBusy}
                                style={{ padding: "8px 10px" }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ---------- Waves (public) ---------- */}
                <div style={{ marginTop: 18, textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800, color: "var(--text)" }}>Waves</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Public, anonymous
                    </div>
                  </div>

                  {wavesLoading ? (
                    <p style={{ color: "var(--muted)", marginTop: 10 }}>Loading waves…</p>
                  ) : waves.length === 0 ? (
                    <p style={{ color: "var(--muted)", marginTop: 10 }}>
                      No waves yet. Be the first to share a tag.
                    </p>
                  ) : (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      {waves.slice(0, 8).map((w) => (
                        <div
                          key={w.usage_tag}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: "1px solid rgba(0,0,0,0.06)",
                            background: "rgba(0,0,0,0.02)",
                          }}
                        >
                          <div style={{ fontWeight: 800, color: "var(--primary)" }}>
                            {w.usage_tag}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 13 }}>
                            {w.uses} wave{w.uses === 1 ? "" : "s"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => navigate("/waves")}
                    >
                      View all Waves →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}



