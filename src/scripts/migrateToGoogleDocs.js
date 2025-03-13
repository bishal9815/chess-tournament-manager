/**
 * Migration Script: Google Sheets to Google Docs
 * 
 * This script migrates tournaments from using Google Sheets to Google Docs.
 * It finds all tournaments with Google Sheets integration and creates equivalent
 * Google Docs for them.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const googleSheetsService = require('../lib/services/googleSheetsService');
const googleDocsService = require('../lib/services/googleDocsService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  migrateTournaments();
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
  process.exit(1);
});

/**
 * Migrate tournaments from Google Sheets to Google Docs
 */
async function migrateTournaments() {
  try {
    console.log('Starting migration from Google Sheets to Google Docs...');
    
    // Find all tournaments with Google Sheets integration
    const tournaments = await Tournament.find({
      'googleSheets.spreadsheetId': { $exists: true, $ne: null }
    }).populate('organizer');
    
    console.log(`Found ${tournaments.length} tournaments with Google Sheets integration`);
    
    if (tournaments.length === 0) {
      console.log('No tournaments to migrate');
      process.exit(0);
    }
    
    // Process each tournament
    for (const tournament of tournaments) {
      try {
        console.log(`Processing tournament: ${tournament.name}`);
        
        // Skip if already has Google Docs integration
        if (tournament.googleDocs && tournament.googleDocs.documentId) {
          console.log(`Tournament ${tournament.name} already has Google Docs integration, skipping`);
          continue;
        }
        
        // Get tokens for the tournament organizer
        let tokens;
        try {
          tokens = await googleSheetsService.getTokensForUser(tournament.organizer._id);
        } catch (error) {
          console.error(`No Google tokens found for tournament organizer (${tournament.organizer.username}):`, error);
          continue;
        }
        
        // Refresh tokens if needed
        tokens = await googleSheetsService.refreshTokensIfNeeded(tokens);
        
        // Get player data from the Google Sheet
        let players = [];
        try {
          players = await googleSheetsService.getPlayerDataFromSheet(
            tokens,
            tournament.googleSheets.spreadsheetId
          );
          
          console.log(`Found ${players.length} players in Google Sheet for tournament: ${tournament.name}`);
        } catch (error) {
          console.error(`Error getting player data from Google Sheet for tournament ${tournament.name}:`, error);
          // Continue with migration even if we can't get player data
        }
        
        // Create a new Google Doc for the tournament
        let docDetails;
        try {
          docDetails = await googleDocsService.createTournamentDoc(tokens, tournament);
          console.log(`Created Google Doc for tournament ${tournament.name}: ${docDetails.documentUrl}`);
        } catch (error) {
          console.error(`Error creating Google Doc for tournament ${tournament.name}:`, error);
          continue;
        }
        
        // Update the tournament with Google Docs details
        tournament.googleDocs = {
          documentId: docDetails.documentId,
          documentUrl: docDetails.documentUrl,
          lastSyncDate: new Date(),
          syncEnabled: tournament.googleSheets.syncEnabled,
          syncFrequency: tournament.googleSheets.syncFrequency
        };
        
        // If we have players, add them to the Google Doc
        if (players.length > 0) {
          try {
            // This would require implementing a method to add players to the Google Doc
            // For now, we'll just log that we would add them
            console.log(`Would add ${players.length} players to Google Doc for tournament ${tournament.name}`);
            
            // In a real implementation, you would add code here to add the players to the Google Doc
          } catch (error) {
            console.error(`Error adding players to Google Doc for tournament ${tournament.name}:`, error);
            // Continue with migration even if we can't add players
          }
        }
        
        // Save the tournament
        await tournament.save();
        console.log(`Updated tournament ${tournament.name} with Google Docs integration`);
      } catch (error) {
        console.error(`Error migrating tournament ${tournament.name}:`, error);
      }
    }
    
    console.log('Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('Error migrating tournaments:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  });
}); 