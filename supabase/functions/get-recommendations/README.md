# Get Recommendations Edge Function

This Edge Function implements the full recommendation engine logic inline (since we can't import TypeScript modules directly in Deno).

## Note on Implementation

The recommendation engine logic is duplicated here from `src/recs/` because:
1. Deno Edge Functions can't directly import TypeScript modules
2. We need the full scoring, diversity, and explainability logic

For production, consider:
- Bundling the TypeScript files with a build tool
- Or keeping the logic inline (current approach)

## Usage

See `RECOMMENDATION_ENGINE_README.md` for full API documentation.






