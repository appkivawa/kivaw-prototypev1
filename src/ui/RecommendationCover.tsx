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
    
    // Type-specific gradient families for visual variety
    const gradientFamilies: Record<string, string[]> = {
      watch: [
        "linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #e0e7ff 100%)",
        "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)",
        "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #93c5fd 100%)",
      ],
      read: [
        "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)",
        "linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fecaca 100%)",
        "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
      ],
      event: [
        "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #93c5fd 100%)",
        "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)",
        "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #60a5fa 100%)",
      ],
      listen: [
        "linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 50%, #c4b5fd 100%)",
        "linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 50%, #d8b4fe 100%)",
        "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%)",
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

