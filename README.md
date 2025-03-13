# Chess Tournament Manager

A web application for managing chess tournaments with automated player pairing and results tracking.

## Features

- **User Authentication**: Register, login, and manage user profiles
- **Tournament Creation**: Create and configure chess tournaments
- **Player Management**: Register players for tournaments
- **Automated Pairing**: Swiss-system pairing algorithm for fair matchups
- **Results Tracking**: Record and track match results
- **Standings & Statistics**: View tournament standings and player statistics
- **Admin Dashboard**: Manage tournaments, players, and settings
- **Google Docs Integration**: Register players through Google Docs for easy data collection
- **Export Tournament Data**: Export tournament data

## Technology Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express
- Database: MongoDB
- Authentication: JWT (JSON Web Tokens)
- Pairing Algorithm: Custom implementation of Swiss-system

## Project Structure

```
chess-tournament-manager/
├── src/
│   ├── app/              # Main application pages
│   ├── components/       # Reusable UI components
│   ├── lib/              # Utility functions and helpers
│   ├── models/           # Data models and schemas
│   └── styles/           # CSS and styling files
├── public/               # Static assets
│   └── images/           # Image assets
└── README.md             # Project documentation
```

## Setup Instructions

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables
4. Start the development server: `npm run dev`
5. Access the application at `http://localhost:3000`

## Setting Up Google Docs Integration

To enable the Google Docs integration for tournament registration, follow these steps:

1. Create a Google Cloud Project:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the Google Docs API and Google Drive API

2. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application" as the application type
   - Add "http://localhost:5000/api/google/callback" as an authorized redirect URI
   - Copy the Client ID and Client Secret

3. Update your `.env` file with the Google OAuth credentials:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
   ```

4. Restart the server:
   ```
   npm run dev
   ```

5. Create a tournament and use the Google Docs tab to set up the integration.

## Automatic Syncing of Google Docs

The application includes a script to automatically sync player data from Google Docs. You can run this script manually or set it up as a cron job.

To run the script manually:
```
npm run sync-docs
```

To set up a cron job (example for syncing every hour):
```
0 * * * * cd /path/to/chess-tournament-manager && npm run sync-docs >> /path/to/logs/sync.log 2>&1
```

## Migrating from Google Sheets to Google Docs

If you have existing tournaments using Google Sheets, you can migrate them to Google Docs using the provided migration script:

```
npm run migrate-to-docs
```

Alternatively, you can migrate individual tournaments through the user interface by clicking the "Migrate to Google Docs" button on the tournament details page.

## License

MIT 