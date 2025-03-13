const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const OTP = require('../../models/OTP');
const { protect } = require('../../lib/auth');
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');
const emailService = require('../../lib/services/emailService');
const { generateOTP } = require('../../lib/utils');

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User with that email or username already exists'
      });
    }
    
    // Create user (not verified yet)
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      isVerified: false
    });
    
    // Generate OTP
    const otp = generateOTP();
    
    // Save OTP to database
    await OTP.create({
      email,
      otp
    });
    
    // Send OTP to user's email
    try {
      const emailResult = await emailService.sendOTPVerificationEmail(email, otp);
      
      // For development, if using Ethereal, include the preview URL
      let message = 'User registered successfully. Please verify your email with the OTP sent to your email address.';
      let previewUrl = null;
      
      if (process.env.NODE_ENV === 'development' && emailResult && emailResult.messageId) {
        const nodemailer = require('nodemailer');
        previewUrl = nodemailer.getTestMessageUrl(emailResult);
        console.log('Preview URL:', previewUrl);
      }
      
      res.status(201).json({
        success: true,
        message,
        previewUrl,
        userId: user._id,
        // For development only, include the OTP in the response
        ...(process.env.NODE_ENV === 'development' && { otp })
      });
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      
      // In development, don't delete the user, just return the OTP for testing
      if (process.env.NODE_ENV === 'development') {
        return res.status(201).json({
          success: true,
          message: 'User registered successfully. Email sending failed, but OTP is provided for development.',
          userId: user._id,
          otp,
          emailError: emailError.message
        });
      }
      
      // In production, delete the user if email sending fails
      await User.findByIdAndDelete(user._id);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      });
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        error: messages
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Find the OTP record
    const otpRecord = await OTP.findOne({ email, otp });
    
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired OTP'
      });
    }
    
    // Find and update the user
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Delete the OTP record
    await OTP.findByIdAndDelete(otpRecord._id);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        chessRating: user.chessRating
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // If user is already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified'
      });
    }
    
    // Delete any existing OTP
    await OTP.deleteMany({ email });
    
    // Generate new OTP
    const otp = generateOTP();
    
    // Save OTP to database
    await OTP.create({
      email,
      otp
    });
    
    // Send OTP to user's email
    await emailService.sendOTPVerificationEmail(email, otp);
    
    res.status(200).json({
      success: true,
      message: 'OTP resent successfully'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        error: 'Email not verified. Please verify your email first.',
        needsVerification: true,
        email: user.email
      });
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        chessRating: user.chessRating
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Google OAuth routes
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI_AUTH || 'http://localhost:5000/api/auth/google/callback'
});

// Redirect to Google OAuth page
router.get('/google', (req, res) => {
  try {
    console.log('Redirecting to Google OAuth...');
    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      prompt: 'consent'
    });
    console.log('Auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.redirect('/login?error=google_auth_failed');
  }
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    console.log('Google callback received');
    const { code } = req.query;
    
    if (!code) {
      console.error('No code provided in callback');
      return res.redirect('/login?error=no_code');
    }
    
    // Get tokens from code
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);
    
    // Get user info
    const userInfoResponse = await googleClient.request({
      url: 'https://www.googleapis.com/oauth2/v3/userinfo'
    });
    
    const userInfo = userInfoResponse.data;
    console.log('User info received:', userInfo.email);
    
    // Check if user exists
    let user = await User.findOne({ email: userInfo.email });
    
    if (!user) {
      // Create new user
      console.log('Creating new user for:', userInfo.email);
      user = await User.create({
        username: userInfo.email.split('@')[0] + '_google',
        email: userInfo.email,
        password: Math.random().toString(36).slice(-12), // Random password
        firstName: userInfo.given_name || '',
        lastName: userInfo.family_name || '',
        googleId: userInfo.sub,
        profilePicture: userInfo.picture || ''
      });
    } else {
      // Update existing user with Google ID if not already set
      if (!user.googleId) {
        console.log('Updating existing user with Google ID');
        user.googleId = userInfo.sub;
        await user.save();
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Redirect to frontend with token
    console.log('Redirecting to success page with token');
    res.redirect(`/login-success.html?token=${token}&userId=${user._id}`);
  } catch (error) {
    console.error('Google auth error:', error);
    res.redirect('/login?error=google_auth_failed');
  }
});

// Simple Google OAuth redirect with multiple redirect URI options
router.get('/google-simple', (req, res) => {
  try {
    console.log('Using simple Google OAuth redirect');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    // Use the exact redirect URI from the .env file
    const redirectUri = encodeURIComponent(process.env.GOOGLE_REDIRECT_URI_AUTH);
    const scope = encodeURIComponent('profile email');
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    
    console.log('Redirecting to:', googleAuthUrl);
    console.log('Redirect URI being used:', decodeURIComponent(redirectUri));
    res.redirect(googleAuthUrl);
  } catch (error) {
    console.error('Error in simple Google redirect:', error);
    res.redirect('/login?error=google_auth_failed');
  }
});

// Facebook OAuth routes
router.get('/facebook', (req, res) => {
  try {
    console.log('Starting Facebook OAuth process');
    
    // Check if Facebook App ID is set
    if (!process.env.FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID === 'your_facebook_app_id_here') {
      console.error('Facebook App ID is not set or is using the default value');
      return res.redirect('/login?error=facebook_app_id_not_set');
    }
    
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5000/api/auth/facebook/callback';
    console.log('Using redirect URI:', redirectUri);
    
    const facebookAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,public_profile`;
    console.log('Redirecting to Facebook auth URL:', facebookAuthUrl);
    
    res.redirect(facebookAuthUrl);
  } catch (error) {
    console.error('Error in Facebook redirect:', error);
    res.redirect('/login?error=facebook_redirect_failed');
  }
});

router.get('/facebook/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5000/api/auth/facebook/callback';
    
    // Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${redirectUri}&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`
    );
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token from Facebook');
    }
    
    // Get user data from Facebook
    const userResponse = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,first_name,last_name,picture&access_token=${tokenData.access_token}`
    );
    
    const userData = await userResponse.json();
    
    if (!userData.email) {
      throw new Error('Email not provided by Facebook');
    }
    
    // Check if user exists
    let user = await User.findOne({ email: userData.email });
    
    if (!user) {
      // Create new user
      user = await User.create({
        username: userData.email.split('@')[0] + '_facebook',
        email: userData.email,
        password: Math.random().toString(36).slice(-12), // Random password
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        facebookId: userData.id,
        profilePicture: userData.picture?.data?.url || ''
      });
    } else {
      // Update existing user with Facebook ID if not already set
      if (!user.facebookId) {
        user.facebookId = userData.id;
        await user.save();
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Redirect to frontend with token
    res.redirect(`/login-success.html?token=${token}&userId=${user._id}`);
  } catch (error) {
    console.error('Facebook auth error:', error);
    res.redirect('/login?error=facebook_auth_failed');
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    console.log('Fetching user data for ID:', req.user.id);
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        chessRating: user.chessRating,
        chesscomUsername: user.chesscomUsername,
        lichessUsername: user.lichessUsername,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Update user profile
router.put('/update-profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, username, email, chessRating, chesscomUsername, lichessUsername } = req.body;
    
    // Check if email is already in use by another user
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email is already in use'
        });
      }
    }
    
    // Check if username is already in use by another user
    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username is already in use'
        });
      }
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        firstName,
        lastName,
        username,
        email,
        chessRating,
        chesscomUsername,
        lichessUsername
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        chessRating: updatedUser.chessRating,
        chesscomUsername: updatedUser.chesscomUsername,
        lichessUsername: updatedUser.lichessUsername
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Change password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user
    const user = await User.findById(req.user.id).select('+password');
    
    // Check if current password matches
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Development-only routes for email testing
if (process.env.NODE_ENV === 'development') {
  // Get email configuration
  router.get('/email-config', (req, res) => {
    try {
      // Get email configuration from environment variables
      const config = {
        host: process.env.EMAIL_HOST || 'Not configured',
        port: process.env.EMAIL_PORT || 'Not configured',
        secure: process.env.EMAIL_SECURE === 'true' ? 'Yes' : 'No',
        user: process.env.EMAIL_USER || 'Not configured',
        status: 'Unknown'
      };
      
      // Check if the transporter is available
      if (emailService.transporter) {
        config.status = 'Configured';
      } else {
        config.status = 'Not configured';
      }
      
      res.status(200).json(config);
    } catch (error) {
      console.error('Email config error:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  });
  
  // Send test email
  router.post('/test-email', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }
      
      // Generate a test OTP
      const testOtp = generateOTP();
      
      // Send test email
      const emailResult = await emailService.sendOTPVerificationEmail(email, testOtp);
      
      // Prepare response
      let response = {
        success: true,
        message: 'Test email sent successfully!'
      };
      
      // If using Ethereal, include the preview URL
      if (emailResult && emailResult.messageId) {
        const nodemailer = require('nodemailer');
        const previewUrl = nodemailer.getTestMessageUrl(emailResult);
        if (previewUrl) {
          response.previewUrl = previewUrl;
        }
      }
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        error: `Failed to send test email: ${error.message}`
      });
    }
  });
}

// Development-only route to get OTP for an email
if (process.env.NODE_ENV === 'development') {
  router.get('/dev-get-otp/:email', async (req, res) => {
    try {
      const { email } = req.params;
      
      // Find the OTP record
      const otpRecord = await OTP.findOne({ email });
      
      if (!otpRecord) {
        return res.status(404).json({
          success: false,
          error: 'No OTP found for this email'
        });
      }
      
      res.status(200).json({
        success: true,
        email,
        otp: otpRecord.otp,
        createdAt: otpRecord.createdAt
      });
    } catch (error) {
      console.error('Dev OTP retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  });
}

module.exports = router; 