#!/bin/bash
# Post-Deploy Smoke Test for Kivaw Production
# Usage: ./smoke_test.sh [PROD_URL] [ANON_KEY]

set -e

PROD_URL="${1:-https://YOUR_APP.vercel.app}"
ANON_KEY="${2:-YOUR_ANON_KEY}"

echo "🧪 Kivaw Production Smoke Test"
echo "================================"
echo "Production URL: $PROD_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASSED++))
}

test_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((FAILED++))
}

test_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test 1: App loads
echo "Test 1: App loads..."
if curl -s -f "$PROD_URL" | grep -q "<!doctype html"; then
  test_pass "App loads successfully"
else
  test_fail "App failed to load"
fi

# Test 2: Explore feed function (if accessible)
echo ""
echo "Test 2: explore_feed_v2 function..."
RESPONSE=$(curl -s -X POST "https://$(echo $PROD_URL | sed 's|https://||' | cut -d'/' -f1 | sed 's|.*\.||').supabase.co/functions/v1/explore_feed_v2" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"limit": 5}' 2>&1)

if echo "$RESPONSE" | grep -q "items\|ok"; then
  test_pass "explore_feed_v2 responds"
else
  test_fail "explore_feed_v2 failed: $RESPONSE"
fi

# Test 3: Check for console errors (basic HTML check)
echo ""
echo "Test 3: HTML structure..."
HTML=$(curl -s "$PROD_URL")
if echo "$HTML" | grep -q "<script"; then
  test_pass "HTML includes scripts"
else
  test_warn "HTML structure may be incomplete"
fi

# Summary
echo ""
echo "================================"
echo "Summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
