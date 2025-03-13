/**
 * Script to set a specific user as the owner
 * 
 * This script should be run once to designate the primary account as the owner
 * 
 * Usage: node src/scripts/setOwnerUser.js <email>
 * Example: node src/scripts/setOwnerUser.js owner@example.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function setOwnerUser() {
  try {
    // Get the email from command line arguments
    const email = process.argv[2];
    
    if (!email) {
      console.error('Please provide an email address.');
      console.log('Usage: node src/scripts/setOwnerUser.js <email>');
      return;
    }
    
    console.log(`Setting user with email "${email}" as the owner...`);
    
    // Find the user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`User with email "${email}" not found.`);
      return;
    }
    
    console.log(`Found user: ${user.username} (${user._id})`);
    
    // Update the user's role to 'owner'
    user.role = 'owner';
    await user.save();
    
    console.log(`Successfully set user "${user.username}" (${user.email}) as the owner.`);
  } catch (error) {
    console.error('Error setting owner user:', error);
  } finally {
    // Disconnect from MongoDB
    mongoose.disconnect();
  }
}

// Run the function
setOwnerUser(); 