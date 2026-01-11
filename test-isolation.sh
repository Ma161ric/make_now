#!/bin/bash
# User Data Isolation Test Suite - Verification Script
# Usage: npm run test:isolation

echo "========================================="
echo "User Data Isolation Test Suite"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL=0
PASSED=0
FAILED=0

run_test() {
  local test_file=$1
  local test_name=$2
  
  echo "Running: $test_name"
  TOTAL=$((TOTAL + 1))
  
  if npx vitest run "$test_file" --reporter=verbose > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}: $test_name"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAILED${NC}: $test_name"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

# Run all isolation test suites
run_test "src/test/storage.test.ts" "Core Storage Functionality (24 tests)"
run_test "src/test/userDataIsolation.test.ts" "User Data Isolation (14 tests)"
run_test "src/test/storage.edgecases.test.ts" "Edge Cases & Scenarios (26 tests)"

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Total Test Suites: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "Failed: ${RED}$FAILED${NC}"
else
  echo -e "Failed: ${GREEN}0${NC}"
fi

if [ $FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ All isolation tests PASSED!${NC}"
  echo "User data isolation is working correctly."
  exit 0
else
  echo ""
  echo -e "${RED}✗ Some tests FAILED!${NC}"
  exit 1
fi
