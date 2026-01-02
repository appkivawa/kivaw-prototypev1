// src/pages/Explore.tsx
import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import { listContentItems, readMySavedIds, toggleSavedForItem } from "../data/contentApi";

type ContentItem = {
  id: string;
  title: string;
  kind?: string;
  category?: string;
  source?: string;
  icon?: string;
  tags?: string[];
};

function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

export default function Explore() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      const [all, savedIds] = await Promise.all([listContentItems(), readMySavedIds()]);
      if (!alive) return;
      setItems(all);
      setSaved(new Set(savedIds));
    })();

    return () => {
      alive = false;
    };
  }, []);

  const kinds = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.kind) set.add(it.kind);
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    const q = norm(query);
    return items.filter((it) => {
      const matchesKind = kindFilter === "All" ? true : it.kind === kindFilter;

      if (!q) return matchesKind;

      const hay = [
        it.title,
        it.kind,
        it.category,
        it.source,
        ...(it.tags ?? []),
      ]
        .map(norm)
        .join(" ");

      return matchesKind && hay.includes(q);
    });
  }, [items, kindFilter, query]);

  async function onToggleSave(id: string) {
    const next = new Set(saved);
    // optimistic UI
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSaved(next);

    try {
      const isSaved = await toggleSavedForItem(id);
      const corrected = new Set(saved);
      if (isSaved) corrected.add(id);
      else corrected.delete(id);
      setSaved(corrected);
    } catch {
      // revert on error
      setSaved(saved);
    }
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <div className="page-head">
          <h1 className="h1">Explore</h1>
          <p className="subtle">Browse and save what resonates.</p>
        </div>

        <Card className="card pad">
          <div className="explore-controls">
            <select
              className="input"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              aria-label="Filter"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search"
            />
          </div>

          <div className="grid">
            {filtered.map((it) => {
              const isSaved = saved.has(it.id);

              return (
                <div key={it.id} className="tile">
                  <div className="tile__icon">{it.icon ?? "✦"}</div>

                  <div className="tile__body">
                    <div className="tile__meta">
                      {(it.kind ?? "Item") + (it.category ? ` • ${it.category}` : "")}
                    </div>
                    <div className="tile__title">{it.title}</div>
                    <div className="tile__source">{it.source ?? "Kivaw"}</div>
                  </div>

                  <button
                    className={"save-btn" + (isSaved ? " is-saved" : "")}
                    type="button"
                    onClick={() => onToggleSave(it.id)}
                    aria-label={isSaved ? "Unsave" : "Save"}
                    title={isSaved ? "Saved" : "Save"}
                  >
                    {isSaved ? "♥" : "♡"}
                  </button>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="empty">No matches. Try a different filter or search.</div>
          )}
        </Card>
      </div>
    </div>
  );
}


















