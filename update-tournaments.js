require('dotenv').config();
const mongoose = require('mongoose');
const Tournament = require('./src/models/Tournament');

async function updateTournaments() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    // Find all tournaments that don't have isPublic field set
    const tournaments = await Tournament.find({ isPublic: { $exists: false } });
    console.log(`Found ${tournaments.length} tournaments without isPublic field`);
    
    // Update all tournaments to set isPublic to true
    const result = await Tournament.updateMany(
      { isPublic: { $exists: false } },
      { $set: { isPublic: true } }
    );
    
    console.log(`Updated ${result.modifiedCount} tournaments to set isPublic = true`);
    console.log('Tournament update completed successfully');
  } catch (error) {
    console.error('Error updating tournaments:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

updateTournaments(); 