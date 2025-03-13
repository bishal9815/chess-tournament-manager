/**
 * Chess.com API Integration
 * 
 * Utility functions for fetching player information and ratings from Chess.com's public API.
 * API Documentation: https://www.chess.com/news/view/published-data-api
 */

const fetch = require('node-fetch');

/**
 * Get player information from Chess.com API
 * @param {string} username - Chess.com username
 * @returns {Promise<Object>} - Player information
 */
async function getPlayerInfo(username) {
  try {
    // Validate username
    if (!username || typeof username !== 'string') {
      throw new Error('Invalid username');
    }
    
    // Clean username
    const cleanUsername = username.trim().toLowerCase();
    
    // Fetch player data from Chess.com API
    const response = await fetch(`https://api.chess.com/pub/player/${cleanUsername}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Player '${cleanUsername}' not found on Chess.com`);
      }
      throw new Error(`Chess.com API error: ${response.statusText}`);
    }
    
    const playerData = await response.json();
    
    // Fetch player stats for rating
    const statsResponse = await fetch(`https://api.chess.com/pub/player/${cleanUsername}/stats`);
    
    if (!statsResponse.ok) {
      console.warn(`Could not fetch stats for player ${cleanUsername}`);
    }
    
    let rating = null;
    
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      
      // Try to get the classical rating first, then rapid, then blitz, then bullet
      if (statsData.chess_rapid && statsData.chess_rapid.last) {
        rating = statsData.chess_rapid.last.rating;
      } else if (statsData.chess_blitz && statsData.chess_blitz.last) {
        rating = statsData.chess_blitz.last.rating;
      } else if (statsData.chess_bullet && statsData.chess_bullet.last) {
        rating = statsData.chess_bullet.last.rating;
      }
    }
    
    return {
      username: playerData.username,
      name: playerData.name || playerData.username,
      country: playerData.country,
      rating,
      url: playerData.url,
      avatar: playerData.avatar
    };
  } catch (error) {
    console.error('Error fetching player info from Chess.com:', error);
    throw error;
  }
}

/**
 * Get information for multiple players from Chess.com API
 * @param {Array<string>} usernames - Array of Chess.com usernames
 * @returns {Promise<Array<Object>>} - Array of player information
 */
async function batchGetPlayerInfo(usernames) {
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return [];
  }
  
  const results = [];
  const errors = [];
  
  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5;
  
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (username) => {
      try {
        const playerInfo = await getPlayerInfo(username);
        results.push(playerInfo);
        return { success: true, username, playerInfo };
      } catch (error) {
        errors.push({ username, error: error.message });
        return { success: false, username, error: error.message };
      }
    });
    
    await Promise.all(batchPromises);
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < usernames.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Log any errors
  if (errors.length > 0) {
    console.warn('Errors fetching Chess.com player data:', errors);
  }
  
  // Return just the results array
  return results;
}

module.exports = {
  getPlayerInfo,
  batchGetPlayerInfo
}; 