/**
 * Google Forms Sync Script
 * 
 * This script automatically syncs player data from Google Forms for tournaments
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
 * Sync player data from Google Forms for all tournaments with sync enabled
 */
async function syncTournaments() {
  try {
    console.log('Starting Google Forms sync...');
    
    // Find all tournaments with Google Forms sync enabled
    const tournaments = await Tournament.find({
      'googleForms.syncEnabled': true,
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
        const lastSyncDate = tournament.googleForms.lastSyncDate || new Date(0);
        const syncFrequency = tournament.googleForms.syncFrequency || 10; // Default to 10 minutes
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
        
        // Get the already processed responses
        const processedResponses = tournament.googleForms.processedResponses || [];
        console.log(`Tournament has ${processedResponses.length} already processed responses`);
        
        // Get player data from the Google Form
        const { players, newResponseIds } = await googleDocsService.getPlayerDataFromForm(
          tokens,
          tournament.googleForms.formId,
          processedResponses
        );
        
        if (players.length === 0) {
          console.log(`No new players found in Google Form for tournament: ${tournament.name}`);
          
          // Update last sync date even if no players found
          await Tournament.findOneAndUpdate(
            { _id: tournament._id },
            { $set: { 'googleForms.lastSyncDate': new Date() } },
            { new: true }
          );
          
          console.log(`Updated last sync date for tournament: ${tournament.name}`);
          continue;
        }
        
        console.log(`Found ${players.length} new players in Google Form for tournament: ${tournament.name}`);
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
        
        // Update tournament using findOneAndUpdate to avoid version conflicts
        const updatedTournament = await Tournament.findOneAndUpdate(
          { _id: tournament._id },
          { 
            $set: { 'googleForms.lastSyncDate': new Date() },
            $addToSet: { 'googleForms.processedResponses': { $each: newResponseIds } }
          },
          { new: true }
        );
        
        if (!updatedTournament) {
          console.error(`Failed to update tournament ${tournament.name}`);
          continue;
        }
        
        console.log(`Added ${newResponseIds.length} response IDs to tracking`);
        console.log(`Tournament now has ${updatedTournament.googleForms.processedResponses.length} processed responses`);
        console.log(`Updated last sync date for tournament: ${tournament.name}`);
      } catch (error) {
        console.error(`Error processing tournament ${tournament.name}:`, error);
      }
    }
    
    console.log('Google Forms sync completed');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing tournaments:', error);
    process.exit(1);
  }
} 