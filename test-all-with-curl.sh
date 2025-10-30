#!/bin/bash

# Test all pages with curl
echo "=================================================="
echo "Testing All Pages with Curl"
echo "=================================================="
echo ""

declare -a pages=(
    "/login:ログインページ"
    "/admin/dashboard:ダッシュボード"
    "/admin/sales-management:売上管理"
    "/admin/stores:店舗管理"
    "/admin/employees:従業員管理"
    "/admin/shifts:シフト管理"
    "/admin/monthly-sales:月次売上管理"
    "/admin/yearly-progress:年次損益進捗"
    "/admin/payments:支払い管理"
    "/admin/business-types:業態管理"
    "/admin/companies:企業管理"
    "/admin/add-admin:管理者追加"
)

success_count=0
total_count=${#pages[@]}

for page in "${pages[@]}"; do
    IFS=':' read -r path name <<< "$page"

    echo -n "Testing $name ($path)... "

    # Make request with 10 second timeout
    status=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "http://localhost:3002$path" 2>&1)

    if [ "$status" == "200" ]; then
        echo "✅ OK (200)"
        ((success_count++))
    else
        echo "❌ FAILED ($status)"
    fi

    sleep 0.5
done

echo ""
echo "=================================================="
echo "Test Results Summary"
echo "=================================================="
echo "Total: $total_count pages"
echo "Success: $success_count pages"
echo "Failed: $((total_count - success_count)) pages"
echo "Success Rate: $(( success_count * 100 / total_count ))%"
echo ""

if [ $success_count -eq $total_count ]; then
    echo "🎉 All pages are accessible!"
else
    echo "⚠️  Some pages have issues"
fi
