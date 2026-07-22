@echo off
chcp 65001 >nul
echo ========================================
echo       Resume Builder - Dev Server
echo ========================================
echo.
echo Starting dev server...
echo Browser will open at http://localhost:5173
echo.
echo Press Ctrl+C to stop the server
echo.
npm run start
pause
