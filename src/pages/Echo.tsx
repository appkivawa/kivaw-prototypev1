import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";
import {
  createEcho,
  deleteEcho,
  getContentItemLiteById,
  listMyEchoes,
  listContentItemsLite,
  type ContentItemLite,
  type EchoWithContent,
} from "../data/echoApi";
import "./echo.css";

/* ---------------- helpers ---------------- */

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const DEFAULT_TAGS = ["focus", "unwind", "study", "heal", "reset", "laugh"] as const;

type DraftEcho = {
  contentId: string | null; // optional linked item
  usageTag: string;
  note?: string;
  shareToWaves?: boolean;
};

/**
 * Persist the echo draft across magic-link redirect AND across tabs/windows.
 */
const PENDING_ECHO_KEY = "kivaw_pending_echo_v1";
const POST_AUTH_PATH_KEY = "kivaw_post_auth_path";

function setPendingEcho(draft: DraftEcho) {
  localStorage.setItem(PENDING_ECHO_KEY, JSON.stringify(draft));
}

function getPendingEcho(): DraftEcho | null {
  const raw = localStorage.getItem(PENDING_ECHO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftEcho;
  } catch {
    localStorage.removeItem(PENDING_ECHO_KEY);
    return null;
  }
}

function clearPendingEcho() {
  localStorage.removeItem(PENDING_ECHO_KEY);
}

/**
 * ✅ Return-path builder that works for BOTH:
 * - HashRouter URLs:   /#/echo
 * - BrowserRouter URLs: /echo
 */
function getCurrentAppPath() {
  const hash = window.location.hash || "";
  if (hash.startsWith("#/")) return hash.slice(1); // "/echo"
  return window.location.pathname + window.location.search; // "/echo?x=y"
}

/**
 * ✅ Stable auth redirect builder
 * - Prefer explicit deployed URL (set in Vercel as VITE_PUBLIC_SITE_URL="https://www.kivaw.com")
 * - Fall back to current origin for local dev
 */
function getAuthRedirectTo() {
  const site = (import.meta as any).env?.VITE_PUBLIC_SITE_URL?.trim?.() || window.location.origin;
  return new URL("/auth/callback", site).toString();
}

function kindIcon(kind?: string | null) {
  const k = (kind || "").toLowerCase();
  if (k.includes("playlist")) return "🎵";
  if (k.includes("album")) return "💿";
  if (k.includes("practice")) return "🧩";
  if (k.includes("reflection")) return "📝";
  if (k.includes("prompt")) return "💭";
  if (k.includes("movement")) return "🏃";
  if (k.includes("exercise")) return "🏋️";
  if (k.includes("creative")) return "🎨";
  if (k.includes("visual")) return "🖼️";
  if (k.includes("concert")) return "🎫";
  if (k.includes("book")) return "📚";
  if (k.includes("aesthetic")) return "✨";
  return "🔖";
}

/* ---------------- Save gate (guest → magic link) ---------------- */

function SaveGateModal({
  open,
  draft,
  onClose,
}: {
  open: boolean;
  draft: DraftEcho | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"prompt" | "email" | "sent">("prompt");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("prompt");
      setEmail("");
      setBusy(false);
      setErr(null);
    }
  }, [open]);

  if (!open || !draft) return null;

  async function sendMagicLink() {
    if (!email.trim()) return;

    setBusy(true);
    setErr(null);

    try {
      // ✅ Remember where to return after auth (works with HashRouter too)
      localStorage.setItem(POST_AUTH_PATH_KEY, getCurrentAppPath());

      const redirectTo = getAuthRedirectTo();

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;
      setStep("sent");
    } catch (e: any) {
      setErr(e?.message || "Could not send link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="echo-modal-backdrop" role="dialog" aria-modal="true">
      <Card className="echo-modal">
        <div className="echo-modal-head">
          <div>
            <div className="echo-modal-title">
              {step === "prompt"
                ? "Keep this echo?"
                : step === "email"
                ? "Continue"
                : "Check your email"}
            </div>
            <div className="echo-modal-sub">
              {step === "prompt" && "We can save this so it’s here when you come back."}
              {step === "email" && "No passwords. Just a link back to this echo."}
              {step === "sent" && "Tap the link we sent you, then return here."}
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="echo-modal-body">
          {step === "prompt" && (
            <div className="echo-modal-actions">
              <button className="echo-primary" onClick={() => setStep("email")} type="button">
                Keep this echo
              </button>
              <button className="btn-ghost" onClick={onClose} type="button">
                Not now
              </button>
            </div>
          )}

          {step === "email" && (
            <>
              <div className="echo-muted" style={{ marginBottom: 6 }}>
                Email
              </div>
              <input
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              {err && (
                <div className="echo-alert" style={{ marginTop: 10 }}>
                  {err}
                </div>
              )}

              <div className="echo-modal-actions" style={{ marginTop: 12 }}>
                <button
                  className="echo-primary"
                  disabled={busy || !email.trim()}
                  onClick={sendMagicLink}
                  type="button"
                >
                  {busy ? "Sending…" : "Send magic link →"}
                </button>
                <button className="btn-ghost" onClick={() => setStep("prompt")} type="button">
                  Back
                </button>
              </div>

              <div className="echo-muted" style={{ marginTop: 12 }}>
                Tip: check Promotions/Spam if your inbox plays hard to get.
              </div>
            </>
          )}

          {step === "sent" && (
            <div className="echo-modal-actions">
              <button className="echo-primary" onClick={onClose} type="button">
                Done
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Link item picker ---------------- */

function LinkItemModal({
  open,
  onClose,
  onPick,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: ContentItemLite) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ContentItemLite[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setItems([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    setBusy(true);
    listContentItemsLite({ q, limit: 80 })
      .then((rows) => {
        if (!alive) return;
        setItems(rows || []);
      })
      .finally(() => {
        if (!alive) return;
        setBusy(false);
      });

    return () => {
      alive = false;
    };
  }, [open, q]);

  if (!open) return null;

  return (
    <div className="echo-modal-backdrop" role="dialog" aria-modal="true">
      <Card className="echo-modal echo-modal--wide">
        <div className="echo-modal-head">
          <div>
            <div className="echo-modal-title">Link an item (optional)</div>
            <div className="echo-modal-sub">Pick one… or keep this moment unlinked.</div>
          </div>
          <button className="btn-ghost" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="echo-modal-body">
          <input
            className="input"
            placeholder="Search items…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div style={{ height: 12 }} />

          {/* ✅ Unlinked option */}
          <button
            type="button"
            className="echo-result"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            <div className="echo-leftslot" aria-hidden="true">
              <div className="echo-kindicon echo-kindicon--selected">🫧</div>
            </div>
            <div className="echo-resulttext">
              <div className="echo-resulttitle">Unlinked moment</div>
              <div className="echo-resultmeta">Save without linking an item</div>
            </div>
          </button>

          <div style={{ height: 10 }} />

          {busy ? (
            <div className="echo-muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="echo-muted">No results.</div>
          ) : (
            /* ✅ Dedicated scroll container so the list ALWAYS scrolls */
            <div className="echo-results-scroll">
              <div className="echo-results">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="echo-result"
                    onClick={() => {
                      onPick(it);
                      onClose();
                    }}
                  >
                    <div className="echo-leftslot" aria-hidden="true">
                      {it.image_url ? (
                        <img className="echo-resultthumb" src={it.image_url} alt="" />
                      ) : (
                        <div className="echo-kindicon">{kindIcon(it.kind)}</div>
                      )}
                    </div>

                    <div className="echo-resulttext">
                      <div className="echo-resulttitle">{it.title}</div>
                      <div className="echo-resultmeta">{it.kind || "Item"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function Echo() {
  const [linked, setLinked] = useState<ContentItemLite | null>(null);

  const [note, setNote] = useState("");
  const [usageTag, setUsageTag] = useState<string>("");
  const [customTag, setCustomTag] = useState("");

  const [saved, setSaved] = useState<EchoWithContent[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);

  const [saveGateOpen, setSaveGateOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftEcho | null>(null);

  const effectiveTag = useMemo(() => {
    const chip = usageTag.trim().replace(/^#/, "");
    const typed = customTag.trim().replace(/^#/, "");
    return chip || typed;
  }, [usageTag, customTag]);

  async function refreshSaved() {
    setLoadingSaved(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSaved([]);
        return;
      }
      const rows = await listMyEchoes(120);
      setSaved(rows || []);
    } finally {
      setLoadingSaved(false);
    }
  }

  async function saveDraft(draft: DraftEcho) {
    setSaving(true);
    setErr(null);
    try {
      await createEcho({
        contentId: draft.contentId, // can be null
        usageTag: draft.usageTag,
        note: draft.note,
        shareToWaves: draft.shareToWaves,
      });

      // clear composer
      setNote("");
      setUsageTag("");
      setCustomTag("");

      await refreshSaved();
    } catch (e: any) {
      setErr(e?.message || "Failed to save echo.");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  // Auto-select linked item from URL: /echo?contentId=...
  useEffect(() => {
    let alive = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const contentId = params.get("contentId");
      if (!contentId) return;

      try {
        const it = await getContentItemLiteById(contentId);
        if (!alive) return;
        if (it) setLinked(it);
      } catch {
        // silent
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    refreshSaved();
  }, []);

  /**
   * ✅ Auto-save after login if a pending draft exists in localStorage.
   */
  useEffect(() => {
    let alive = true;

    async function waitForSession(maxMs = 2000) {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        const { data } = await supabase.auth.getSession();
        if (!alive) return null;
        if (data.session) return data.session;
        await new Promise((r) => setTimeout(r, 200));
      }
      return null;
    }

    async function tryAutoSave() {
      const session = await waitForSession(2000);
      if (!alive) return;
      if (!session) return;

      const draft = getPendingEcho();
      if (!draft) return;

      try {
        await saveDraft(draft);
        clearPendingEcho(); // ✅ only after success
        if (!alive) return;
        setPendingDraft(null);
        setSaveGateOpen(false);
      } catch {
        // keep pending draft so it can try again later
      }
    }

    tryAutoSave();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      tryAutoSave();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    setErr(null);

    if (!effectiveTag) {
      setErr("Pick a tag.");
      return;
    }

    const draft: DraftEcho = {
      contentId: linked?.id ?? null,
      usageTag: effectiveTag,
      note: note.trim(),
    };

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      localStorage.setItem(POST_AUTH_PATH_KEY, getCurrentAppPath());

      setPendingEcho(draft);
      setPendingDraft(draft);
      setSaveGateOpen(true);
      return;
    }

    await saveDraft(draft);
  }

  async function onDeleteEcho(echoId: string) {
    const ok = confirm("Delete this echo?");
    if (!ok) return;

    try {
      await deleteEcho(echoId);
      await refreshSaved();
    } catch (e: any) {
      alert(e?.message || "Could not delete.");
    }
  }

  function clickTag(t: string) {
    setUsageTag(t);
    setCustomTag("");
    setErr(null);
  }

  const linkedTitle = linked ? linked.title : "Unlinked moment";
  const linkedMeta = linked ? linked.kind || "Item" : "Linking is optional.";
  const linkButtonLabel = linked ? "Change" : "Link an item";

  return (
    <div className="page echo-page">
      <div className="center-wrap echo-center">
        <div className="echo-hero">
          <h1 className="echo-h1">Echo</h1>
        </div>

        <Card className="echo-maincard">
          <div className="echo-linkedrow">
            <div className="echo-linkedleft">
              {/* ✅ image if exists, otherwise emoji */}
              {linked?.image_url ? (
                <img className="echo-linkedthumb" src={linked.image_url} alt="" />
              ) : (
                <div className="echo-kindicon echo-kindicon--selected" aria-hidden="true">
                  {linked ? kindIcon(linked.kind) : "🫧"}
                </div>
              )}

              <div className="echo-linkedtext">
                <div className="echo-kicker">LINKED ITEM (OPTIONAL)</div>
                <div className="echo-linkedtitle">{linkedTitle}</div>
                <div className="echo-linkedmeta">{linkedMeta}</div>
              </div>
            </div>

            <div className="echo-linkedactions">
              <button className="echo-pillbtn" type="button" onClick={() => setLinkOpen(true)}>
                {linkButtonLabel}
              </button>
            </div>
          </div>

          <textarea
            className="echo-textarea"
            placeholder="What changed in you?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="echo-chips">
            {DEFAULT_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={cls("echo-chip", usageTag === t && "is-active")}
                onClick={() => clickTag(t)}
              >
                #{t}
              </button>
            ))}
          </div>

          <input
            className="input"
            placeholder="Or your own tag…"
            value={customTag}
            onChange={(e) => {
              setCustomTag(e.target.value);
              if (e.target.value.trim()) setUsageTag("");
              setErr(null);
            }}
          />

          {err ? <div className="echo-alert">{err}</div> : null}

          <button className="echo-primary" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save this moment"}
          </button>
        </Card>

        <div className="echo-savedhead">
          <div className="echo-savedtitle">Saved Echoes</div>
        </div>

        {loadingSaved ? (
          <div className="echo-muted">Loading…</div>
        ) : saved.length === 0 ? (
          <div className="echo-empty">No saved echoes yet.</div>
        ) : (
          <div className="echo-day">
            {saved.map((e) => {
              const it = e.content_items;
              return (
                <Card key={e.id} className="echo-savedcard">
                  <div className="echo-entrytop">
                    <div className="echo-entryleft">
                      <span className="echo-tagpill">{e.usage_tag ? `#${e.usage_tag}` : "—"}</span>
                      <div className="echo-entrytitle">{it?.title || "Unlinked moment"}</div>
                    </div>

                    <button className="btn-ghost" type="button" onClick={() => onDeleteEcho(e.id)}>
                      Delete
                    </button>
                  </div>

                  {e.note ? <div className="echo-entrynote">{e.note}</div> : null}

                  <div className="echo-entrymeta">
                    {it?.kind ? `${it.kind} • ` : ""}
                    {e.shared_to_waves ? "shared" : "private"}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <LinkItemModal
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          onPick={setLinked}
          onClear={() => setLinked(null)}
        />

        <SaveGateModal open={saveGateOpen} draft={pendingDraft} onClose={() => setSaveGateOpen(false)} />
      </div>
    </div>
  );
}



























