require('dotenv').config();

console.log('=== Facebook OAuth Configuration Check ===');

// Check Facebook App ID
if (!process.env.FACEBOOK_APP_ID) {
  console.error('❌ FACEBOOK_APP_ID is not set in .env file');
} else if (process.env.FACEBOOK_APP_ID === 'your_facebook_app_id_here') {
  console.error('❌ FACEBOOK_APP_ID is still using the default placeholder value');
} else {
  console.log('✅ FACEBOOK_APP_ID:', process.env.FACEBOOK_APP_ID);
}

// Check Facebook App Secret
if (!process.env.FACEBOOK_APP_SECRET) {
  console.error('❌ FACEBOOK_APP_SECRET is not set in .env file');
} else if (process.env.FACEBOOK_APP_SECRET === 'your_facebook_app_secret_here') {
  console.error('❌ FACEBOOK_APP_SECRET is still using the default placeholder value');
} else {
  console.log('✅ FACEBOOK_APP_SECRET:', process.env.FACEBOOK_APP_SECRET.substring(0, 5) + '...');
}

// Check Facebook Redirect URI
if (!process.env.FACEBOOK_REDIRECT_URI) {
  console.error('❌ FACEBOOK_REDIRECT_URI is not set in .env file');
} else {
  console.log('✅ FACEBOOK_REDIRECT_URI:', process.env.FACEBOOK_REDIRECT_URI);
}

console.log('\n=== Facebook Login URL ===');
const redirectUri = encodeURIComponent(process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5000/api/auth/facebook/callback');
const facebookAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${redirectUri}&scope=email,public_profile`;
console.log(facebookAuthUrl);

console.log('\n=== Instructions ===');
console.log('1. Go to Facebook for Developers: https://developers.facebook.com/apps/');
console.log('2. Create a new app if you haven\'t already');
console.log('3. Add the "Facebook Login" product to your app');
console.log('4. In Facebook Login settings, add this redirect URI:');
console.log('   ' + (process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5000/api/auth/facebook/callback'));
console.log('5. In Basic Settings, copy your App ID and App Secret to your .env file');
console.log('6. Make sure your app is in "Development Mode" for testing');
console.log('7. Add test users or switch the app to "Live Mode" if you want to allow all users to log in'); 