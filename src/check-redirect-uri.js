require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

console.log('=== Google OAuth Redirect URI Check ===');
console.log('PORT:', process.env.PORT);
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_REDIRECT_URI_AUTH:', process.env.GOOGLE_REDIRECT_URI_AUTH);

// Create OAuth2 client
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI_AUTH
});

// Generate auth URL
const authUrl = googleClient.generateAuthUrl({
  access_type: 'offline',
  scope: ['profile', 'email'],
  prompt: 'consent'
});

console.log('\nGenerated auth URL:');
console.log(authUrl);
console.log('\nMake sure the redirect_uri parameter in this URL matches what you have configured in Google Cloud Console.');
console.log('Current redirect_uri in URL:', new URL(authUrl).searchParams.get('redirect_uri'));

console.log('\n=== Instructions ===');
console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials');
console.log('2. Find your OAuth 2.0 Client ID and click on it');
console.log('3. Add this exact redirect URI to the "Authorized redirect URIs" section:');
console.log('   ' + process.env.GOOGLE_REDIRECT_URI_AUTH);
console.log('4. Click Save');
console.log('5. Restart your server and try again'); 