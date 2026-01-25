import React, { useState } from "react";
import EchoComposer from "../echo/EchoComposer";
import { showToast } from "../ui/Toast";

type ExploreCard = {
  id: string;
  kind: string;
  title: string;
  byline?: string | null;
  image_url?: string | null;
  url?: string | null;
  source?: string;
  meta?: Record<string, unknown> | null;
};

type ExploreCardWithEchoProps = {
  card: ExploreCard;
  children: React.ReactNode;
};

export default function ExploreCardWithEcho({ card, children }: ExploreCardWithEchoProps) {
  const [showEchoComposer, setShowEchoComposer] = useState(false);

  return (
    <div>
      {children}
      {/* Inline Echo Composer below card */}
      {showEchoComposer && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid var(--border-strong)",
            backgroundColor: "var(--surface)",
          }}
        >
          <EchoComposer
            contentId={card.id}
            inline={true}
            onClose={() => setShowEchoComposer(false)}
            onSaved={() => {
              setShowEchoComposer(false);
              showToast("Saved to Timeline");
            }}
          />
        </div>
      )}
      {/* Echo button */}
      <div style={{ marginTop: "12px", textAlign: "center" }}>
        <button
          onClick={() => setShowEchoComposer(!showEchoComposer)}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--border-strong)",
            background: showEchoComposer ? "var(--border)" : "transparent",
            cursor: "pointer",
            fontSize: "13px",
            color: "var(--ink-muted)",
          }}
        >
          💭 Echo
        </button>
      </div>
    </div>
  );
}





