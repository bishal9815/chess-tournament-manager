/**
 * Player Data Service
 * 
 * A comprehensive service for processing player data from various sources
 * (manual input, file uploads, Chess.com API) with validation, normalization,
 * deduplication, and storage.
 */

const { validatePlayer, validatePlayers } = require('../validation/playerValidation');
const { normalizePlayer, normalizePlayers } = require('../normalization/playerNormalization');
const { deduplicatePlayers } = require('../deduplication/playerDeduplication');
const { getPlayerInfo, batchGetPlayerInfo } = require('../chessComApi');
const User = require('../../models/User');
const Player = require('../../models/Player');

/**
 * Process player data from manual input
 * 
 * @param {Array<Object>} players - Array of player objects from manual input
 * @returns {Promise<Object>} - Processing results
 */
async function processManualPlayerData(players) {
  // Validate input
  if (!Array.isArray(players) || players.length === 0) {
    return {
      success: false,
      error: 'No valid player data provided',
      processedPlayers: [],
      invalidPlayers: [],
      duplicates: []
    };
  }
  
  // Step 1: Normalize the data
  const normalizedPlayers = normalizePlayers(players);
  
  // Step 2: Validate the normalized data
  const validationResult = validatePlayers(normalizedPlayers);
  
  if (validationResult.validPlayers.length === 0) {
    return {
      success: false,
      error: 'No valid players after validation',
      processedPlayers: [],
      invalidPlayers: validationResult.invalidPlayers,
      duplicates: []
    };
  }
  
  // Step 3: Enhance with Chess.com data if usernames are provided
  const playersWithChesscomData = await enhanceWithChesscomData(validationResult.validPlayers);
  
  // Step 4: Deduplicate the players
  const { deduplicatedPlayers, duplicateGroups } = deduplicatePlayers(playersWithChesscomData);
  
  return {
    success: true,
    processedPlayers: deduplicatedPlayers,
    invalidPlayers: validationResult.invalidPlayers,
    duplicates: duplicateGroups
  };
}

/**
 * Process player data from file upload
 * 
 * @param {Array<Object>} fileData - Array of player objects from file upload
 * @returns {Promise<Object>} - Processing results
 */
async function processFilePlayerData(fileData) {
  // Validate input
  if (!Array.isArray(fileData) || fileData.length === 0) {
    return {
      success: false,
      error: 'No valid player data found in file',
      processedPlayers: [],
      invalidPlayers: [],
      duplicates: []
    };
  }
  
  // The processing steps are the same as for manual data
  return processManualPlayerData(fileData);
}

/**
 * Enhance player data with Chess.com information
 * 
 * @param {Array<Object>} players - Array of player objects
 * @returns {Promise<Array<Object>>} - Enhanced player objects
 */
async function enhanceWithChesscomData(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  // Extract players with Chess.com usernames
  const playersWithUsernames = players.filter(p => p.chesscomUsername);
  
  if (playersWithUsernames.length === 0) {
    return players; // No usernames to look up
  }
  
  try {
    // Get usernames to look up
    const usernames = playersWithUsernames.map(p => p.chesscomUsername);
    
    // Fetch Chess.com data
    const chesscomData = await batchGetPlayerInfo(usernames);
    
    // Create a map for quick lookup
    const chesscomDataMap = new Map();
    chesscomData.forEach(data => {
      chesscomDataMap.set(data.username.toLowerCase(), data);
    });
    
    // Enhance player data
    return players.map(player => {
      if (!player.chesscomUsername) {
        return player;
      }
      
      const chesscomInfo = chesscomDataMap.get(player.chesscomUsername.toLowerCase());
      
      if (!chesscomInfo) {
        return player;
      }
      
      // Use Chess.com name if player name is empty or just username-like
      let name = player.name;
      if (chesscomInfo.name && 
          (!player.name || 
           player.name.toLowerCase() === player.chesscomUsername.toLowerCase())) {
        name = chesscomInfo.name;
      }
      
      // Use Chess.com rating if player doesn't have one or Chess.com rating is higher
      const rating = !player.rating || (chesscomInfo.rating > player.rating) ? 
        chesscomInfo.rating : player.rating;
      
      return {
        ...player,
        name,
        rating,
        chesscomData: chesscomInfo
      };
    });
  } catch (error) {
    console.error('Error enhancing with Chess.com data:', error);
    return players; // Return original players if there's an error
  }
}

/**
 * Store processed player data in the database
 * 
 * @param {Array<Object>} players - Array of processed player objects
 * @returns {Promise<Array<Object>>} - Stored player objects
 */
async function storePlayerData(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  const storedPlayers = [];
  
  for (const playerData of players) {
    try {
      // Check if player already exists in the database
      let player = null;
      
      // Try to find by email first (most reliable identifier)
      if (playerData.email) {
        player = await User.findOne({ email: playerData.email });
      }
      
      // If not found by email, try Chess.com username
      if (!player && playerData.chesscomUsername) {
        player = await User.findOne({ chesscomUsername: playerData.chesscomUsername });
      }
      
      // If player exists, update their information
      if (player) {
        // Update player data, but don't overwrite existing data with empty values
        const updates = {};
        
        if (playerData.name && (!player.firstName || !player.lastName)) {
          // Split name into first and last name
          const nameParts = playerData.name.split(' ');
          updates.firstName = nameParts[0] || player.firstName || '';
          updates.lastName = nameParts.slice(1).join(' ') || player.lastName || '';
        }
        
        if (playerData.rating && (!player.chessRating || player.chessRating < playerData.rating)) {
          updates.chessRating = playerData.rating;
        }
        
        if (playerData.chesscomUsername && !player.chesscomUsername) {
          updates.chesscomUsername = playerData.chesscomUsername;
        }
        
        if (playerData.chesscomData && !player.chesscomData) {
          updates.chesscomData = playerData.chesscomData;
        }
        
        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          player = await User.findByIdAndUpdate(
            player._id,
            updates,
            { new: true }
          );
        }
      } else {
        // Create a new player
        const nameParts = playerData.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Generate a username from email or name
        let username = '';
        if (playerData.email) {
          username = playerData.email.split('@')[0];
        } else if (playerData.chesscomUsername) {
          username = playerData.chesscomUsername;
        } else {
          username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
        }
        
        // Generate a random password
        const password = Math.random().toString(36).slice(-8);
        
        player = await User.create({
          username,
          email: playerData.email || `${username}@temp.com`,
          password,
          firstName,
          lastName,
          chessRating: playerData.rating || 1200,
          chesscomUsername: playerData.chesscomUsername || '',
          chesscomData: playerData.chesscomData || null,
          role: 'user'
        });
      }
      
      storedPlayers.push(player);
    } catch (error) {
      console.error('Error storing player:', error);
      // Continue with next player
    }
  }
  
  return storedPlayers;
}

/**
 * Store players directly without processing
 * @param {Array<Object>} players - Array of player objects
 * @returns {Promise<Array<Object>>} - Array of stored player objects
 */
async function storePlayersDirectly(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  const storedPlayers = [];
  const Player = require('../../models/Player');
  
  for (const playerData of players) {
    try {
      console.log('Directly storing player:', playerData);
      
      // Create new player
      const player = await Player.create({
        firstName: playerData.firstName || '',
        lastName: playerData.lastName || '',
        email: playerData.email || '',
        chessRating: playerData.chessRating || playerData.rating || null
      });
      
      storedPlayers.push(player);
    } catch (error) {
      console.error('Error directly storing player:', error);
    }
  }
  
  return storedPlayers;
}

/**
 * Process and store player data from multiple sources
 * 
 * @param {string} tournamentId - ID of the tournament to add players to
 * @param {Array<Object>} players - Player data to process and store
 * @returns {Promise<Object>} - Processing results
 */
async function processAndStorePlayerData(tournamentId, players = []) {
  try {
    console.log('processAndStorePlayerData called with tournamentId:', tournamentId);
    console.log('Players data:', JSON.stringify(players));
    
    if (!tournamentId) {
      console.error('No tournament ID provided');
      return {
        success: false,
        error: 'No tournament ID provided',
        addedCount: 0,
        updatedCount: 0,
        totalCount: 0
      };
    }
    
    if (!Array.isArray(players) || players.length === 0) {
      console.log('No valid player data provided');
      return {
        success: false,
        error: 'No valid player data provided',
        addedCount: 0,
        updatedCount: 0,
        totalCount: 0
      };
    }
    
    // Store players in the database
    const Player = require('../../models/Player');
    const Tournament = require('../../models/Tournament');
    
    // Find the tournament
    console.log('Finding tournament with ID:', tournamentId);
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      console.error('Tournament not found:', tournamentId);
      return {
        success: false,
        error: 'Tournament not found',
        addedCount: 0,
        updatedCount: 0,
        totalCount: 0
      };
    }
    
    console.log('Found tournament:', tournament.name);
    
    let addedCount = 0;
    let updatedCount = 0;
    
    // Process each player
    for (const playerData of players) {
      try {
        console.log('Processing player:', JSON.stringify(playerData));
        
        // Extract player information
        // Check if name exists and extract first and last name from it
        let firstName = playerData.firstName || '';
        let lastName = playerData.lastName || '';
        
        // If name is provided but firstName/lastName aren't, parse the name
        if (playerData.name && (!firstName || !lastName)) {
          const nameParts = playerData.name.split(' ');
          firstName = firstName || nameParts[0] || '';
          lastName = lastName || nameParts.slice(1).join(' ') || '';
          console.log('Parsed name into firstName and lastName:', { firstName, lastName });
        }
        
        // Ensure we have at least a first name
        if (!firstName && !lastName && !playerData.name) {
          console.error('Player data missing name information');
          continue; // Skip this player
        }
        
        const email = playerData.email || '';
        const chessRating = playerData.chessRating || playerData.rating || null;
        const location = playerData.location || '';
        const chesscomUsername = playerData.chesscomUsername || '';
        
        console.log('Extracted player info:', { firstName, lastName, email, chessRating, location, chesscomUsername });
        
        // Check if player already exists
        let player = null;
        
        // Try to find by email first
        if (email) {
          console.log('Looking for player by email:', email);
          player = await Player.findOne({ email });
          if (player) {
            console.log('Found player by email:', player._id);
          }
        }
        
        // If not found by email, try name
        if (!player && firstName && lastName) {
          console.log('Looking for player by name:', firstName, lastName);
          player = await Player.findOne({
            firstName,
            lastName
          });
          if (player) {
            console.log('Found player by name:', player._id);
          }
        }
        
        // Create or update player
        if (player) {
          console.log('Updating existing player:', player._id);
          
          // Update existing player if needed
          let updated = false;
          
          if (chessRating && (!player.chessRating || chessRating > player.chessRating)) {
            player.chessRating = chessRating;
            updated = true;
          }
          
          if (location && !player.location) {
            player.location = location;
            updated = true;
          }
          
          if (chesscomUsername && !player.chesscomUsername) {
            player.chesscomUsername = chesscomUsername;
            updated = true;
          }
          
          if (updated) {
            await player.save();
            updatedCount++;
            console.log('Updated player:', player._id);
          } else {
            console.log('No updates needed for player:', player._id);
          }
        } else {
          console.log('Creating new player with:', { firstName, lastName, email, chessRating, location, chesscomUsername });
          
          // Create new player
          player = await Player.create({
            firstName,
            lastName,
            email,
            chessRating,
            location,
            chesscomUsername
          });
          
          console.log('Created new player:', player._id);
          addedCount++;
        }
        
        // Check if player is already in the tournament
        console.log('Checking if player is already in tournament:', player._id);
        const isPlayerInTournament = tournament.participants.some(
          p => p.player && p.player.toString() === player._id.toString()
        );
        
        if (!isPlayerInTournament) {
          // Add player to tournament
          console.log('Adding player to tournament participants:', player._id);
          tournament.participants.push({
            player: player._id,
            confirmed: true,
            paid: false,
            score: 0
          });
          
          console.log('Added player to tournament:', player.firstName, player.lastName);
        } else {
          console.log('Player already in tournament:', player.firstName, player.lastName);
        }
      } catch (error) {
        console.error('Error processing player:', error);
      }
    }
    
    // Save tournament
    console.log('Saving tournament with updated participants');
    await tournament.save();
    console.log('Tournament saved successfully');
    
    return {
      success: true,
      addedCount,
      updatedCount,
      totalCount: addedCount + updatedCount
    };
  } catch (error) {
    console.error('Error processing player data:', error);
    return {
      success: false,
      error: `Error processing player data: ${error.message}`,
      addedCount: 0,
      updatedCount: 0,
      totalCount: 0
    };
  }
}

module.exports = {
  processManualPlayerData,
  processFilePlayerData,
  enhanceWithChesscomData,
  storePlayerData,
  storePlayersDirectly,
  processAndStorePlayerData
}; 