/**
 * Player Data Deduplication Service
 * 
 * Provides functions to identify and merge duplicate player records
 * from various sources to ensure data consistency.
 */

/**
 * Calculate similarity score between two strings
 * Uses Levenshtein distance algorithm
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Calculate Levenshtein distance
  const track = Array(s2.length + 1).fill(null).map(() => 
    Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  
  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  // Return similarity score (1 - normalized distance)
  return 1 - (distance / maxLength);
}

/**
 * Calculate similarity score between two player objects
 * 
 * @param {Object} player1 - First player object
 * @param {Object} player2 - Second player object
 * @returns {Object} - Similarity scores and overall score
 */
function calculatePlayerSimilarity(player1, player2) {
  if (!player1 || !player2) return { overall: 0 };
  
  // Calculate similarity for each field
  const nameSimilarity = calculateStringSimilarity(player1.name, player2.name);
  
  // Email is a strong identifier if both exist and match
  const emailSimilarity = player1.email && player2.email && player1.email === player2.email ? 
    1 : calculateStringSimilarity(player1.email, player2.email);
  
  // Chess.com username is a strong identifier if both exist and match
  const usernameSimilarity = player1.chesscomUsername && player2.chesscomUsername && 
    player1.chesscomUsername === player2.chesscomUsername ? 
    1 : calculateStringSimilarity(player1.chesscomUsername, player2.chesscomUsername);
  
  // Rating similarity (if both have ratings)
  let ratingSimilarity = 0;
  if (player1.rating && player2.rating) {
    const ratingDiff = Math.abs(player1.rating - player2.rating);
    // Consider ratings within 100 points as potentially the same player
    ratingSimilarity = ratingDiff <= 100 ? 1 - (ratingDiff / 100) : 0;
  }
  
  // Calculate weighted overall similarity
  // Email and Chess.com username are stronger identifiers than name
  const weights = {
    name: 0.3,
    email: 0.4,
    username: 0.2,
    rating: 0.1
  };
  
  const overall = (
    nameSimilarity * weights.name +
    emailSimilarity * weights.email +
    usernameSimilarity * weights.username +
    ratingSimilarity * weights.rating
  );
  
  return {
    name: nameSimilarity,
    email: emailSimilarity,
    username: usernameSimilarity,
    rating: ratingSimilarity,
    overall
  };
}

/**
 * Identify potential duplicates in a list of players
 * 
 * @param {Array<Object>} players - Array of player objects
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Array<Object>} - Array of potential duplicate groups
 */
function identifyDuplicates(players, threshold = 0.7) {
  if (!Array.isArray(players) || players.length <= 1) {
    return [];
  }
  
  const duplicateGroups = [];
  const processedIndices = new Set();
  
  for (let i = 0; i < players.length; i++) {
    if (processedIndices.has(i)) continue;
    
    const currentPlayer = players[i];
    const duplicates = [{ player: currentPlayer, index: i }];
    
    for (let j = i + 1; j < players.length; j++) {
      if (processedIndices.has(j)) continue;
      
      const otherPlayer = players[j];
      const similarity = calculatePlayerSimilarity(currentPlayer, otherPlayer);
      
      if (similarity.overall >= threshold) {
        duplicates.push({ player: otherPlayer, index: j });
        processedIndices.add(j);
      }
    }
    
    if (duplicates.length > 1) {
      duplicateGroups.push(duplicates);
    }
    
    processedIndices.add(i);
  }
  
  return duplicateGroups;
}

/**
 * Merge duplicate player records into a single record
 * 
 * @param {Array<Object>} duplicates - Array of duplicate player objects
 * @returns {Object} - Merged player object
 */
function mergeDuplicates(duplicates) {
  if (!Array.isArray(duplicates) || duplicates.length === 0) {
    return null;
  }
  
  if (duplicates.length === 1) {
    return duplicates[0].player;
  }
  
  // Extract just the player objects
  const players = duplicates.map(d => d.player);
  
  // Start with the first player as the base
  const merged = { ...players[0] };
  
  // Merge in data from other players, preferring non-empty values
  for (let i = 1; i < players.length; i++) {
    const player = players[i];
    
    // Keep the most complete name
    if ((!merged.name || merged.name.length < player.name.length) && player.name) {
      merged.name = player.name;
    }
    
    // Keep email if base doesn't have one
    if (!merged.email && player.email) {
      merged.email = player.email;
    }
    
    // Keep Chess.com username if base doesn't have one
    if (!merged.chesscomUsername && player.chesscomUsername) {
      merged.chesscomUsername = player.chesscomUsername;
    }
    
    // Keep the highest rating
    if ((!merged.rating || (player.rating && merged.rating < player.rating)) && player.rating) {
      merged.rating = player.rating;
    }
    
    // Keep Chess.com data if available
    if (!merged.chesscomData && player.chesscomData) {
      merged.chesscomData = player.chesscomData;
    }
  }
  
  return merged;
}

/**
 * Deduplicate an array of player objects
 * 
 * @param {Array<Object>} players - Array of player objects
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Object} - Deduplicated players and duplicate groups
 */
function deduplicatePlayers(players, threshold = 0.7) {
  if (!Array.isArray(players) || players.length <= 1) {
    return { 
      deduplicatedPlayers: players || [],
      duplicateGroups: []
    };
  }
  
  // Identify duplicate groups
  const duplicateGroups = identifyDuplicates(players, threshold);
  
  if (duplicateGroups.length === 0) {
    return { 
      deduplicatedPlayers: players,
      duplicateGroups: []
    };
  }
  
  // Create a set of indices that are part of duplicate groups
  const duplicateIndices = new Set();
  duplicateGroups.forEach(group => {
    group.forEach(item => {
      duplicateIndices.add(item.index);
    });
  });
  
  // Create the deduplicated array
  const deduplicatedPlayers = [];
  
  // Add non-duplicate players
  players.forEach((player, index) => {
    if (!duplicateIndices.has(index)) {
      deduplicatedPlayers.push(player);
    }
  });
  
  // Add merged duplicates
  duplicateGroups.forEach(group => {
    const merged = mergeDuplicates(group);
    if (merged) {
      deduplicatedPlayers.push(merged);
    }
  });
  
  return {
    deduplicatedPlayers,
    duplicateGroups
  };
}

module.exports = {
  calculateStringSimilarity,
  calculatePlayerSimilarity,
  identifyDuplicates,
  mergeDuplicates,
  deduplicatePlayers
}; 