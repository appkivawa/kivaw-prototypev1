-- View recent job runs sorted by last_run_at desc
-- This query shows the execution history of all ingestion jobs

SELECT 
  job_name,
  last_run_at,
  status,
  error_message,
  result_summary,
  created_at,
  updated_at
FROM public.job_runs
ORDER BY last_run_at DESC NULLS LAST, created_at DESC;

-- Alternative: View only the most recent run for each job
-- SELECT DISTINCT ON (job_name)
--   job_name,
--   last_run_at,
--   status,
--   error_message,
--   result_summary
-- FROM public.job_runs
-- ORDER BY job_name, last_run_at DESC NULLS LAST;

-- View only failed runs
-- SELECT 
--   job_name,
--   last_run_at,
--   status,
--   error_message,
--   result_summary
-- FROM public.job_runs
-- WHERE status = 'error'
-- ORDER BY last_run_at DESC;

-- View summary statistics
-- SELECT 
--   job_name,
--   COUNT(*) as total_runs,
--   COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
--   COUNT(*) FILTER (WHERE status = 'error') as failed_runs,
--   MAX(last_run_at) as last_run_at,
--   MAX(last_run_at) FILTER (WHERE status = 'success') as last_success_at,
--   MAX(last_run_at) FILTER (WHERE status = 'error') as last_error_at
-- FROM public.job_runs
-- GROUP BY job_name
-- ORDER BY job_name;




