/**
 * Consistent page state components
 * 
 * Loading, Empty, and Error states for data-fetching pages
 */

import React from "react";
import Card from "../../ui/Card";
import type { FetchError } from "../../lib/supabaseFetch";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        padding: "48px 24px",
      }}
    >
      <Card
        style={{
          padding: "48px 32px",
          textAlign: "center",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid var(--border, #e0e0e0)",
            borderTopColor: "var(--coral, #FF6B9D)",
            borderRadius: "50%",
            margin: "0 auto 24px",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "var(--ink-muted, #666666)", fontSize: "16px", margin: 0 }}>
          {message}
        </p>
      </Card>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = "No items found",
  message = "There's nothing here yet.",
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        padding: "48px 24px",
      }}
    >
      <Card
        style={{
          padding: "48px 32px",
          textAlign: "center",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "64px", marginBottom: "24px", opacity: 0.4 }}>
          📭
        </div>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--ink, #000000)",
            marginBottom: "12px",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.6,
            color: "var(--ink-muted, #666666)",
            marginBottom: action ? "24px" : 0,
          }}
        >
          {message}
        </p>
        {action && (
          <button className="btn" type="button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </Card>
    </div>
  );
}

interface ErrorStateProps {
  error: FetchError | string;
  title?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
  onGoHome,
}: ErrorStateProps) {
  const errorMessage = typeof error === "string" ? error : error.message;
  const requestId = typeof error === "object" ? error.requestId : undefined;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        padding: "48px 24px",
      }}
    >
      <Card
        style={{
          padding: "48px 32px",
          textAlign: "center",
          maxWidth: "500px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "64px", marginBottom: "24px", opacity: 0.6 }}>
          ⚠️
        </div>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--ink, #000000)",
            marginBottom: "12px",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.6,
            color: "var(--ink-muted, #666666)",
            marginBottom: "24px",
          }}
        >
          {errorMessage}
        </p>

        {requestId && import.meta.env.DEV && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--ink-tertiary, #999999)",
              marginBottom: "24px",
              fontFamily: "monospace",
            }}
          >
            Request ID: {requestId}
          </p>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {onRetry && (
            <button className="btn" type="button" onClick={onRetry}>
              Try Again
            </button>
          )}
          {onGoHome && (
            <button
              className="btn"
              type="button"
              onClick={onGoHome}
              style={{ background: "var(--surface-2, #f5f5f5)" }}
            >
              Go Home
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
