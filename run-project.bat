@echo off
set "ROOT=%~dp0"

start "Nexus Chat Backend" powershell -NoExit -Command "Set-Location '%ROOT%backend'; npm run dev"
start "Nexus Chat Frontend" powershell -NoExit -Command "Set-Location '%ROOT%frontend'; npm start"

echo Nexus Chat is starting.
echo Backend:  http://localhost:5001
echo Frontend: http://localhost:3000
pause
