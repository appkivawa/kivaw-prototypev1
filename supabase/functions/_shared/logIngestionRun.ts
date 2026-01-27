// supabase/functions/_shared/logIngestionRun.ts
// Helper function to log ingestion runs to ingestion_runs table

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface IngestionRunParams {
  jobName: string;
  status: "running" | "ok" | "fail";
  startedAt: string; // ISO timestamp
  finishedAt?: string; // ISO timestamp
  durationMs?: number;
  errorMessage?: string | null;
  feedsProcessed?: number;
  itemsFetched?: number;
  itemsUpserted?: number;
  itemsSkipped?: number;
  metadata?: Record<string, unknown>;
}

export async function logIngestionRun(
  supabase: ReturnType<typeof createClient>,
  params: IngestionRunParams
): Promise<void> {
  try {
    const { error } = await supabase
      .from("ingestion_runs")
      .insert({
        job_name: params.jobName,
        started_at: params.startedAt,
        finished_at: params.finishedAt || null,
        status: params.status,
        error_message: params.errorMessage || null,
        duration_ms: params.durationMs || null,
        feeds_processed: params.feedsProcessed || 0,
        items_fetched: params.itemsFetched || 0,
        items_upserted: params.itemsUpserted || 0,
        items_skipped: params.itemsSkipped || 0,
        metadata: params.metadata || {},
      });

    if (error) {
      console.error(`[logIngestionRun] Failed to log run for ${params.jobName}:`, error);
    }
  } catch (e) {
    console.error(`[logIngestionRun] Exception logging run for ${params.jobName}:`, e);
  }
}
