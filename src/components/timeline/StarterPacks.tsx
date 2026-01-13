import React from "react";
import { useNavigate } from "react-router-dom";

export type StarterPack = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  filters: {
    categories?: string[];
    tags?: string[];
    sources?: string[];
  };
};

const STARTER_PACKS: StarterPack[] = [
  {
    id: "startup-brain",
    title: "Startup Brain",
    emoji: "🚀",
    description: "Tech, startups, and innovation",
    filters: {
      categories: ["tech"],
      tags: ["startup", "tech", "innovation", "ai", "engineering"],
    },
  },
  {
    id: "cozy-reset",
    title: "Cozy Reset",
    emoji: "☕",
    description: "Comfort reads and feel-good content",
    filters: {
      tags: ["cozy", "comfort", "feel-good", "healing", "warm"],
    },
  },
  {
    id: "music-discovery",
    title: "Music Discovery",
    emoji: "🎵",
    description: "New albums, artists, and reviews",
    filters: {
      categories: ["music"],
      tags: ["music", "album", "artist", "review"],
    },
  },
  {
    id: "film-night",
    title: "Film Night",
    emoji: "🎬",
    description: "Movies and TV recommendations",
    filters: {
      categories: ["culture"],
      tags: ["film", "movie", "tv", "cinema", "entertainment"],
    },
  },
  {
    id: "money-markets",
    title: "Money & Markets",
    emoji: "💰",
    description: "Finance, investing, and economics",
    filters: {
      categories: ["finance"],
      tags: ["finance", "money", "investing", "markets", "economy"],
    },
  },
  {
    id: "deep-dives",
    title: "Deep Dives",
    emoji: "🔍",
    description: "Long-form reads and analysis",
    filters: {
      tags: ["analysis", "long-read", "deep-dive", "investigation"],
    },
  },
  {
    id: "internet-culture",
    title: "Internet Culture",
    emoji: "🌐",
    description: "Meme culture, trends, and digital life",
    filters: {
      categories: ["culture"],
      tags: ["internet", "culture", "meme", "trends", "digital"],
    },
  },
  {
    id: "wellness",
    title: "Wellness",
    emoji: "🧘",
    description: "Health, mindfulness, and self-care",
    filters: {
      tags: ["wellness", "health", "mindfulness", "self-care", "meditation"],
    },
  },
];

type StarterPacksProps = {
  onPackClick?: (pack: StarterPack) => void;
};

export default function StarterPacks({ onPackClick }: StarterPacksProps) {
  const navigate = useNavigate();

  function handlePackClick(pack: StarterPack) {
    if (onPackClick) {
      onPackClick(pack);
    } else {
      // Navigate to Discover with filters applied
      const params = new URLSearchParams();
      if (pack.filters.categories) {
        params.set("categories", pack.filters.categories.join(","));
      }
      if (pack.filters.tags) {
        params.set("tags", pack.filters.tags.join(","));
      }
      if (pack.filters.sources) {
        params.set("sources", pack.filters.sources.join(","));
      }
      navigate(`/feed?${params.toString()}`);
    }
  }

  return (
    <div>
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: "12px",
        }}
      >
        Starter Packs
      </h3>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {STARTER_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => handlePackClick(pack)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "20px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--ink)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--control-bg)";
              e.currentTarget.style.borderColor = "var(--border-strong)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span style={{ fontSize: "16px" }}>{pack.emoji}</span>
            <span>{pack.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { STARTER_PACKS };

