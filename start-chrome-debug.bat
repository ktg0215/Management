@echo off
REM Start Chrome with remote debugging on port 9222
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug" http://localhost:3002/admin/sales-management
