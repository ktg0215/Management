#!/bin/bash

# Test script for all application pages
BASE_URL="http://localhost:3002"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Results tracking
declare -A results
total_pages=0
success_pages=0
failed_pages=0

# Function to test a page
test_page() {
    local path=$1
    local name=$2

    echo "Testing: $name ($path)"
    total_pages=$((total_pages + 1))

    # Get HTTP status code and response time
    response=$(curl -o /dev/null -s -w "%{http_code}|%{time_total}" "${BASE_URL}${path}" 2>&1)
    status_code=$(echo "$response" | cut -d'|' -f1)
    time_total=$(echo "$response" | cut -d'|' -f2)

    if [[ "$status_code" == "200" ]] || [[ "$status_code" == "304" ]]; then
        echo -e "${GREEN}✓ PASS${NC} - Status: $status_code, Time: ${time_total}s"
        results["$name"]="PASS|$status_code|$time_total"
        success_pages=$((success_pages + 1))
    elif [[ "$status_code" == "307" ]] || [[ "$status_code" == "302" ]]; then
        echo -e "${YELLOW}→ REDIRECT${NC} - Status: $status_code (expected for protected routes)"
        results["$name"]="REDIRECT|$status_code|$time_total"
        success_pages=$((success_pages + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - Status: $status_code, Time: ${time_total}s"
        results["$name"]="FAIL|$status_code|$time_total"
        failed_pages=$((failed_pages + 1))
    fi
    echo ""
}

echo "=========================================="
echo "Testing All Application Pages"
echo "=========================================="
echo ""

# Test all pages
test_page "/" "Login Page"
test_page "/admin/dashboard" "Admin Dashboard"
test_page "/admin/stores" "Stores Management"
test_page "/admin/companies" "Companies Management"
test_page "/admin/business-types" "Business Types Management"
test_page "/admin/employees" "Employees Management"
test_page "/admin/shifts" "Shifts Management"
test_page "/admin/monthly-sales" "Monthly Sales"
test_page "/admin/yearly-progress" "Yearly Progress"
test_page "/admin/payments" "Payments Management"

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total Pages Tested: $total_pages"
echo -e "${GREEN}Successful: $success_pages${NC}"
echo -e "${RED}Failed: $failed_pages${NC}"
echo ""

# Detailed results
echo "=========================================="
echo "Detailed Results"
echo "=========================================="
for page in "${!results[@]}"; do
    IFS='|' read -r status code time <<< "${results[$page]}"
    echo "$page: $status (HTTP $code, ${time}s)"
done
