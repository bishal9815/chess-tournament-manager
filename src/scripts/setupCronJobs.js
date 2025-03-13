/**
 * Setup Cron Jobs Script
 * 
 * This script outputs the commands needed to set up cron jobs for automatically
 * syncing Google Forms data every 10 minutes.
 */

const path = require('path');
const fs = require('fs');

// Get the absolute path to the project directory
const projectDir = path.resolve(__dirname, '..', '..');

// Get the absolute path to the sync scripts
const syncFormsScript = path.join(projectDir, 'src', 'scripts', 'syncGoogleForms.js');
const syncDocsScript = path.join(projectDir, 'src', 'scripts', 'syncGoogleDocs.js');
const syncSheetsScript = path.join(projectDir, 'src', 'scripts', 'syncGoogleSheets.js');

// Get the absolute path to the Node.js executable
const nodePath = process.execPath;

// Create the cron job commands
const cronCommands = [
  `# Sync Google Forms every 10 minutes`,
  `*/10 * * * * ${nodePath} ${syncFormsScript} >> ${projectDir}/logs/forms-sync.log 2>&1`,
  ``,
  `# Sync Google Docs every hour`,
  `0 * * * * ${nodePath} ${syncDocsScript} >> ${projectDir}/logs/docs-sync.log 2>&1`,
  ``,
  `# Sync Google Sheets every hour (legacy)`,
  `0 * * * * ${nodePath} ${syncSheetsScript} >> ${projectDir}/logs/sheets-sync.log 2>&1`
];

// Create the logs directory if it doesn't exist
const logsDir = path.join(projectDir, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  console.log(`Created logs directory: ${logsDir}`);
}

// Output the cron job commands
console.log('To set up automatic syncing, add the following lines to your crontab:');
console.log('Run "crontab -e" and add these lines:');
console.log('');
console.log(cronCommands.join('\n'));
console.log('');
console.log('For Windows, you can use Task Scheduler instead of cron.');
console.log('Create a task that runs every 10 minutes with the following command:');
console.log(`${nodePath} ${syncFormsScript}`);
console.log('');
console.log('Make sure the logs directory exists:');
console.log(logsDir); 