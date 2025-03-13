/**
 * Player Data Processor
 * 
 * Utility functions for combining and validating player data from different sources
 * (file uploads and Chess.com API).
 */

const { batchGetPlayerInfo } = require('./chessComApi');

/**
 * Validate and normalize a single player's data
 * @param {Object} player - Player data object
 * @returns {Object} - Validated and normalized player data
 */
function validatePlayerData(player) {
  // Ensure we have an object
  if (!player || typeof player !== 'object') {
    return null;
  }
  
  // Name is required
  if (!player.name || typeof player.name !== 'string' || !player.name.trim()) {
    return null;
  }
  
  // Normalize the data
  return {
    name: player.name.trim(),
    email: (player.email && typeof player.email === 'string') ? player.email.trim() : '',
    rating: (player.rating && !isNaN(parseInt(player.rating))) ? parseInt(player.rating) : null,
    chesscomUsername: (player.chesscomUsername && typeof player.chesscomUsername === 'string') 
      ? player.chesscomUsername.trim() : ''
  };
}

/**
 * Enhance player data with Chess.com information if available
 * @param {Array<Object>} players - Array of player data objects
 * @returns {Promise<Array<Object>>} - Enhanced player data
 */
async function enhanceWithChessComData(players) {
  // Validate and normalize all players first
  const validPlayers = players
    .map(validatePlayerData)
    .filter(player => player !== null);
  
  // Extract Chess.com usernames
  const chesscomUsernames = validPlayers
    .filter(player => player.chesscomUsername)
    .map(player => player.chesscomUsername);
  
  // If no Chess.com usernames, return the original data
  if (chesscomUsernames.length === 0) {
    return validPlayers;
  }
  
  try {
    // Fetch Chess.com data for all usernames
    const chesscomData = await batchGetPlayerInfo(chesscomUsernames);
    
    // Create a map for quick lookup
    const chesscomDataMap = new Map();
    chesscomData.forEach(data => {
      chesscomDataMap.set(data.username.toLowerCase(), data);
    });
    
    // Enhance player data with Chess.com information
    return validPlayers.map(player => {
      if (!player.chesscomUsername) {
        return player;
      }
      
      const chesscomInfo = chesscomDataMap.get(player.chesscomUsername.toLowerCase());
      
      if (!chesscomInfo) {
        return player;
      }
      
      // Use Chess.com rating if player doesn't have one
      const rating = player.rating || chesscomInfo.rating;
      
      // Use Chess.com name if available and player name is just username-like
      let name = player.name;
      if (chesscomInfo.name && 
          (player.name.toLowerCase() === player.chesscomUsername.toLowerCase() ||
           player.name.includes('@'))) {
        name = chesscomInfo.name;
      }
      
      return {
        ...player,
        name,
        rating,
        chesscomInfo
      };
    });
  } catch (error) {
    console.error('Error enhancing player data with Chess.com information:', error);
    // Return the original data if there's an error
    return validPlayers;
  }
}

/**
 * Process player data from multiple sources and combine into a unified format
 * @param {Array<Object>} fileData - Player data from file upload
 * @param {Array<Object>} manualData - Player data from manual entry
 * @returns {Promise<Array<Object>>} - Combined and enhanced player data
 */
async function processPlayerData(fileData = [], manualData = []) {
  // Combine data from both sources
  const combinedData = [...fileData, ...manualData];
  
  // If no data, return empty array
  if (combinedData.length === 0) {
    return [];
  }
  
  // Enhance with Chess.com data
  const enhancedData = await enhanceWithChessComData(combinedData);
  
  // Final validation and normalization
  return enhancedData.map(player => ({
    name: player.name,
    email: player.email || '',
    rating: player.rating || 1200,
    chesscomUsername: player.chesscomUsername || '',
    chesscomInfo: player.chesscomInfo || null
  }));
}

module.exports = {
  validatePlayerData,
  enhanceWithChessComData,
  processPlayerData
}; 