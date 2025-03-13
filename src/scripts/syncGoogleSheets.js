/**
 * Google Sheets Sync Script
 * 
 * This script automatically syncs player data from Google Sheets for tournaments
 * that have sync enabled. It can be run as a cron job to periodically sync data.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const googleSheetsService = require('../lib/services/googleSheetsService');
const { processAndStorePlayerData } = require('../lib/services/playerDataService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  syncTournaments();
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
  process.exit(1);
});

/**
 * Sync player data from Google Sheets for all tournaments with sync enabled
 */
async function syncTournaments() {
  try {
    console.log('Starting Google Sheets sync...');
    
    // Find all tournaments with Google Sheets sync enabled
    const tournaments = await Tournament.find({
      'googleSheets.syncEnabled': true,
      'status': 'registration' // Only sync tournaments in registration phase
    }).populate('organizer');
    
    console.log(`Found ${tournaments.length} tournaments with sync enabled`);
    
    if (tournaments.length === 0) {
      console.log('No tournaments to sync');
      process.exit(0);
    }
    
    // Process each tournament
    for (const tournament of tournaments) {
      try {
        console.log(`Processing tournament: ${tournament.name}`);
        
        // Check if it's time to sync based on the frequency
        const lastSyncDate = tournament.googleSheets.lastSyncDate || new Date(0);
        const syncFrequency = tournament.googleSheets.syncFrequency || 60; // Default to 60 minutes
        const nextSyncDate = new Date(lastSyncDate.getTime() + syncFrequency * 60 * 1000);
        
        if (nextSyncDate > new Date()) {
          console.log(`Skipping tournament ${tournament.name} - next sync scheduled at ${nextSyncDate}`);
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
        const players = await googleSheetsService.getPlayerDataFromSheet(
          tokens,
          tournament.googleSheets.spreadsheetId
        );
        
        if (players.length === 0) {
          console.log(`No players found in Google Sheet for tournament: ${tournament.name}`);
          
          // Update last sync date even if no players found
          tournament.googleSheets.lastSyncDate = new Date();
          await tournament.save();
          
          continue;
        }
        
        console.log(`Found ${players.length} players in Google Sheet for tournament: ${tournament.name}`);
        
        // Process and store the player data
        const result = await processAndStorePlayerData({
          manualData: players,
          storeInDatabase: true
        });
        
        if (!result.success) {
          console.error(`Failed to process player data for tournament ${tournament.name}:`, result.error);
          continue;
        }
        
        // Add the stored players to the tournament
        const addedPlayers = [];
        
        for (const player of result.storedPlayers) {
          // Check if player is already registered for this tournament
          const isRegistered = tournament.participants.some(
            p => p.player && p.player.toString() === player._id.toString()
          );
          
          if (!isRegistered) {
            // Add player to tournament
            tournament.participants.push({
              player: player._id,
              confirmed: true,
              paid: false,
              score: 0,
              tieBreak: 0
            });
            
            addedPlayers.push(player);
          }
        }
        
        // Update the last sync date
        tournament.googleSheets.lastSyncDate = new Date();
        
        await tournament.save();
        
        console.log(`Added ${addedPlayers.length} new players to tournament: ${tournament.name}`);
      } catch (error) {
        console.error(`Error processing tournament ${tournament.name}:`, error);
      }
    }
    
    console.log('Google Sheets sync completed');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing tournaments:', error);
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