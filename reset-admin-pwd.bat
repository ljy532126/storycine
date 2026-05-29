@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   StoryCine - Reset Admin Password
echo ========================================
echo.

REM Check for running MongoDB container
for /f "tokens=*" %%i in ('docker ps --format "{{.Names}}" 2^>nul ^| findstr /i mongo') do set MONGO_CONTAINER=%%i
if "%MONGO_CONTAINER%"=="" (
    echo [ERROR] MongoDB container not found. Is StoryCine running?
    pause
    exit /b 1
)

REM Prompt for password
set /p NEW_PWD="Enter new admin password: "
if "%NEW_PWD%"=="" (
    echo [ERROR] Password cannot be empty.
    pause
    exit /b 1
)

set /p CONFIRM_PWD="Confirm new password: "
if not "%NEW_PWD%"=="%CONFIRM_PWD%" (
    echo [ERROR] Passwords do not match.
    pause
    exit /b 1
)

REM Generate bcrypt hash using Docker app container
for /f "tokens=*" %%i in ('docker ps --format "{{.Names}}" 2^>nul ^| findstr /i storycine-app') do set APP_CONTAINER=%%i

set HASH=
if not "%APP_CONTAINER%"=="" (
    for /f "tokens=*" %%i in ('docker exec %APP_CONTAINER% node -e "const bcrypt=require('bcryptjs');bcrypt.hash('%NEW_PWD%',12).then(h=^>console.log(h))" 2^>nul') do set HASH=%%i
)

if "%HASH%"=="" (
    echo [ERROR] Cannot generate password hash.
    echo Make sure the StoryCine app container is running.
    pause
    exit /b 1
)

REM Update in MongoDB
docker exec %MONGO_CONTAINER% mongosh storycine --eval "db.users.updateOne({ username: 'admin' }, { $set: { password: '%HASH%' } })" --quiet 2>nul

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Password reset successfully!
    echo   Username: admin
    echo   New password: %NEW_PWD%
    echo ========================================
) else (
    echo [ERROR] Failed to update password in MongoDB.
    pause
    exit /b 1
)

pause
