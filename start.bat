@echo off
chcp 65001 >nul
echo ========================================
echo       Resume Builder - Dev Server
echo ========================================
echo.
echo Starting share server (port 3001)...
start "Share Server" cmd /c "cd /d server && node index.js"
timeout /t 2 /nobreak >nul
echo.
echo Starting frontend dev server (port 5173)...
echo.
echo Press Ctrl+C to stop the frontend server
echo.
npm run start
pause