/**
 * Player Data Normalization Service
 * 
 * Provides functions to normalize player data from various sources
 * to ensure consistency and accuracy.
 */

/**
 * Normalize a player's name
 * - Proper capitalization
 * - Consistent spacing
 * - Handle special characters
 * 
 * @param {string} name - Player name to normalize
 * @returns {string} - Normalized name
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  
  // Trim whitespace and convert multiple spaces to single space
  let normalized = name.trim().replace(/\s+/g, ' ');
  
  // Capitalize first letter of each word
  normalized = normalized.replace(/\b\w/g, c => c.toUpperCase());
  
  // Handle hyphenated names (e.g., Smith-Jones)
  normalized = normalized.replace(/\b\w+-\w+/g, match => {
    return match.split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');
  });
  
  // Handle apostrophes (e.g., O'Brien)
  normalized = normalized.replace(/\b\w+'\w+/g, match => {
    return match.charAt(0).toUpperCase() + 
           match.slice(1, match.indexOf("'") + 1) + 
           match.charAt(match.indexOf("'") + 1).toUpperCase() + 
           match.slice(match.indexOf("'") + 2);
  });
  
  return normalized;
}

/**
 * Normalize an email address
 * - Convert to lowercase
 * - Trim whitespace
 * 
 * @param {string} email - Email to normalize
 * @returns {string} - Normalized email
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  
  // Trim whitespace and convert to lowercase
  return email.trim().toLowerCase();
}

/**
 * Normalize a Chess.com username
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove any invalid characters
 * 
 * @param {string} username - Chess.com username to normalize
 * @returns {string} - Normalized username
 */
function normalizeChesscomUsername(username) {
  if (!username || typeof username !== 'string') return '';
  
  // Trim whitespace and convert to lowercase
  let normalized = username.trim().toLowerCase();
  
  // Remove any characters that aren't allowed in Chess.com usernames
  normalized = normalized.replace(/[^a-z0-9_-]/g, '');
  
  return normalized;
}

/**
 * Normalize a player's rating
 * - Convert to integer
 * - Handle null/undefined/empty values
 * 
 * @param {number|string} rating - Rating to normalize
 * @returns {number|null} - Normalized rating
 */
function normalizeRating(rating) {
  if (rating === null || rating === undefined || rating === '') {
    return null;
  }
  
  // Convert to number if it's a string
  const numRating = typeof rating === 'string' ? parseInt(rating, 10) : rating;
  
  // Return null if it's not a valid number
  if (isNaN(numRating)) {
    return null;
  }
  
  return numRating;
}

/**
 * Normalize a complete player object
 * @param {Object} player - Player object to normalize
 * @returns {Object} - Normalized player object
 */
function normalizePlayer(player) {
  if (!player || typeof player !== 'object') {
    return null;
  }
  
  return {
    name: normalizeName(player.name),
    email: normalizeEmail(player.email),
    rating: normalizeRating(player.rating),
    chesscomUsername: normalizeChesscomUsername(player.chesscomUsername)
  };
}

/**
 * Normalize an array of player objects
 * @param {Array<Object>} players - Array of player objects to normalize
 * @returns {Array<Object>} - Array of normalized player objects
 */
function normalizePlayers(players) {
  if (!Array.isArray(players)) {
    return [];
  }
  
  return players
    .map(normalizePlayer)
    .filter(player => player !== null && player.name);
}

module.exports = {
  normalizeName,
  normalizeEmail,
  normalizeRating,
  normalizeChesscomUsername,
  normalizePlayer,
  normalizePlayers
}; 