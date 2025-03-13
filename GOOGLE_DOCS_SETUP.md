# Google Docs Integration Setup

This document provides instructions on how to set up and use the Google Docs integration for the Chess Tournament Manager application.

## Prerequisites

- A Google account (using the provided credentials: b6725785@gmail.com)
- Access to the [Google Cloud Console](https://console.cloud.google.com/)

## Setting Up Google Cloud Project

1. Sign in to the [Google Cloud Console](https://console.cloud.google.com/) using the provided Google account:
   - Email: b6725785@gmail.com
   - Password: qwer4321@#

2. Create a new project or select an existing one.

3. Enable the required APIs:
   - Navigate to "APIs & Services" > "Library"
   - Search for and enable the following APIs:
     - Google Docs API
     - Google Drive API

4. Create OAuth 2.0 credentials:
   - Navigate to "APIs & Services" > "Credentials"
   - Click "Create Credentials" and select "OAuth client ID"
   - Select "Web application" as the application type
   - Add a name for your OAuth client (e.g., "Chess Tournament Manager")
   - Add the following authorized redirect URI:
     - `http://localhost:5000/api/google/callback` (for local development)
     - Add your production URL if deploying to production
   - Click "Create"
   - Note the Client ID and Client Secret

5. Configure the OAuth consent screen:
   - Navigate to "APIs & Services" > "OAuth consent screen"
   - Select "External" as the user type
   - Fill in the required information:
     - App name: "Chess Tournament Manager"
     - User support email: b6725785@gmail.com
     - Developer contact information: b6725785@gmail.com
   - Add the following scopes:
     - `https://www.googleapis.com/auth/documents`
     - `https://www.googleapis.com/auth/drive`
   - Add any test users (including b6725785@gmail.com)
   - Click "Save and Continue"

## Configuring the Application

1. Update the `.env` file with your Google Cloud credentials:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
   ```

2. Restart the application to apply the changes.

## Migrating from Google Sheets to Google Docs

If you have existing tournaments using Google Sheets, you can migrate them to Google Docs using the provided migration script:

```bash
npm run migrate-to-docs
```

This script will:
1. Find all tournaments with Google Sheets integration
2. Create equivalent Google Docs for each tournament
3. Update the tournament records to use Google Docs instead of Google Sheets

## Using Google Docs Integration

### Creating a Tournament with Google Docs Integration

1. Create a new tournament through the application.
2. On the tournament details page, click "Enable Google Docs Integration".
3. If prompted, authenticate with Google using the provided credentials.
4. A Google Doc will be created for the tournament, and the link will be displayed.

### Adding Players via Google Docs

1. Open the Google Doc associated with the tournament.
2. Add player information in the specified format:
   ```
   First Name, Last Name, Email, Chess Rating, Username, Phone, City, State, Country
   ```
3. Save the document.

### Syncing Players from Google Docs

1. On the tournament details page, click "Sync Players from Google Doc".
2. The application will retrieve player information from the Google Doc and add them to the tournament.

### Automatic Syncing

The application can automatically sync player data from Google Docs at regular intervals:

1. Enable automatic syncing on the tournament details page.
2. Set the sync frequency (in minutes).
3. The application will periodically check for new players in the Google Doc and add them to the tournament.

To manually run the sync process:

```bash
npm run sync-docs
```

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

1. Ensure the correct credentials are being used.
2. Check that the OAuth consent screen is properly configured.
3. Verify that the redirect URI matches the one in your Google Cloud Console.

### API Quota Limits

Google APIs have usage quotas. If you encounter quota issues:

1. Check the [Google Cloud Console](https://console.cloud.google.com/) for quota information.
2. Consider implementing rate limiting in your application.

### Document Access Issues

If the application cannot access the Google Doc:

1. Ensure the document is shared with the authenticated user.
2. Check that the correct scopes are requested during authentication.

## Support

For additional support, please contact the development team or refer to the [Google Docs API documentation](https://developers.google.com/docs/api). 