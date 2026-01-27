#!/bin/bash
# Smoke test script for Edge Functions
# Run in <2 minutes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (update these)
SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY:-your-service-key}"
CRON_SECRET="${CRON_SECRET:-your-cron-secret}"

echo "🧪 Testing Edge Functions..."
echo ""

# Test counter
PASSED=0
FAILED=0

# Test helper
test_function() {
  local name=$1
  local method=$2
  local url=$3
  local headers=$4
  local body=$5
  local expected_status=$6

  echo -n "Testing $name... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "$url" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      $headers)
  else
    response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
      -H "Content-Type: application/json" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      $headers \
      -d "$body")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $http_code)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗${NC} (HTTP $http_code, expected $expected_status)"
    echo "  Response: $body" | head -c 200
    echo ""
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# ============================================================
# Test 1: explore_feed_v2 (GET - smoke test)
# ============================================================
test_function \
  "explore_feed_v2 (GET)" \
  "GET" \
  "$SUPABASE_URL/functions/v1/explore_feed_v2" \
  "" \
  "" \
  "200"

# ============================================================
# Test 2: explore_feed_v2 (POST - anonymous)
# ============================================================
test_function \
  "explore_feed_v2 (POST anonymous)" \
  "POST" \
  "$SUPABASE_URL/functions/v1/explore_feed_v2" \
  "" \
  '{"limit": 10}' \
  "200"

# ============================================================
# Test 3: social_feed (GET - smoke test)
# ============================================================
test_function \
  "social_feed (GET)" \
  "GET" \
  "$SUPABASE_URL/functions/v1/social_feed" \
  "" \
  "" \
  "200"

# ============================================================
# Test 4: social_feed (POST - anonymous)
# ============================================================
test_function \
  "social_feed (POST anonymous)" \
  "POST" \
  "$SUPABASE_URL/functions/v1/social_feed" \
  "" \
  '{"limit": 10}' \
  "200"

# ============================================================
# Test 5: cron_runner (GET - smoke test)
# ============================================================
test_function \
  "cron_runner (GET)" \
  "GET" \
  "$SUPABASE_URL/functions/v1/cron_runner" \
  "-H \"Authorization: Bearer $SUPABASE_SERVICE_KEY\"" \
  "" \
  "200"

# ============================================================
# Summary
# ============================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
