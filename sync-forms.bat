@echo off
echo Running Google Forms sync script...
cd /d "%~dp0"
node src/scripts/syncGoogleForms.js >> logs\forms-sync.log 2>&1
echo Sync completed at %date% %time% 