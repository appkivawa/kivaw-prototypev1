import React from "react";
import { useJobRuns } from "../../hooks/useJobRuns";

type FeedUpdateStatusProps = {
  jobName: "rss_ingest" | "movies_ingest";
  staleThresholdMinutes?: number;
  className?: string;
};

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";

  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 0) return "Just now";

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  return `${diffWeeks} weeks ago`;
}

function isStale(lastRunAt: string | null, thresholdMinutes: number): boolean {
  if (!lastRunAt) return true;

  const date = new Date(lastRunAt);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  return diffMins > thresholdMinutes;
}

export default function FeedUpdateStatus({ jobName, staleThresholdMinutes = 30, className = "" }: FeedUpdateStatusProps) {
  const { rss_ingest, movies_ingest, loading } = useJobRuns();

  const jobRun = jobName === "rss_ingest" ? rss_ingest : movies_ingest;
  const lastRunAt = jobRun?.last_run_at || null;
  const status = jobRun?.status || null;

  // Show "Refreshing..." if:
  // - Loading
  // - last_run_at is null
  // - Status is "running"
  // - Data is stale (older than threshold)
  const isRefreshing =
    loading ||
    !lastRunAt ||
    status === "running" ||
    isStale(lastRunAt, staleThresholdMinutes);

  if (isRefreshing) {
    return (
      <span className={className} style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
        Refreshing…
      </span>
    );
  }

  return (
    <span className={className} style={{ fontSize: "13px", color: "var(--text-muted)" }}>
      Updated {formatRelativeTime(lastRunAt)} ago
    </span>
  );
}




