import React, { Component, ErrorInfo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./Card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in all environments
    console.error("[ErrorBoundary] Component crashed:", error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send to error tracking service
    if (import.meta.env.PROD) {
      // Example: sendToErrorTracking(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/studio";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReload: () => void;
  onGoHome: () => void;
}

function ErrorFallback({ error, errorInfo, onReload, onGoHome }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const isDev = import.meta.env.DEV;

  const errorMessage = error?.message || "An unexpected error occurred";
  const errorStack = error?.stack || "";
  const componentStack = errorInfo?.componentStack || "";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--surface-1, #ffffff)",
      }}
    >
      <Card
        style={{
          maxWidth: "600px",
          width: "100%",
          padding: "48px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "64px", marginBottom: "24px", opacity: 0.6 }}>
          💥
        </div>

        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--ink, #000000)",
            marginBottom: "12px",
            lineHeight: 1.2,
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: "17px",
            lineHeight: 1.6,
            marginBottom: "32px",
            color: "var(--ink-muted, #666666)",
          }}
        >
          {errorMessage}
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "24px" }}>
          <button
            className="btn"
            type="button"
            onClick={onReload}
            style={{ minWidth: "120px" }}
          >
            Reload Page
          </button>
          <button
            className="btn"
            type="button"
            onClick={onGoHome}
            style={{ minWidth: "120px", background: "var(--surface-2, #f5f5f5)" }}
          >
            Go Home
          </button>
        </div>

        {isDev && (errorStack || componentStack) && (
          <div style={{ marginTop: "32px", textAlign: "left" }}>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--surface-2, #f5f5f5)",
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                marginBottom: showDetails ? "12px" : 0,
              }}
            >
              {showDetails ? "▼" : "▶"} Debug Details {showDetails ? "(hide)" : "(show)"}
            </button>

            {showDetails && (
              <div
                style={{
                  padding: "16px",
                  background: "var(--surface-2, #f5f5f5)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  maxHeight: "400px",
                  overflow: "auto",
                }}
              >
                {errorStack && (
                  <div style={{ marginBottom: "16px" }}>
                    <strong style={{ display: "block", marginBottom: "8px" }}>Error Stack:</strong>
                    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                      {errorStack}
                    </pre>
                  </div>
                )}

                {componentStack && (
                  <div>
                    <strong style={{ display: "block", marginBottom: "8px" }}>Component Stack:</strong>
                    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                      {componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p
          style={{
            fontSize: "14px",
            color: "var(--ink-tertiary, #999999)",
            marginTop: "24px",
          }}
        >
          If this problem persists, please contact support.
        </p>
      </Card>
    </div>
  );
}