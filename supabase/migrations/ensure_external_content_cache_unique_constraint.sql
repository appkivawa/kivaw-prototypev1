-- ============================================================
-- Ensure external_content_cache has UNIQUE constraint on (provider, provider_id)
-- ============================================================
-- This migration ensures the unique constraint exists for upsert operations
-- Run this if the constraint is missing or needs to be recreated
-- ============================================================

-- Check if constraint exists, if not create it
DO $$
BEGIN
  -- Check if the unique constraint already exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'external_content_cache_provider_provider_id_key'
    AND conrelid = 'public.external_content_cache'::regclass
  ) THEN
    -- Create the unique constraint
    ALTER TABLE public.external_content_cache
    ADD CONSTRAINT external_content_cache_provider_provider_id_key
    UNIQUE (provider, provider_id);
    
    RAISE NOTICE 'Created unique constraint on (provider, provider_id)';
  ELSE
    RAISE NOTICE 'Unique constraint on (provider, provider_id) already exists';
  END IF;
END $$;






