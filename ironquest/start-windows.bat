@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing IronQuest - first run only...
  call npm install
)
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3030"
call npm start
