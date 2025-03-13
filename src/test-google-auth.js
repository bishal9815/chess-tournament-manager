require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

// Test Google OAuth credentials
const testGoogleAuth = () => {
  try {
    console.log('Testing Google OAuth credentials...');
    
    // Check if credentials are set
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is not set in .env file');
      return;
    }
    
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      console.error('GOOGLE_CLIENT_SECRET is not set in .env file');
      return;
    }
    
    if (!process.env.GOOGLE_REDIRECT_URI_AUTH) {
      console.error('GOOGLE_REDIRECT_URI_AUTH is not set in .env file');
      return;
    }
    
    console.log('Google OAuth credentials found in .env file:');
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET.substring(0, 5) + '...');
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
    
    console.log('Generated auth URL:', authUrl);
    console.log('Google OAuth credentials test completed successfully');
  } catch (error) {
    console.error('Error testing Google OAuth credentials:', error);
  }
};

// Run the test
testGoogleAuth(); 