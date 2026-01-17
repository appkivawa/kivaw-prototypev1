import { useMemo } from "react";

type RecommendationCoverProps = {
  type: "watch" | "read" | "event" | "listen";
  imageUrl?: string | null;
  title: string;
  className?: string;
  height?: number | string;
  showImage?: boolean; // If false, imageUrl will be ignored (for future use)
};


// Type emojis
const TYPE_EMOJI: Record<string, string> = {
  watch: "🎬",
  read: "📖",
  event: "🎪",
  listen: "🎧",
};

export default function RecommendationCover({
  type,
  imageUrl,
  title,
  className = "",
  height = 120,
  showImage = true, // Default to true for backward compatibility
}: RecommendationCoverProps) {
  const emoji = TYPE_EMOJI[type] || "✨";

  // Generate a stable gradient variant based on title hash for visual variety
  const gradientVariant = useMemo(() => {
    // Simple hash of title to pick a variant within the type's color family
    const hash = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Type-specific gradient families - warm beige/cream tones
    const gradientFamilies: Record<string, string[]> = {
      watch: [
        "linear-gradient(135deg, #F5F0EA 0%, #E8E0D6 50%, #D4C4B0 100%)",
        "linear-gradient(135deg, #FAF8F4 0%, #F0EAE0 50%, #E8E0D6 100%)",
        "linear-gradient(135deg, #E8E0D6 0%, #D4C4B0 50%, #C4B09A 100%)",
      ],
      read: [
        "linear-gradient(135deg, #FAF8F4 0%, #F0EAE0 50%, #E8E0D6 100%)",
        "linear-gradient(135deg, #F5F0EA 0%, #E8E0D6 50%, #D4C4B0 100%)",
        "linear-gradient(135deg, #F0EAE0 0%, #E8E0D6 50%, #D4C4B0 100%)",
      ],
      event: [
        "linear-gradient(135deg, #E8E0D6 0%, #D4C4B0 50%, #C4B09A 100%)",
        "linear-gradient(135deg, #F0EAE0 0%, #E8E0D6 50%, #D4C4B0 100%)",
        "linear-gradient(135deg, #E8E0D6 0%, #D4C4B0 50%, #C4B09A 100%)",
      ],
      listen: [
        "linear-gradient(135deg, #F5F0EA 0%, #E8E0D6 50%, #D4C4B0 100%)",
        "linear-gradient(135deg, #FAF8F4 0%, #F0EAE0 50%, #E8E0D6 100%)",
        "linear-gradient(135deg, #F0EAE0 0%, #E8E0D6 50%, #D4C4B0 100%)",
      ],
    };
    
    const family = gradientFamilies[type] || gradientFamilies.watch;
    return family[hash % family.length];
  }, [title, type]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: 8,
        overflow: "hidden",
        background: gradientVariant,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Blurred background image if provided and showImage is true */}
      {showImage && imageUrl && (
        <>
          <img
            src={imageUrl}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(20px) brightness(0.4)",
              transform: "scale(1.1)", // Slight scale to avoid blur edges
              opacity: 0.3,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {/* Heavy overlay to ensure image is never dominant */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(255, 255, 255, 0.7)",
              mixBlendMode: "overlay",
            }}
          />
        </>
      )}

      {/* Light grain texture overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
          opacity: 0.4,
          pointerEvents: "none",
        }}
      />

      {/* Emoji icon */}
      <div
        style={{
          position: "relative",
          fontSize: 32,
          opacity: 0.6,
          zIndex: 1,
        }}
        aria-hidden="true"
      >
        {emoji}
      </div>
    </div>
  );
}

