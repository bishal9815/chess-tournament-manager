require('dotenv').config();
const mongoose = require('mongoose');
// Import models
require('./src/models/User');
require('./src/models/Player');
const Tournament = require('./src/models/Tournament');

async function checkTournaments() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    // Use lean() to get plain JavaScript objects and avoid populate
    const tournaments = await Tournament.find().lean().select('name status participants');
    console.log('Total tournaments:', tournaments.length);
    
    if (tournaments.length > 0) {
      console.log('Tournaments:');
      tournaments.forEach(t => {
        console.log(`- ${t.name} (ID: ${t._id}, Status: ${t.status}, Participants: ${t.participants ? t.participants.length : 0})`);
      });
    } else {
      console.log('No tournaments found in the database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

checkTournaments(); 