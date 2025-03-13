/**
 * Google Docs Sync Script
 * 
 * This script automatically syncs player data from Google Docs for tournaments
 * that have sync enabled. It can be run as a cron job to periodically sync data.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const googleDocsService = require('../lib/services/googleDocsService');
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
 * Sync player data from Google Docs for all tournaments with sync enabled
 */
async function syncTournaments() {
  try {
    console.log('Starting Google Docs sync...');
    
    // Find all tournaments with Google Docs sync enabled
    const tournaments = await Tournament.find({
      'googleDocs.syncEnabled': true,
      'status': 'registration' // Only sync tournaments in registration phase
    }).populate('organizer');
    
    console.log(`Found ${tournaments.length} tournaments with sync enabled`);
    
    if (tournaments.length === 0) {
      // Check for legacy Google Sheets tournaments
      const legacyTournaments = await Tournament.find({
        'googleSheets.syncEnabled': true,
        'status': 'registration'
      }).populate('organizer');
      
      if (legacyTournaments.length > 0) {
        console.log(`Found ${legacyTournaments.length} legacy tournaments with Google Sheets sync enabled`);
        console.log('Please migrate these tournaments to Google Docs');
      }
      
      console.log('No tournaments to sync');
      process.exit(0);
    }
    
    // Process each tournament
    for (const tournament of tournaments) {
      try {
        console.log(`Processing tournament: ${tournament.name}`);
        
        // Check if it's time to sync based on the frequency
        const lastSyncDate = tournament.googleDocs.lastSyncDate || new Date(0);
        const syncFrequency = tournament.googleDocs.syncFrequency || 60; // Default to 60 minutes
        const nextSyncDate = new Date(lastSyncDate.getTime() + syncFrequency * 60 * 1000);
        
        if (nextSyncDate > new Date()) {
          console.log(`Skipping tournament ${tournament.name} - next sync scheduled at ${nextSyncDate}`);
          continue;
        }
        
        // Get tokens for the tournament organizer
        let tokens;
        try {
          tokens = await googleDocsService.getTokensForUser(tournament.organizer._id);
        } catch (error) {
          console.error(`No Google tokens found for tournament organizer (${tournament.organizer.username}):`, error);
          continue;
        }
        
        // Refresh tokens if needed
        tokens = await googleDocsService.refreshTokensIfNeeded(tokens);
        
        // Get the already processed data
        const processedData = tournament.googleDocs.processedDocData || [];
        console.log(`Tournament has ${processedData.length} already processed data entries`);
        
        // Get player data from the Google Doc
        const docResult = await googleDocsService.getPlayerDataFromDoc(
          tokens,
          tournament.googleDocs.documentId,
          processedData
        );
        
        const { players, newDataHashes } = docResult;
        
        if (players.length === 0) {
          console.log(`No new players found in Google Doc for tournament: ${tournament.name}`);
          
          // Update last sync date even if no players found
          await Tournament.findOneAndUpdate(
            { _id: tournament._id },
            { $set: { 'googleDocs.lastSyncDate': new Date() } },
            { new: true }
          );
          
          console.log(`Updated last sync date for tournament: ${tournament.name}`);
          continue;
        }
        
        console.log(`Found ${players.length} new players in Google Doc for tournament: ${tournament.name}`);
        console.log('Player data:', JSON.stringify(players, null, 2));
        
        // Process and store the player data
        const result = await processAndStorePlayerData(tournament._id, players);
        
        if (!result.success) {
          console.error(`Failed to process player data for tournament ${tournament.name}:`, result.error);
          continue;
        }
        
        console.log(`Successfully processed player data for tournament ${tournament.name}:`, {
          addedCount: result.addedCount,
          updatedCount: result.updatedCount,
          totalCount: result.totalCount
        });
        
        // Update the last sync date and processed data
        await Tournament.findOneAndUpdate(
          { _id: tournament._id },
          { 
            $set: { 'googleDocs.lastSyncDate': new Date() },
            $addToSet: { 'googleDocs.processedDocData': { $each: newDataHashes } }
          },
          { new: true }
        );
        
        console.log(`Added ${newDataHashes.length} data hashes to tracking`);
        console.log(`Updated last sync date for tournament: ${tournament.name}`);
      } catch (error) {
        console.error(`Error processing tournament ${tournament.name}:`, error);
      }
    }
    
    console.log('Google Docs sync completed');
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