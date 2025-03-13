require('dotenv').config();
const emailService = require('./lib/services/emailService');
const { generateOTP } = require('./lib/utils');

// Test email address
const testEmail = process.argv[2] || 'test@example.com';

// Generate a test OTP
const testOtp = generateOTP();

console.log(`Sending test email to: ${testEmail}`);
console.log(`Test OTP: ${testOtp}`);

// Send test email
emailService.sendOTPVerificationEmail(testEmail, testOtp)
  .then(info => {
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
    // If using Ethereal, log the preview URL
    if (process.env.NODE_ENV === 'development') {
      const nodemailer = require('nodemailer');
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('Error sending email:', error);
    process.exit(1);
  }); 