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
  contentId: string;
  usageTag: string;
  note?: string;
  shareToWaves?: boolean;
};

/**
 * ✅ Persist the echo draft across magic-link redirect AND across tabs/windows.
 * sessionStorage dies when the link opens in a new tab; localStorage survives.
 */
const PENDING_ECHO_KEY = "kivaw_pending_echo_v1";

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
      const { error } = await supabase.auth.signInWithOtp({
        email,
        // ✅ IMPORTANT: callback route exchanges PKCE code so app doesn’t “break”
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
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
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: ContentItemLite) => void;
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
    listContentItemsLite({ q, limit: 40 })
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
            <div className="echo-modal-title">Change linked item</div>
            <div className="echo-modal-sub">Search and pick a new one.</div>
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

          {busy ? (
            <div className="echo-muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="echo-muted">No results.</div>
          ) : (
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
                  <div className="echo-kindicon" aria-hidden="true">
                    {kindIcon(it.kind)}
                  </div>

                  {it.image_url ? (
                    <img
                      className="echo-resultthumb"
                      src={it.image_url}
                      alt=""
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <div className="echo-resultthumb echo-thumb--empty" />
                  )}

                  <div className="echo-resulttext">
                    <div className="echo-resulttitle">{it.title}</div>
                    <div className="echo-resultmeta">{it.kind || "Item"}</div>
                  </div>
                </button>
              ))}
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
        contentId: draft.contentId,
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
    } finally {
      setSaving(false);
    }
  }

  // ✅ Auto-select linked item from URL: /echo?contentId=...
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
        // fail silently
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
   * Also listens for auth state changes to avoid timing issues.
   */
  useEffect(() => {
    let alive = true;

    async function tryAutoSave() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      if (data.session) {
        const draft = getPendingEcho();
        if (draft) {
          clearPendingEcho();
          await saveDraft(draft);
          setPendingDraft(null);
          setSaveGateOpen(false);
        }
      }
    }

    // run once
    tryAutoSave();

    // run again when auth changes (covers slow session restore)
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

    if (!linked?.id) {
      setErr("Link an item first.");
      return;
    }
    if (!effectiveTag) {
      setErr("Pick a tag.");
      return;
    }

    const draft: DraftEcho = {
      contentId: linked.id,
      usageTag: effectiveTag,
      note: note.trim(),
    };

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // ✅ Persist across redirect + across tabs
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

  return (
    <div className="page echo-page">
      <div className="center-wrap echo-center">
        <div className="echo-hero">
          <h1 className="echo-h1">Echo</h1>
        </div>

        <Card className="echo-maincard">
          <div className="echo-linkedrow">
            <div className="echo-linkedleft">
              <div className="echo-kindicon echo-kindicon--selected" aria-hidden="true">
                {kindIcon(linked?.kind)}
              </div>

              <div className="echo-linkedtext">
                <div className="echo-kicker">LINKED ITEM</div>
                <div className="echo-linkedtitle">{linked ? linked.title : "Pick an item to link"}</div>
                <div className="echo-linkedmeta">
                  {linked ? linked.kind || "Item" : "Click Change to choose."}
                </div>
              </div>
            </div>

            <div className="echo-linkedactions">
              <button className="echo-pillbtn" type="button" onClick={() => setLinkOpen(true)}>
                Change
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
                      <div className="echo-entrytitle">{it?.title || "Linked item"}</div>
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

        <LinkItemModal open={linkOpen} onClose={() => setLinkOpen(false)} onPick={setLinked} />
        <SaveGateModal open={saveGateOpen} draft={pendingDraft} onClose={() => setSaveGateOpen(false)} />
      </div>
    </div>
  );
}




















