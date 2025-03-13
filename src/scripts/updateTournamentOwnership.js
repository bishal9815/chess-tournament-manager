/**
 * Script to update existing tournaments to set the createdByOwner field based on the organizer's role
 * 
 * This script should be run once after deploying the changes to the Tournament model
 * 
 * Usage: node src/scripts/updateTournamentOwnership.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function updateTournamentOwnership() {
  try {
    console.log('Starting tournament ownership update...');
    
    // Find all users with the 'owner' role
    const ownerUsers = await User.find({ role: 'owner' });
    
    if (ownerUsers.length === 0) {
      console.log('No users with the "owner" role found. Please set at least one user as the owner.');
      return;
    }
    
    console.log(`Found ${ownerUsers.length} users with the "owner" role.`);
    
    // Get the IDs of all owner users
    const ownerIds = ownerUsers.map(user => user._id.toString());
    console.log('Owner IDs:', ownerIds);
    
    // Find all tournaments
    const tournaments = await Tournament.find().populate('organizer');
    console.log(`Found ${tournaments.length} tournaments.`);
    
    // Update tournaments where the organizer is an owner
    let updatedCount = 0;
    
    for (const tournament of tournaments) {
      if (tournament.organizer && ownerIds.includes(tournament.organizer._id.toString())) {
        console.log(`Updating tournament "${tournament.name}" (${tournament._id}) - Created by owner: ${tournament.organizer.username}`);
        
        tournament.createdByOwner = true;
        await tournament.save();
        
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} tournaments to set createdByOwner = true.`);
    console.log('Tournament ownership update completed successfully.');
  } catch (error) {
    console.error('Error updating tournament ownership:', error);
  } finally {
    // Disconnect from MongoDB
    mongoose.disconnect();
  }
}

// Run the update function
updateTournamentOwnership(); 