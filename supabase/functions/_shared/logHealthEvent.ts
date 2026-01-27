// Shared helper for logging health events to system_health_events table
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface HealthEventParams {
  jobName: string;
  status: "ok" | "fail";
  durationMs?: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log a health event to system_health_events table
 * Uses RPC function log_health_event for convenience
 */
export async function logHealthEvent(
  supabase: SupabaseClient,
  params: HealthEventParams
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_health_event", {
      p_job_name: params.jobName,
      p_status: params.status,
      p_duration_ms: params.durationMs ?? null,
      p_error_message: params.errorMessage ?? null,
      p_metadata: params.metadata ?? {},
    });

    if (error) {
      console.error(`[logHealthEvent] Failed to log event for ${params.jobName}:`, error);
    }
  } catch (e) {
    console.error(`[logHealthEvent] Exception logging event for ${params.jobName}:`, e);
  }
}
