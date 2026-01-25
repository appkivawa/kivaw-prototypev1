import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type JobRun = {
  job_name: string;
  last_run_at: string | null;
  status: "success" | "error" | "skipped" | "running";
  error_message: string | null;
  result_summary: Record<string, unknown> | null;
};

type JobRunsData = {
  rss_ingest: JobRun | null;
  movies_ingest: JobRun | null;
  loading: boolean;
};

export function useJobRuns() {
  const [data, setData] = useState<JobRunsData>({
    rss_ingest: null,
    movies_ingest: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function fetchJobRuns() {
      try {
        const { data: jobRuns, error } = await supabase
          .from("job_runs")
          .select("*")
          .in("job_name", ["rss_ingest", "movies_ingest"]);

        if (error) {
          console.warn("[useJobRuns] Error fetching job runs:", error);
          if (mounted) {
            setData({
              rss_ingest: null,
              movies_ingest: null,
              loading: false,
            });
          }
          return;
        }

        if (mounted) {
          const rss = (jobRuns || []).find((j) => j.job_name === "rss_ingest") as JobRun | undefined;
          const movies = (jobRuns || []).find((j) => j.job_name === "movies_ingest") as JobRun | undefined;

          setData({
            rss_ingest: rss || null,
            movies_ingest: movies || null,
            loading: false,
          });
        }
      } catch (e) {
        console.warn("[useJobRuns] Exception fetching job runs:", e);
        if (mounted) {
          setData({
            rss_ingest: null,
            movies_ingest: null,
            loading: false,
          });
        }
      }
    }

    fetchJobRuns();

    // Poll every 30 seconds to check for updates
    const intervalId = setInterval(fetchJobRuns, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return data;
}




