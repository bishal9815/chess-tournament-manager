# Google Forms Sync Setup

This document explains how to set up automatic syncing of player data from Google Forms.

## Overview

The Chess Tournament Manager can automatically sync player data from Google Forms. This allows tournament organizers to collect player registrations through Google Forms and have them automatically imported into the tournament.

## Setting Up Google Forms Integration

1. Log in to the Chess Tournament Manager
2. Navigate to a tournament
3. Click on the "Player Registration" tab
4. Select the "Google Integration" tab
5. Click "Connect with Google" and authorize the application
6. Click "Create Google Form" to create a new form for player registration
7. Share the form link with potential participants

## Automatic Syncing

The system can automatically sync player data from Google Forms every 10 minutes. Here's how to set it up:

### On Windows

1. Run the `setup-task-scheduler.bat` script as an administrator
2. This will create a scheduled task that runs every 10 minutes
3. The task will execute the `sync-forms.bat` script, which syncs data from Google Forms

To verify the task was created:
1. Open Task Scheduler (search for it in the Start menu)
2. Look for the "ChessTournamentGoogleFormsSync" task
3. Check that it's scheduled to run every 10 minutes

### On Linux/Mac

1. Open a terminal
2. Run `crontab -e` to edit your cron jobs
3. Add the following line to sync every 10 minutes:
   ```
   */10 * * * * /path/to/node /path/to/chess-tournament-manager/src/scripts/syncGoogleForms.js >> /path/to/chess-tournament-manager/logs/forms-sync.log 2>&1
   ```
4. Save and exit

## Manual Syncing

You can also manually sync player data at any time:

1. Navigate to the tournament's "Player Registration" page
2. Click on the "Google Integration" tab
3. Click the "Sync Now" button

## Troubleshooting

If automatic syncing isn't working:

1. Check the logs in the `logs` directory
2. Make sure the Google Forms integration is properly set up
3. Verify that the scheduled task or cron job is running
4. Check that the Google authorization hasn't expired

For Windows users, you can run the sync script manually to test it:
```
node src/scripts/syncGoogleForms.js
```

## Sync Frequency

By default, the system is set to sync every 10 minutes. You can change this by:

1. Editing the `syncFrequency` value in the tournament's Google Forms settings
2. Updating the scheduled task or cron job to match the new frequency 