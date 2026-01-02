import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import { createEcho, deleteEcho, listMyEchoes, type EchoWithContent } from "../data/echoApi";
import "./echo.css";

type ContentItemLite = {
  id: string;
  title: string;
  kind: string;
  image_url: string | null;
};

const QUICK_TAGS = ["#focus", "#unwind", "#study", "#heal", "#reset", "#laugh"];

function fmtDate(d = new Date()) {
  return d.toLocaleDateString("en-US");
}

function dayLabel(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function groupByUsedOn(rows: EchoWithContent[]) {
  const map = new Map<string, EchoWithContent[]>();
  for (const r of rows) {
    const key = r.used_on || "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

async function getContentItemLite(contentId: string): Promise<ContentItemLite | null> {
  const id = (contentId || "").trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("content_items")
    .select("id,title,kind,image_url")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as ContentItemLite) ?? null;
}

async function searchContentItemsLite(q: string, limit = 12): Promise<ContentItemLite[]> {
  const query = (q || "").trim();
  let sb = supabase.from("content_items").select("id,title,kind,image_url");
  if (query) sb = sb.ilike("title", `%${query}%`);

  const { data, error } = await sb.order("title", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as ContentItemLite[];
}

export default function Echo() {
  const [today] = useState(() => fmtDate());

  const [note, setNote] = useState("");
  const [usageTag, setUsageTag] = useState("");
  const [customTag, setCustomTag] = useState("");

  const [shareToWaves, setShareToWaves] = useState(false);
  const [privateOnly, setPrivateOnly] = useState(false);

  const [selectedItem, setSelectedItem] = useState<ContentItemLite | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ContentItemLite[]>([]);
  const [searching, setSearching] = useState(false);

  const [saved, setSaved] = useState<EchoWithContent[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const fromSession = sessionStorage.getItem("kivaw_echo_content_id") || "";
        if (fromSession) {
          const item = await getContentItemLite(fromSession);
          if (item) setSelectedItem(item);
          return;
        }
        const first = await searchContentItemsLite("", 1);
        if (first[0]) setSelectedItem(first[0]);
      } catch (e: any) {
        console.warn(e);
      }
    })();
  }, []);

  async function refreshSaved() {
    setLoadingSaved(true);
    try {
      const rows = await listMyEchoes(120);
      setSaved(rows);
    } catch (e: any) {
      setErr(e?.message || "Failed to load saved echoes");
    } finally {
      setLoadingSaved(false);
    }
  }

  useEffect(() => {
    refreshSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;

    let alive = true;
    setSearching(true);

    (async () => {
      try {
        const results = await searchContentItemsLite(searchQ, 12);
        if (!alive) return;
        setSearchResults(results);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Search failed");
      } finally {
        if (!alive) return;
        setSearching(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [pickerOpen, searchQ]);

  const effectiveTag = useMemo(() => {
    const t = (usageTag || "").trim();
    if (t) return t.startsWith("#") ? t : `#${t}`;
    const c = (customTag || "").trim();
    if (!c) return "";
    return c.startsWith("#") ? c : `#${c}`;
  }, [usageTag, customTag]);

  const shareAllowed = useMemo(() => !privateOnly && !!selectedItem?.id, [privateOnly, selectedItem?.id]);

  useEffect(() => {
    if (privateOnly && shareToWaves) setShareToWaves(false);
    if (!shareAllowed && shareToWaves) setShareToWaves(false);
  }, [privateOnly, shareAllowed, shareToWaves]);

  async function onSave() {
    setErr(null);

    if (!effectiveTag) return setErr("Add a tag first (pick one or type your own).");
    if (!selectedItem?.id) return setErr("Link an item first (required).");

    setSaving(true);
    try {
      await createEcho({
        contentId: selectedItem.id,
        usageTag: effectiveTag,
        note: note.trim() ? note.trim() : undefined,
        shareToWaves: shareToWaves && shareAllowed,
      });

      setNote("");
      setUsageTag("");
      setCustomTag("");
      setShareToWaves(false);
      setPrivateOnly(false);

      await refreshSaved();
    } catch (e: any) {
      setErr(e?.message || "Failed to save echo");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this echo?")) return;
    try {
      await deleteEcho(id);
      await refreshSaved();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete echo");
    }
  }

  const grouped = useMemo(() => groupByUsedOn(saved), [saved]);

  return (
    <div className="page echo-page">
      <div className="echo-wrap">
        <header className="echo-header">
          <h1>Echo</h1>
          <div className="echo-subtitle">Capture how something affected you.</div>
          <div className="echo-date">{today}</div>
        </header>

        {err && <div className="echo-alert">{err}</div>}

        <Card className="echo-card">
          <div className="echo-section">
            <div className="echo-section-title">Write your reflection</div>

            <textarea
              className="echo-textarea"
              placeholder="What did this help you feel or do? What changed in you?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="echo-row">
              <div className="echo-tags">
                <div className="echo-tags-label">Tags</div>

                <div className="echo-chips">
                  {QUICK_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`chip ${effectiveTag === t ? "is-active" : ""}`}
                      onClick={() => {
                        setUsageTag(t);
                        setCustomTag("");
                      }}
                    >
                      {t}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    onClick={() => setUsageTag("")}
                    title="Type your own tag"
                  >
                    + Add tag
                  </button>
                </div>

                <div className="echo-tag-row">
                  <input
                    className="input echo-tag-input"
                    placeholder="Type a custom tag…"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onFocus={() => setUsageTag("")}
                  />
                </div>
              </div>

              <label className={`echo-share ${!shareAllowed ? "is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={shareToWaves}
                  disabled={!shareAllowed}
                  onChange={(e) => setShareToWaves(e.target.checked)}
                />
                Share to Waves
              </label>
            </div>

            <label className="echo-private">
              <input type="checkbox" checked={privateOnly} onChange={(e) => setPrivateOnly(e.target.checked)} />
              Private-only (never share to Waves)
            </label>

            <div className="echo-link-strip">
              <div className="echo-link-left">
                {selectedItem?.image_url ? (
                  <img className="echo-thumb" src={selectedItem.image_url} alt="" />
                ) : (
                  <div className="echo-thumb echo-thumb--empty" />
                )}

                <div className="echo-link-text">
                  <div className="echo-link-kicker">Linked item</div>
                  <div className="echo-link-title">{selectedItem?.title || "No item linked"}</div>
                  <div className="echo-link-meta">{selectedItem?.kind || "—"}</div>
                </div>
              </div>

              <button type="button" className="btn btn-small btn-ghost" onClick={() => setPickerOpen((v) => !v)}>
                {pickerOpen ? "Close" : "Change"}
              </button>
            </div>

            {pickerOpen && (
              <div className="echo-picker">
                <div className="echo-picker-row">
                  <input
                    className="echo-picker-input"
                    placeholder="Search items…"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                </div>

                <div className="echo-results">
                  {searching && <div className="echo-muted">Searching…</div>}
                  {!searching && searchResults.length === 0 && <div className="echo-muted">No results.</div>}

                  {!searching &&
                    searchResults.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className="echo-result"
                        onClick={() => {
                          setSelectedItem(it);
                          sessionStorage.setItem("kivaw_echo_content_id", it.id);
                          setPickerOpen(false);
                        }}
                      >
                        {it.image_url ? (
                          <img className="echo-result-thumb" src={it.image_url} alt="" />
                        ) : (
                          <div className="echo-result-thumb echo-thumb--empty" />
                        )}

                        <div>
                          <div className="echo-result-title">{it.title}</div>
                          <div className="echo-result-meta">{it.kind}</div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="echo-save-row">
              <button type="button" className="btn btn-primary btn-wide echo-save" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save Echo →"}
              </button>
            </div>
          </div>
        </Card>

        <section className="echo-history">
          <div className="echo-history-head">
            <h2>Saved Echoes</h2>
            <button type="button" className="btn btn-small btn-ghost" onClick={refreshSaved}>
              Refresh
            </button>
          </div>

          {loadingSaved && <div className="echo-muted">Loading…</div>}
          {!loadingSaved && saved.length === 0 && <div className="echo-muted">No saved Echoes yet.</div>}

          {!loadingSaved &&
            grouped.map(([dateKey, rows]) => (
              <div key={dateKey}>
                <div className="echo-day-label">{dayLabel(dateKey)}</div>

                <div className="echo-day-list">
                  {rows.map((r) => {
                    const title = r.content_items?.title || "Untitled";
                    const kind = r.content_items?.kind || "";
                    const tag = r.usage_tag || "";
                    const shared = r.shared_to_waves ? "shared to Waves" : "private";

                    return (
                      <Card key={r.id} className="echo-entry">
                        <div className="echo-entry-top">
                          <div className="echo-entry-title">
                            <span className="echo-tag">{tag}</span>{" "}
                            <span className="echo-entry-title-text">{title}</span>
                          </div>

                          <button type="button" className="btn btn-small btn-ghost" onClick={() => onDelete(r.id)}>
                            Delete
                          </button>
                        </div>

                        {r.note && <div className="echo-entry-note">{r.note}</div>}

                        <div className="echo-entry-meta">
                          {kind ? `${kind} • ` : ""}
                          {shared}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}










