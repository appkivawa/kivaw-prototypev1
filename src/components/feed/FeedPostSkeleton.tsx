import React from "react";

export default function FeedPostSkeleton() {
  return (
    <article
      style={{
        maxWidth: "680px",
        width: "100%",
        margin: "0 auto 24px",
        padding: "20px",
        borderRadius: "8px",
        border: "1px solid rgba(0,0,0,0.08)",
        backgroundColor: "rgba(255,255,255,0.9)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header Skeleton */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.1)",
            }}
          />
          <div
            style={{
              width: "60px",
              height: "14px",
              borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.1)",
            }}
          />
          <div
            style={{
              width: "40px",
              height: "12px",
              borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.08)",
            }}
          />
        </div>
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            backgroundColor: "rgba(0,0,0,0.05)",
          }}
        />
      </div>

      {/* Image Skeleton */}
      <div
        style={{
          width: "100%",
          paddingTop: "56.25%",
          marginBottom: "16px",
          borderRadius: "6px",
          backgroundColor: "rgba(0,0,0,0.04)",
          backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.02) 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />

      {/* Title Skeleton */}
      <div
        style={{
          width: "85%",
          height: "24px",
          borderRadius: "4px",
          backgroundColor: "rgba(0,0,0,0.08)",
          marginBottom: "12px",
        }}
      />

      {/* Summary Skeleton */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            width: "100%",
            height: "16px",
            borderRadius: "4px",
            backgroundColor: "rgba(0,0,0,0.06)",
            marginBottom: "8px",
          }}
        />
        <div
          style={{
            width: "90%",
            height: "16px",
            borderRadius: "4px",
            backgroundColor: "rgba(0,0,0,0.06)",
            marginBottom: "8px",
          }}
        />
        <div
          style={{
            width: "75%",
            height: "16px",
            borderRadius: "4px",
            backgroundColor: "rgba(0,0,0,0.06)",
          }}
        />
      </div>

      {/* Footer Skeleton */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: "50px",
              height: "20px",
              borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.05)",
            }}
          />
        ))}
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
    </article>
  );
}





