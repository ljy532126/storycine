@echo off
title StoryCine

echo ========================================
echo    StoryCine Startup
echo ========================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js not found, install Node.js >= 18 first
    pause
    exit /b 1
)
node -e "console.log('[OK] Node.js ' + process.version)"

if not exist "backend\node_modules" (
    echo [*] Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)
echo [OK] Backend ready

if not exist "frontend\node_modules" (
    echo [*] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)
echo [OK] Frontend ready

if not exist "backend\.env" (
    copy backend\.env.example backend\.env >nul
    echo [*] Created backend\.env, please edit it
)
echo.

echo [*] Starting databases...
docker compose up -d mongodb redis minio >nul 2>&1
if errorlevel 1 docker-compose up -d mongodb redis minio >nul 2>&1
if errorlevel 1 (
    echo [!] Docker not running, make sure DB is up
)
echo.

echo ========================================
echo    Backend:  http://localhost:3012
echo    Frontend: http://localhost:5173
echo ========================================
echo.

start "Backend" /min cmd /c "cd /d %~dp0backend && node server.js"
timeout /t 3 >nul
start "Frontend" /min cmd /c "cd /d %~dp0frontend && npx vite --host"

echo [OK] Started! Close this window anytime.
pause
