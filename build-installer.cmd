@echo off
echo ====================================
echo SimpleSQL Installer Builder
echo ====================================
echo.
echo Stopping any running processes...
taskkill /F /IM SimpleSQL.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul
timeout /t 3 /nobreak >nul

echo.
echo Cleaning old release folder...
rmdir /s /q release 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Building installer...
call npm run package:win

echo.
if %ERRORLEVEL% EQU 0 (
    echo ====================================
    echo BUILD SUCCESSFUL!
    echo ====================================
    echo.
    echo Installer location:
    dir release\*.exe /b
    echo.
) else (
    echo ====================================
    echo BUILD FAILED!
    echo ====================================
    echo Error code: %ERRORLEVEL%
    echo.
)

pause
