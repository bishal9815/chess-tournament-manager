const nodemailer = require('nodemailer');

/**
 * Email service for sending OTPs and other email notifications
 */
class EmailService {
  constructor() {
    this.transporter = null;
    // Initialize the transporter
    this.init();
  }

  /**
   * Initialize the email transporter
   */
  async init() {
    // Create a test account if in development mode
    if (process.env.NODE_ENV === 'development') {
      await this.setupDevTransport();
    } else {
      this.setupProdTransport();
    }
  }

  /**
   * Set up development transport using Ethereal (fake SMTP service)
   */
  async setupDevTransport() {
    try {
      // Create a test account at ethereal.email
      const testAccount = await nodemailer.createTestAccount();
      
      // Create a transporter using the test account
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      
      console.log('Using Ethereal Email for development');
      console.log('Ethereal Email credentials:', testAccount);
    } catch (error) {
      console.error('Failed to create test account:', error);
      // Fallback to regular transport
      this.setupProdTransport();
    }
  }

  /**
   * Set up production transport using configured email service
   */
  setupProdTransport() {
    // For Gmail, we'll use a more reliable configuration
    // Note: For Gmail to work, you need to:
    // 1. Enable "Less secure app access" in your Google account settings
    // 2. Or better, use an "App Password" if you have 2-factor authentication enabled
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Add these settings to improve deliverability
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP connection error:', error);
      } else {
        console.log('SMTP server is ready to take our messages');
      }
    });
  }

  /**
   * Send OTP verification email
   * @param {string} to - Recipient email
   * @param {string} otp - One-time password
   * @returns {Promise} - Nodemailer send mail promise
   */
  async sendOTPVerificationEmail(to, otp) {
    // Make sure transporter is initialized
    if (!this.transporter) {
      console.log('Transporter not initialized, initializing now...');
      await this.init();
      
      // If still not initialized, use a fallback for development
      if (!this.transporter && process.env.NODE_ENV === 'development') {
        console.log('Using fallback transporter for development');
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: 'ethereal.user@ethereal.email',
            pass: 'ethereal.password',
          },
          // This setting makes it work in "fake" mode - emails won't actually be sent
          // but the API will behave as if they were
          debug: true,
          logger: true
        });
      }
      
      // If still not initialized, throw an error
      if (!this.transporter) {
        throw new Error('Failed to initialize email transporter');
      }
    }
    
    const mailOptions = {
      from: `"Chess Tournament Manager" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Email Verification</h2>
          <p style="color: #555; font-size: 16px;">Thank you for registering with Chess Tournament Manager. Please use the following OTP to verify your email address:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <h1 style="color: #333; letter-spacing: 5px; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #555; font-size: 14px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #555; font-size: 14px;">If you did not request this verification, please ignore this email.</p>
          <div style="text-align: center; margin-top: 30px; color: #888; font-size: 12px;">
            <p>Chess Tournament Manager</p>
          </div>
        </div>
      `,
      // Add text alternative for email clients that don't support HTML
      text: `Your verification code is: ${otp}. This code will expire in 10 minutes.`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      // Log preview URL for development (Ethereal)
      if (process.env.NODE_ENV === 'development' && info.messageId) {
        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const emailServiceInstance = new EmailService();

module.exports = emailServiceInstance; 