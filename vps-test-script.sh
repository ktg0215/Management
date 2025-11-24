#!/bin/bash

# VPS Test Script - Comprehensive Testing for BB Application
# Usage: bash vps-test-script.sh <VPS_URL>
# Example: bash vps-test-script.sh https://edwtoyama.com

set -e

VPS_URL="${1:-https://edwtoyama.com}"
APP_PATH="/bb"
FULL_URL="${VPS_URL}${APP_PATH}"
API_URL="${VPS_URL}${APP_PATH}/api"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASS=0
FAIL=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_test() {
    echo -e "\n${YELLOW}[TEST] $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS++))
}

print_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL++))
}

print_info() {
    echo -e "${BLUE}ℹ INFO${NC}: $1"
}

# Test 1: Connectivity Check
print_header "TEST 1: Server Connectivity"
print_test "Checking if VPS is reachable"
if curl -s -I "${FULL_URL}/login/" | grep -q "HTTP"; then
    print_pass "Server is reachable"
else
    print_fail "Server is not reachable"
    exit 1
fi

# Test 2: Login Page
print_header "TEST 2: Login Page"
print_test "Accessing login page"
LOGIN_RESPONSE=$(curl -s "${FULL_URL}/login/")
if echo "$LOGIN_RESPONSE" | grep -q "ログイン\|login"; then
    print_pass "Login page loads successfully"
else
    print_fail "Login page does not load properly"
    print_info "Response snippet: ${LOGIN_RESPONSE:0:200}"
fi

# Test 3: API Health Check
print_header "TEST 3: API Health Check"
print_test "Checking API endpoint"
HEALTH_RESPONSE=$(curl -s "${API_URL}/../health" || curl -s "${VPS_URL}/health")
if echo "$HEALTH_RESPONSE" | grep -q "OK\|connected"; then
    print_pass "API is responsive"
    print_info "Response: $HEALTH_RESPONSE"
else
    print_fail "API health check failed"
fi

# Test 4: Login Request
print_header "TEST 4: Authentication Test"
print_test "Attempting login with admin credentials"

# Credentials to test
EMPLOYEE_ID="0000"
PASSWORD="admin123"

LOGIN_PAYLOAD="{\"employeeId\":\"${EMPLOYEE_ID}\",\"password\":\"${PASSWORD}\"}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_PAYLOAD")

if echo "$LOGIN_RESPONSE" | grep -q "token\|success"; then
    print_pass "Login request successful"
    # Extract token if available
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        print_info "JWT Token obtained: ${TOKEN:0:20}..."
    fi
else
    print_fail "Login failed"
    print_info "Response: $LOGIN_RESPONSE"
fi

# Test 5: Stores Endpoint
print_header "TEST 5: Stores Data"
print_test "Fetching stores list"
STORES_RESPONSE=$(curl -s "${API_URL}/stores" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null || curl -s "${API_URL}/stores")

if echo "$STORES_RESPONSE" | grep -q "id\|name"; then
    print_pass "Stores endpoint is working"
    STORE_COUNT=$(echo "$STORES_RESPONSE" | grep -o '"id"' | wc -l)
    print_info "Found $STORE_COUNT store(s)"

    # Check for specific store
    if echo "$STORES_RESPONSE" | grep -q "EDW\|富山\|カフェ"; then
        print_pass "Expected store found in data"
    else
        print_fail "Expected store not found"
    fi
else
    print_fail "Stores endpoint failed"
    print_info "Response: ${STORES_RESPONSE:0:200}"
fi

# Test 6: Monthly Sales Page
print_header "TEST 6: Monthly Sales Page"
print_test "Accessing monthly sales page"
MONTHLY_RESPONSE=$(curl -s "${FULL_URL}/admin/monthly-sales/")
if echo "$MONTHLY_RESPONSE" | grep -q "月次売上\|Monthly"; then
    print_pass "Monthly sales page loads"
else
    print_fail "Monthly sales page failed to load"
fi

# Test 7: Yearly Progress Page
print_header "TEST 7: Yearly Progress Page"
print_test "Accessing yearly progress page"
YEARLY_RESPONSE=$(curl -s "${FULL_URL}/admin/yearly-progress/")
if echo "$YEARLY_RESPONSE" | grep -q "年間\|損益\|Progress\|Profit"; then
    print_pass "Yearly progress page loads"
else
    print_fail "Yearly progress page failed to load"
fi

# Test 8: P&L Data Endpoint
print_header "TEST 8: P&L Data Retrieval"
print_test "Fetching P&L data for current year/month"

# Get first store ID from stores response
if [ -n "$STORES_RESPONSE" ]; then
    STORE_ID=$(echo "$STORES_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

    if [ -n "$STORE_ID" ]; then
        CURRENT_YEAR=$(date +%Y)
        CURRENT_MONTH=$(date +%m)

        PL_RESPONSE=$(curl -s "${API_URL}/pl?year=${CURRENT_YEAR}&month=${CURRENT_MONTH}&storeId=${STORE_ID}" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null)

        if echo "$PL_RESPONSE" | grep -q "success\|data\|profit\|revenue"; then
            print_pass "P&L endpoint is working"
        else
            print_info "P&L data may be empty (this is expected if no data exists)"
            print_info "Response: ${PL_RESPONSE:0:200}"
        fi
    fi
fi

# Test 9: Console Errors Detection
print_header "TEST 9: Console Error Check"
print_test "Note: This requires manual check with browser DevTools"
print_info "Open the page in Chrome/Firefox and check:"
print_info "1. Press F12 to open DevTools"
print_info "2. Go to Console tab"
print_info "3. Look for red error messages"
print_info "4. Check Network tab for failed requests (red status codes)"

# Test 10: Database Connectivity (if SSH access available)
print_header "TEST 10: Summary"
echo -e "\n${GREEN}Tests Passed: $PASS${NC}"
echo -e "${RED}Tests Failed: $FAIL${NC}"

if [ $FAIL -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! Application appears to be working correctly.${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please review the results above.${NC}"
    exit 1
fi

