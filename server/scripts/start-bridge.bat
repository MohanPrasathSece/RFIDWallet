@echo off
echo Starting RFIDWallet Serial Bridge...
echo =====================================
echo.

REM Check if .env exists
if not exist "..\\.env" (
    echo ERROR: server/.env file not found!
    echo Please create server/.env with the following variables:
    echo   DEVICE_API_KEY=dev-local-1
    echo   SERIAL_PORT=COM5
    echo   SERIAL_BAUD=115200
    echo   SERVER_BASE=http://localhost:5000
    echo   MODULE=food
    echo   LOCATION=Food Court
    echo   DEBUG_SERIAL=1
    echo.
    pause
    exit /b 1
)

REM Change to server directory
cd /d "%~dp0.."

REM Start the bridge with auto-restart on crash
:restart
echo [%date% %time%] Starting serial bridge...
npm run bridge:serial
echo.
echo [%date% %time%] Bridge stopped. Restarting in 5 seconds...
echo Press Ctrl+C to exit completely.
timeout /t 5 /nobreak >nul
goto restart
