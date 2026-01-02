import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { listContentItems } from "../data/contentApi";
import { fetchSavedIds, unsaveItem } from "../data/savesApi";
import type { ContentItem } from "../data/contentApi";

export default function Explore() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [content, saved] = await Promise.all([
          listContentItems({ limit: 60 }),
          fetchSavedIds(),
        ]);
        setItems(content);
        setSavedIds(saved);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function removeSaved(id: string) {
    await unsaveItem(id);
    const updated = await fetchSavedIds();
    setSavedIds(updated);
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center">
          <h1>Explore</h1>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="kivaw-rec-grid">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="kivaw-rec-card"
                  onClick={() => navigate(`/item/${item.id}`)}
                >
                  <div className="kivaw-rec-meta">
                    {item.kind || "Item"}
                  </div>

                  <div className="kivaw-rec-name">{item.title}</div>

                  {savedIds.includes(item.id) && (
                    <button
                      className="btn btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSaved(item.id);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}




















