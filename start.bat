@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not defined PORT set "PORT=3000"

echo ==========================================================
echo   Starting OpenCode Router (Windows)
echo ==========================================================

rem 1. Download Xray-core if missing
if not exist "bin\xray.exe" (
  echo Downloading Xray-core...
  if not exist "bin" mkdir "bin"
  set "XRAY_VER=v26.10.31"
  set "XRAY_URL=https://github.com/XTLS/Xray-core/releases/download/!XRAY_VER!/Xray-windows-64.zip"
  set "TMP_ZIP=%TEMP%\xray-core-download.zip"
  set "EXTRACT_DIR=%TEMP%\xray-core-extract"
  if exist "!EXTRACT_DIR!" rmdir /s /q "!EXTRACT_DIR!"
  mkdir "!EXTRACT_DIR!"
  "%SystemRoot%\System32\curl.exe" -sSL -f -o "!TMP_ZIP!" "!XRAY_URL!"
  if errorlevel 1 (
    echo [WARN] Failed to download Xray-core automatically.
    echo        Please install Xray manually into bin\xray.exe
  ) else (
    "%SystemRoot%\System32\tar.exe" -xf "!TMP_ZIP!" -C "!EXTRACT_DIR!" && (
      copy /y "!EXTRACT_DIR!\xray.exe" "bin\xray.exe" >nul
      copy /y "!EXTRACT_DIR!\geoip.dat" "bin\" >nul 2>nul
      copy /y "!EXTRACT_DIR!\geosite.dat" "bin\" >nul 2>nul
      del /q "!TMP_ZIP!" >nul 2>nul
      echo Xray-core downloaded successfully.
    )
  )
)

rem 2. Build frontend if dist/ does not exist
if not exist "src\frontend\dist\index.html" (
  echo Compiling frontend application...
  pushd src\frontend
  call npx vite build
  popd
)

rem 3. Start backend server
if not exist "data" mkdir "data"
echo Launching backend server on port %PORT%...
start "OpenCode Router Backend" /min cmd /c "npx tsx src/backend/server.ts > data\server.log 2>&1"

rem 4. Wait for server readiness
echo Waiting for HTTP service to become ready...
set /a READY=0
for /l %%i in (1,1,30) do (
  if !READY! equ 0 (
    "%SystemRoot%\System32\ping.exe" -n 2 127.0.0.1 >nul
    "%SystemRoot%\System32\curl.exe" -s "http://127.0.0.1:%PORT%/api/status" >nul 2>&1 && set /a READY=1
  )
)

if %READY% equ 1 (
  echo.
  echo ==========================================================
  echo   Application running at: http://localhost:%PORT%
  echo ==========================================================
  echo.
  echo Open your browser to http://localhost:%PORT% and click
  echo    [ Find Working Connection ]
  echo.
  start "" "http://localhost:%PORT%"
) else (
  echo [WARN] Server took longer than expected to start. Check backend window for logs.
)

endlocal
