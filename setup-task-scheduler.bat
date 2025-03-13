@echo off
echo Setting up scheduled task for Google Forms sync...

REM Get the current directory
set "CURRENT_DIR=%~dp0"

REM Create the task
schtasks /create /tn "ChessTournamentGoogleFormsSync" /tr "%CURRENT_DIR%sync-forms.bat" /sc minute /mo 10 /ru "%USERNAME%" /f

echo.
echo Task created successfully!
echo The sync-forms.bat script will run every 10 minutes.
echo.
echo You can view and modify this task in Task Scheduler.
echo.
pause 