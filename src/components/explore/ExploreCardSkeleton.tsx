import React from "react";

export default function ExploreCardSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "3/4",
          backgroundColor: "var(--border)",
          backgroundImage: "linear-gradient(90deg, var(--border) 0%, var(--border-strong) 50%, var(--border) 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div style={{ padding: "12px" }}>
        <div
          style={{
            height: "16px",
            backgroundColor: "var(--border)",
            borderRadius: "4px",
            marginBottom: "8px",
            width: "80%",
          }}
        />
        <div
          style={{
            height: "12px",
            backgroundColor: "var(--border)",
            borderRadius: "4px",
            marginBottom: "4px",
            width: "60%",
          }}
        />
        <div
          style={{
            height: "10px",
            backgroundColor: "var(--border)",
            borderRadius: "4px",
            width: "40%",
          }}
        />
      </div>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}





