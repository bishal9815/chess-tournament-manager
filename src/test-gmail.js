require('dotenv').config();
const nodemailer = require('nodemailer');

// Create a test function
async function testGmailConnection() {
  console.log('Testing Gmail connection with App Password...');
  console.log('Email User:', process.env.EMAIL_USER);
  console.log('App Password is configured:', process.env.EMAIL_PASSWORD ? 'Yes' : 'No');
  
  // Create a transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  // Verify connection
  try {
    const verification = await transporter.verify();
    console.log('SMTP connection verified:', verification);
    
    // Test recipient email (use your own email to test)
    const testEmail = process.argv[2] || process.env.EMAIL_USER;
    
    // Send a test email
    const info = await transporter.sendMail({
      from: `"Chess Tournament Manager" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: 'Test Email with App Password',
      text: 'This is a test email sent using the Gmail App Password.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Test Email</h2>
          <p style="color: #555; font-size: 16px;">This is a test email sent using the Gmail App Password.</p>
          <p style="color: #555; font-size: 16px;">If you're seeing this, your email configuration is working correctly!</p>
          <div style="text-align: center; margin-top: 30px; color: #888; font-size: 12px;">
            <p>Chess Tournament Manager</p>
          </div>
        </div>
      `
    });
    
    console.log('Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info) || 'Not available in production mode');
    
    return true;
  } catch (error) {
    console.error('Error testing Gmail connection:', error);
    return false;
  }
}

// Run the test
testGmailConnection()
  .then(success => {
    console.log('Test completed:', success ? 'SUCCESS' : 'FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  }); 