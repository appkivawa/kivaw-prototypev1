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

function normTag(raw: string) {
  const t = (raw || "").trim();
  if (!t) return "";
  return t.startsWith("#") ? t : `#${t}`;
}

function fmtToday() {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const [today] = useState(() => fmtToday());

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

  // Prefill from ItemDetail if you store it there
  useEffect(() => {
    (async () => {
      try {
        const fromSession = sessionStorage.getItem("kivaw_echo_content_id") || "";
        if (fromSession) {
          const item = await getContentItemLite(fromSession);
          if (item) setSelectedItem(item);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  async function refreshSaved() {
    setLoadingSaved(true);
    setErr(null);
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

  // Search picker
  useEffect(() => {
    if (!pickerOpen) return;

    let alive = true;
    setSearching(true);
    setErr(null);

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

  const effectiveTag = useMemo(() => normTag(usageTag) || normTag(customTag), [usageTag, customTag]);
  const shareAllowed = useMemo(() => !privateOnly && !!selectedItem?.id, [privateOnly, selectedItem?.id]);

  useEffect(() => {
    if (privateOnly && shareToWaves) setShareToWaves(false);
    if (!shareAllowed && shareToWaves) setShareToWaves(false);
  }, [privateOnly, shareAllowed, shareToWaves]);

  async function onSave() {
    setErr(null);

    // If you truly want tag optional, delete this check:
    if (!effectiveTag) return setErr("Pick a tag (or type one).");
    if (!selectedItem?.id) return setErr("Link an item first.");

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
      <div className="center-wrap echo-center">
        <div className="echo-hero">
          <h1 className="echo-h1">Echo</h1>
          <div className="echo-subtitle">Capture how something affected you — so you can find it later.</div>
        </div>

        <Card className="echo-maincard">
          {/* Linked item row */}
          <div className="echo-linkedrow">
            <div className="echo-linkedleft">
              {selectedItem?.image_url ? (
                <img className="echo-thumb" src={selectedItem.image_url} alt="" />
              ) : (
                <div className="echo-thumb echo-thumb--empty" />
              )}

              <div className="echo-linkedtext">
                <div className="echo-kicker">LINKED ITEM</div>
                <div className="echo-linkedtitle">{selectedItem?.title || "No item linked"}</div>
                <div className="echo-linkedmeta">{selectedItem?.kind || "—"}</div>
              </div>
            </div>

            <div className="echo-linkedactions">
              {selectedItem?.id ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setSelectedItem(null);
                    sessionStorage.removeItem("kivaw_echo_content_id");
                    setShareToWaves(false);
                  }}
                >
                  Clear
                </button>
              ) : null}

              <button type="button" className="echo-pillbtn" onClick={() => setPickerOpen((v) => !v)}>
                {pickerOpen ? "Close" : "Change"}
              </button>
            </div>
          </div>

          {/* Picker */}
          {pickerOpen ? (
            <div className="echo-picker">
              <input
                className="input echo-pickerinput"
                placeholder="Search items…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />

              <div className="echo-results">
                {searching ? <div className="echo-muted">Searching…</div> : null}
                {!searching && searchResults.length === 0 ? <div className="echo-muted">No results.</div> : null}

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
                        <img className="echo-resultthumb" src={it.image_url} alt="" />
                      ) : (
                        <div className="echo-resultthumb echo-thumb--empty" />
                      )}

                      <div className="echo-resulttext">
                        <div className="echo-resulttitle">{it.title}</div>
                        <div className="echo-resultmeta">{it.kind}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          {/* Echo textarea */}
          <div className="echo-kicker">YOUR ECHO</div>
          <textarea
            className="echo-textarea"
            placeholder="What did this help you feel or do? What changed in you?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
          />

          {/* Tags */}
          <div className="echo-kicker">TAGS</div>
          <div className="echo-chips">
            {QUICK_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`echo-chip ${effectiveTag === t ? "is-active" : ""}`}
                onClick={() => {
                  setUsageTag(t);
                  setCustomTag("");
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <input
            className="input echo-taginput"
            placeholder="Or type your own tag…"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onFocus={() => setUsageTag("")}
          />

          <div className="echo-help">
            {effectiveTag ? `Using: ${effectiveTag}` : "Pick a tag."}
          </div>

          {/* Options */}
          <div className="echo-options">
            <label className="echo-check">
              <input type="checkbox" checked={privateOnly} onChange={(e) => setPrivateOnly(e.target.checked)} />
              Private-only
            </label>

            <label className={`echo-check ${!shareAllowed ? "is-disabled" : ""}`}>
              <input
                type="checkbox"
                checked={shareToWaves}
                disabled={!shareAllowed}
                onChange={(e) => setShareToWaves(e.target.checked)}
              />
              Share to Waves
            </label>
          </div>

          {/* CTA */}
          {err ? <div className="echo-alert">{err}</div> : null}

          <button type="button" className="echo-primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save this moment"}
          </button>
        </Card>

        {/* Saved Echoes */}
        <div className="echo-savedhead">
          <div className="echo-savedtitle">Saved Echoes</div>
          <div className="echo-date">{today}</div>
        </div>

        {loadingSaved ? (
          <div className="echo-muted">Loading…</div>
        ) : saved.length === 0 ? (
          <Card className="echo-savedcard">
            <div className="echo-empty">
              Your reflections will live here. Start by saving how something made you feel.
            </div>
          </Card>
        ) : (
          grouped.map(([dateKey, rows]) => (
            <div key={dateKey} className="echo-day">
              <div className="echo-daylabel">{dayLabel(dateKey)}</div>

              {rows.map((r) => {
                const title = r.content_items?.title || "Untitled";
                const kind = r.content_items?.kind || "";
                const tag = r.usage_tag || "";
                const shared = r.shared_to_waves ? "shared" : "private";

                return (
                  <Card key={r.id} className="echo-savedcard">
                    <div className="echo-entrytop">
                      <div className="echo-entryleft">
                        <span className="echo-tagpill">{tag}</span>
                        <span className="echo-entrytitle">{title}</span>
                      </div>

                      <button type="button" className="btn-ghost" onClick={() => onDelete(r.id)}>
                        Delete
                      </button>
                    </div>

                    {r.note ? <div className="echo-entrynote">{r.note}</div> : null}

                    <div className="echo-entrymeta">
                      {kind ? `${kind} • ` : ""}
                      {shared}
                    </div>
                  </Card>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}













