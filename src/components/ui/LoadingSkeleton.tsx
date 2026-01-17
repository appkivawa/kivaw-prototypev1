// src/components/ui/LoadingSkeleton.tsx
// Loading skeleton for cards and content grids

import React from "react";
import Card from "../../ui/Card";

interface LoadingSkeletonProps {
  count?: number;
  type?: "card" | "grid" | "list";
}

export default function LoadingSkeleton({ count = 6, type = "card" }: LoadingSkeletonProps) {
  if (type === "grid") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} style={{ padding: "20px" }}>
            <div
              style={{
                width: "100%",
                height: "200px",
                background: "#E5E7EB",
                borderRadius: "8px",
                marginBottom: "12px",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
            <div
              style={{
                width: "80%",
                height: "24px",
                background: "#E5E7EB",
                borderRadius: "4px",
                marginBottom: "8px",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
            <div
              style={{
                width: "60%",
                height: "16px",
                background: "#E5E7EB",
                borderRadius: "4px",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          </Card>
        ))}
      </div>
    );
  }

  if (type === "list") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} style={{ padding: "16px" }}>
            <div
              style={{
                width: "70%",
                height: "20px",
                background: "#E5E7EB",
                borderRadius: "4px",
                marginBottom: "8px",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
            <div
              style={{
                width: "50%",
                height: "16px",
                background: "#E5E7EB",
                borderRadius: "4px",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          </Card>
        ))}
      </div>
    );
  }

  // Default: card
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} style={{ padding: "20px" }}>
          <div
            style={{
              width: "100%",
              height: "200px",
              background: "#E5E7EB",
              borderRadius: "8px",
              marginBottom: "12px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <div
            style={{
              width: "80%",
              height: "24px",
              background: "#E5E7EB",
              borderRadius: "4px",
              marginBottom: "8px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <div
            style={{
              width: "60%",
              height: "16px",
              background: "#E5E7EB",
              borderRadius: "4px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </Card>
      ))}
    </div>
  );
}

