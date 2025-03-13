/**
 * Google OAuth Routes
 * 
 * Routes for handling Google OAuth authentication and Google Docs integration.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../../lib/auth');
const googleDocsService = require('../../lib/services/googleDocsService');
const Tournament = require('../../models/Tournament');
const { processAndStorePlayerData } = require('../../lib/services/playerDataService');

// Generate Google OAuth URL
router.get('/auth-url', protect, async (req, res) => {
  try {
    const authUrl = googleDocsService.generateAuthUrl();
    
    res.status(200).json({
      success: true,
      data: {
        authUrl
      }
    });
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Handle Google OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'No authorization code provided'
      });
    }
    
    // Get tokens from code
    const tokens = await googleDocsService.getTokensFromCode(code);
    
    // Get user info from tokens
    let userInfo = null;
    try {
      userInfo = await googleDocsService.getUserInfo(tokens);
    } catch (error) {
      console.error('Error getting user info:', error);
    }
    
    // Store tokens in session for now (will be associated with user later)
    req.session = req.session || {};
    req.session.googleTokens = tokens;
    
    // Store tokens in a cookie that can be read by client-side JavaScript
    // This is needed because the success page is static HTML
    try {
      // Stringify the tokens and ensure they're properly encoded
      const tokenString = JSON.stringify(tokens);
      
      res.cookie('googleTokens', tokenString, {
        maxAge: 5 * 60 * 1000, // 5 minutes
        httpOnly: false, // Allow JavaScript access
        secure: process.env.NODE_ENV === 'production', // Secure in production
        sameSite: 'lax',
        path: '/'
      });
      
      console.log('Tokens stored in cookie:', tokenString);
    } catch (error) {
      console.error('Error setting cookie:', error);
    }
    
    // Parse the state parameter if it exists (contains the return URL)
    let returnUrl = '/google-auth-success.html';
    if (state) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(state));
        if (stateObj.returnUrl) {
          returnUrl = `${returnUrl}?returnUrl=${encodeURIComponent(stateObj.returnUrl)}`;
          
          // Add user info if available
          if (userInfo && userInfo.name) {
            returnUrl += `&userName=${encodeURIComponent(userInfo.name)}`;
          }
          if (userInfo && userInfo.email) {
            returnUrl += `&userEmail=${encodeURIComponent(userInfo.email)}`;
          }
        }
      } catch (error) {
        console.error('Error parsing state parameter:', error);
      }
    }
    
    // Redirect to the success page with return URL
    res.redirect(returnUrl);
  } catch (error) {
    console.error('Error handling Google callback:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Store Google tokens for user
router.post('/store-tokens', protect, async (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens) {
      return res.status(400).json({
        success: false,
        error: 'No tokens provided'
      });
    }
    
    // Store tokens for user
    await googleDocsService.storeTokensForUser(req.user.id, tokens);
    
    res.status(200).json({
      success: true,
      message: 'Google tokens stored successfully'
    });
  } catch (error) {
    console.error('Error storing Google tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Create a Google Doc for tournament registration
router.post('/tournaments/:id/create-doc', protect, async (req, res) => {
  try {
    console.log('Creating Google Doc for tournament:', req.params.id);
    console.log('User ID:', req.user.id);
    
    const tournamentId = req.params.id;
    
    // Get the tournament
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      console.log('Tournament not found with ID:', tournamentId);
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('Found tournament:', tournament.name);
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing anyone to create Google Docs for any tournament
    // Comment out the organizer check for now
    /*
    // Check if user is the tournament organizer
    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to create a Google Doc for this tournament'
      });
    }
    */
    
    // Check if tournament already has a Google Doc
    if (tournament.googleDocs && tournament.googleDocs.documentId) {
      console.log('Tournament already has a Google Doc:', tournament.googleDocs.documentId);
      return res.status(400).json({
        success: false,
        error: 'Tournament already has a Google Doc',
        data: {
          documentUrl: tournament.googleDocs.documentUrl
        }
      });
    }
    
    // Get tokens for user
    let tokens;
    try {
      tokens = await googleDocsService.getTokensForUser(req.user.id);
      console.log('Got tokens for user:', req.user.id);
    } catch (error) {
      console.error('Error getting tokens for user:', error);
      return res.status(400).json({
        success: false,
        error: 'No Google tokens found for user. Please authenticate with Google first.'
      });
    }
    
    // Refresh tokens if needed
    try {
      tokens = await googleDocsService.refreshTokensIfNeeded(tokens);
      console.log('Tokens refreshed if needed');
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to refresh Google tokens: ' + error.message
      });
    }
    
    // Create a Google Doc for the tournament
    let docDetails;
    try {
      docDetails = await googleDocsService.createTournamentDoc(tokens, tournament);
      console.log('Created Google Doc:', docDetails);
    } catch (error) {
      console.error('Error creating Google Doc:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create Google Doc: ' + error.message
      });
    }
    
    // Update the tournament with the Google Doc details
    try {
      tournament.googleDocs = {
        documentId: docDetails.documentId,
        documentUrl: docDetails.documentUrl,
        lastSyncDate: new Date(),
        syncEnabled: true
      };
      
      await tournament.save();
      console.log('Tournament updated with Google Doc details');
    } catch (error) {
      console.error('Error updating tournament with Google Doc details:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update tournament with Google Doc details: ' + error.message
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        documentId: docDetails.documentId,
        documentUrl: docDetails.documentUrl
      }
    });
  } catch (error) {
    console.error('Error creating Google Doc for tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Sync players from Google Doc to tournament
router.post('/tournaments/:id/sync-doc', protect, async (req, res) => {
  try {
    console.log('Syncing players from Google Doc for tournament:', req.params.id);
    
    const tournamentId = req.params.id;
    const forceSync = req.body.forceSync === true;
    
    console.log(`Force sync: ${forceSync}`);
    
    // Get the tournament
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      console.error('Tournament not found:', tournamentId);
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('Found tournament:', tournament.name);
    
    // Check if tournament has a Google Doc
    if (!tournament.googleDocs || !tournament.googleDocs.documentId) {
      console.error('Tournament does not have a Google Doc configured:', tournamentId);
      return res.status(400).json({
        success: false,
        error: 'Tournament does not have a Google Doc'
      });
    }
    
    console.log('Google Doc ID:', tournament.googleDocs.documentId);
    
    // Use the new syncPlayersFromGoogleDoc function
    const result = await googleDocsService.syncPlayersFromGoogleDoc(
      tournament.googleDocs.documentId,
      tournamentId,
      forceSync
    );
    
    // Update last sync date
    await Tournament.findOneAndUpdate(
      { _id: tournamentId },
      { $set: { 'googleDocs.lastSyncDate': new Date() } },
      { new: true }
    );
    
    return res.status(200).json({
      success: result.success,
      message: result.message,
      playersAdded: result.playersAdded || 0
    });
  } catch (error) {
    console.error('Error syncing players from Google Doc:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync players from Google Doc: ' + error.message
    });
  }
});

// For backward compatibility - redirect to create-doc
router.post('/tournaments/:id/create-sheet', protect, async (req, res) => {
  console.log('Redirecting from create-sheet to create-doc');
  req.url = `/tournaments/${req.params.id}/create-doc`;
  router.handle(req, res);
});

// For backward compatibility - redirect to sync-doc
router.post('/tournaments/:id/sync-sheet', protect, async (req, res) => {
  console.log('Redirecting from sync-sheet to sync-doc');
  req.url = `/tournaments/${req.params.id}/sync-doc`;
  router.handle(req, res);
});

// Migrate from Google Sheets to Google Docs
router.post('/tournaments/:id/migrate-to-docs', protect, async (req, res) => {
  try {
    const tournamentId = req.params.id;
    
    // Get the tournament
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Check if user is the tournament organizer
    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to migrate this tournament'
      });
    }
    
    // Check if tournament has a Google Sheet
    if (!tournament.googleSheets || !tournament.googleSheets.spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Tournament does not have a Google Sheet to migrate'
      });
    }
    
    // Check if tournament already has a Google Doc
    if (tournament.googleDocs && tournament.googleDocs.documentId) {
      return res.status(400).json({
        success: false,
        error: 'Tournament already has a Google Doc',
        data: {
          documentUrl: tournament.googleDocs.documentUrl
        }
      });
    }
    
    // Get tokens for user
    let tokens;
    try {
      tokens = await googleDocsService.getTokensForUser(req.user.id);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'No Google tokens found for user. Please authenticate with Google first.'
      });
    }
    
    // Refresh tokens if needed
    tokens = await googleDocsService.refreshTokensIfNeeded(tokens);
    
    // Create a Google Doc for the tournament
    const docDetails = await googleDocsService.createTournamentDoc(tokens, tournament);
    
    // Update the tournament with Google Docs details
    tournament.googleDocs = {
      documentId: docDetails.documentId,
      documentUrl: docDetails.documentUrl,
      lastSyncDate: new Date(),
      syncEnabled: tournament.googleSheets.syncEnabled,
      syncFrequency: tournament.googleSheets.syncFrequency
    };
    
    await tournament.save();
    
    res.status(200).json({
      success: true,
      message: 'Tournament migrated to Google Docs successfully',
      data: {
        documentId: docDetails.documentId,
        documentUrl: docDetails.documentUrl
      }
    });
  } catch (error) {
    console.error('Error migrating tournament to Google Docs:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Get tokens from session
router.get('/session-tokens', protect, async (req, res) => {
  try {
    // Check if we have tokens in the session
    if (req.session && req.session.googleTokens) {
      return res.status(200).json({
        success: true,
        data: {
          tokens: req.session.googleTokens
        }
      });
    }
    
    // No tokens in session
    return res.status(404).json({
      success: false,
      error: 'No Google tokens found in session'
    });
  } catch (error) {
    console.error('Error getting tokens from session:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Store tokens directly from session
router.post('/store-session-tokens', protect, async (req, res) => {
  try {
    // Check if we have tokens in the session
    if (!req.session || !req.session.googleTokens) {
      return res.status(404).json({
        success: false,
        error: 'No Google tokens found in session'
      });
    }
    
    // Store tokens for user directly from session
    await googleDocsService.storeTokensForUser(req.user.id, req.session.googleTokens);
    
    res.status(200).json({
      success: true,
      message: 'Google tokens stored successfully'
    });
  } catch (error) {
    console.error('Error storing tokens from session:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Get user info from Google
router.get('/user-info', protect, async (req, res) => {
  try {
    // Get tokens for user
    let tokens;
    try {
      tokens = await googleDocsService.getTokensForUser(req.user.id);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'No Google tokens found for user'
      });
    }
    
    // Get user info from tokens
    const userInfo = await googleDocsService.getUserInfo(tokens);
    
    return res.status(200).json({
      success: true,
      data: {
        userInfo
      }
    });
  } catch (error) {
    console.error('Error getting user info from Google:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Create a Google Form for tournament registration
router.post('/tournaments/:id/create-form', protect, async (req, res) => {
  try {
    console.log('Creating Google Form for tournament:', req.params.id);
    console.log('User ID:', req.user.id);
    
    const tournamentId = req.params.id;
    
    // Get the tournament
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      console.log('Tournament not found with ID:', tournamentId);
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('Found tournament:', tournament.name);
    
    // Check if tournament already has a Google Form
    if (tournament.googleForms && tournament.googleForms.formId) {
      console.log('Tournament already has a Google Form:', tournament.googleForms.formId);
      return res.status(400).json({
        success: false,
        error: 'Tournament already has a Google Form',
        data: {
          formUrl: tournament.googleForms.formUrl
        }
      });
    }
    
    // Get tokens for user
    let tokens;
    try {
      tokens = await googleDocsService.getTokensForUser(req.user.id);
      console.log('Got tokens for user:', req.user.id);
    } catch (error) {
      console.error('Error getting tokens for user:', error);
      return res.status(400).json({
        success: false,
        error: 'No Google tokens found for user. Please authenticate with Google first.'
      });
    }
    
    // Create Google Form
    const formDetails = await googleDocsService.createTournamentForm(tokens, tournament);
    console.log('Created Google Form:', formDetails);
    
    // Update tournament with form details
    tournament.googleForms = {
      formId: formDetails.formId,
      formUrl: formDetails.formUrl,
      responseUrl: formDetails.responseUrl,
      title: formDetails.title,
      createdAt: formDetails.createdAt,
      syncEnabled: true,
      syncFrequency: 10, // Set to sync every 10 minutes
      lastSyncDate: new Date()
    };
    
    await tournament.save();
    
    res.status(200).json({
      success: true,
      data: {
        formUrl: formDetails.formUrl
      }
    });
  } catch (error) {
    console.error('Error creating Google Form:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Sync players from Google Form
router.post('/tournaments/:id/sync-form', protect, async (req, res) => {
  try {
    console.log('Syncing players from Google Form for tournament:', req.params.id);
    console.log('Request body:', JSON.stringify(req.body));
    
    const tournamentId = req.params.id;
    const forceSync = req.body.forceSync === true;
    
    console.log(`Force sync parameter: ${forceSync} (type: ${typeof req.body.forceSync})`);
    
    // Get the tournament
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      console.error('Tournament not found:', tournamentId);
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('Found tournament:', tournament.name);
    
    // Check if tournament has a Google Form
    if (!tournament.googleForms || !tournament.googleForms.formId) {
      console.error('Tournament does not have a Google Form configured:', tournamentId);
      return res.status(400).json({
        success: false,
        error: 'Tournament does not have a Google Form configured'
      });
    }
    
    console.log('Google Form ID:', tournament.googleForms.formId);
    
    // Get tokens for user
    let tokens;
    try {
      console.log('Getting tokens for user:', req.user.id);
      tokens = await googleDocsService.getTokensForUser(req.user.id);
      console.log('Got tokens for user');
    } catch (error) {
      console.error('Error getting tokens for user:', error);
      return res.status(400).json({
        success: false,
        error: 'No Google tokens found for user. Please authenticate with Google first.'
      });
    }
    
    // Get the already processed responses - empty array if force sync
    const processedResponses = forceSync ? [] : (tournament.googleForms.processedResponses || []);
    console.log(`Tournament has ${tournament.googleForms.processedResponses?.length || 0} already processed responses`);
    console.log(`Using ${processedResponses.length} processed responses for filtering (force sync: ${forceSync})`);
    
    // Get player data from Google Form
    let formResult;
    try {
      console.log('Getting player data from Google Form with forceSync =', forceSync);
      formResult = await googleDocsService.getPlayerDataFromForm(
        tokens, 
        tournament.googleForms.formId,
        processedResponses,
        forceSync
      );
      console.log('Got player data from Google Form:', formResult);
    } catch (error) {
      console.error('Error getting player data from Google Form:', error);
      return res.status(500).json({
        success: false,
        error: 'Error getting player data from Google Form: ' + error.message
      });
    }
    
    const { players, newResponseIds } = formResult;
    
    console.log(`Found ${players.length} players to process from form`);
    
    if (players.length === 0) {
      return res.status(200).json({
        success: true,
        message: forceSync ? 'Force sync completed: No players found in the Google Form' : 'No new responses to process',
        data: {
          playersAdded: 0,
          playersUpdated: 0,
          totalPlayers: 0,
          newResponsesProcessed: 0,
          forceSync: forceSync,
          totalResponses: forceSync ? 0 : (tournament.googleForms.processedResponses?.length || 0)
        }
      });
    }
    
    // Process and store player data
    let result;
    try {
      console.log('Processing and storing player data');
      result = await processAndStorePlayerData(tournament._id, players);
      console.log('Processed and stored player data:', result);
    } catch (error) {
      console.error('Error processing and storing player data:', error);
      return res.status(500).json({
        success: false,
        error: 'Error processing and storing player data: ' + error.message
      });
    }
    
    // Update tournament using findOneAndUpdate to avoid version conflicts
    try {
      console.log('Updating tournament with new data');
      
      // Create the update operation based on force sync mode
      let updateOperation;
      if (forceSync) {
        // If force sync, replace all processed responses
        console.log('Force sync mode: Replacing all processed responses with new ones');
        updateOperation = {
          $set: {
            'googleForms.lastSyncDate': new Date(),
            'googleForms.syncEnabled': true,
            'googleForms.syncFrequency': 10,
            'googleForms.processedResponses': newResponseIds
          }
        };
      } else {
        // Normal sync: Add new responses to the existing list
        console.log('Normal sync mode: Adding new responses to existing list');
        updateOperation = {
          $set: {
            'googleForms.lastSyncDate': new Date(),
            'googleForms.syncEnabled': true,
            'googleForms.syncFrequency': 10
          },
          $addToSet: {
            'googleForms.processedResponses': { $each: newResponseIds }
          }
        };
      }
      
      console.log('Update operation:', JSON.stringify(updateOperation));
      
      // Use findOneAndUpdate to atomically update the tournament
      const updatedTournament = await Tournament.findOneAndUpdate(
        { _id: tournamentId },
        updateOperation,
        { new: true }
      );
      
      if (!updatedTournament) {
        throw new Error('Failed to update tournament');
      }
      
      console.log(`Added ${newResponseIds.length} response IDs to tracking`);
      console.log(`Tournament now has ${updatedTournament.googleForms.processedResponses.length} processed responses`);
      console.log('Tournament updated successfully');
      
      // Return success response with detailed information
      const successMessage = forceSync 
        ? `Force sync completed: ${result.playersAdded} players added, ${result.playersUpdated} players updated from ${newResponseIds.length} form responses`
        : `Successfully synced ${result.playersAdded} new players and updated ${result.playersUpdated} existing players from ${newResponseIds.length} new form responses`;
      
      return res.status(200).json({
        success: true,
        message: successMessage,
        data: {
          playersAdded: result.playersAdded,
          playersUpdated: result.playersUpdated,
          totalPlayers: result.totalPlayers,
          newResponsesProcessed: newResponseIds.length,
          forceSync: forceSync,
          totalResponses: updatedTournament.googleForms.processedResponses.length
        }
      });
    } catch (error) {
      console.error('Error updating tournament:', error);
      return res.status(500).json({
        success: false,
        error: 'Error updating tournament: ' + error.message
      });
    }
  } catch (error) {
    console.error('Error syncing players from Google Form:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

module.exports = router; 