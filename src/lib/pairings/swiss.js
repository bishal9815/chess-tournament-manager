/**
 * Swiss Pairing System
 * 
 * In the Swiss system, players with similar scores play each other, avoiding rematches.
 * The maximum number of rounds is determined by log2(N) where N is the number of players.
 * For example, with 8 players, the maximum is 3 rounds.
 */

// Helper functions for the Swiss system
const determineWhitePlayer = (player1, player2) => {
  const player1Whites = player1.colorHistory ? 
    player1.colorHistory.filter(c => c === 'white').length : 0;
  const player2Whites = player2.colorHistory ? 
    player2.colorHistory.filter(c => c === 'white').length : 0;
  
  // Assign colors to balance white/black games
  if (player1Whites < player2Whites) {
    return player1;
  } else if (player2Whites < player1Whites) {
    return player2;
  } else {
    // If equal, alternate from previous round
    const player1LastColor = player1.colorHistory && player1.colorHistory.length > 0 ? 
      player1.colorHistory[player1.colorHistory.length - 1] : null;
    
    if (player1LastColor === 'white') {
      return player2;
    } else {
      return player1;
    }
  }
};

const havePlayedBefore = (player1, player2) => {
  if (!player1.previousOpponents || !player2.id) return false;
  return player1.previousOpponents.some(id => id.toString() === player2.id.toString());
};

/**
 * Calculate the maximum number of rounds for Swiss tournament based on player count
 * @param {Number} playerCount - Number of players in the tournament
 * @returns {Number} - Maximum number of rounds
 */
function calculateMaxSwissRounds(playerCount) {
  return Math.ceil(Math.log2(playerCount));
}

/**
 * Create pairings for a group of players with the same score
 * @param {Array} group - Array of players with the same score
 * @param {Number} round - Current round number
 * @param {Array} pairings - Current pairings array to be filled
 * @param {Set} pairedPlayerIds - Set of player IDs already paired
 * @returns {Object} - Contains success flag and pairings
 */
function createPairingsForGroup(group, round, pairings, pairedPlayerIds) {
  // Make a copy to avoid modifying the original groups
  let remainingPlayers = [...group].filter(p => !pairedPlayerIds.has(p.id.toString()));
  
  // If all players in this group have been paired already, return
  if (remainingPlayers.length === 0) {
    return {
      success: true,
      pairings
    };
  }
  
  // Only one player left - can't pair within this group
  if (remainingPlayers.length === 1) {
    return {
      success: false,
      pairings
    };
  }

  // Maximum number of attempts to find valid pairings
  const maxAttempts = 100;
  let attempts = 0;

  while (remainingPlayers.length >= 2 && attempts < maxAttempts) {
    attempts++;
    let success = false;
    
    // Start with the first player in the group
    const player1 = remainingPlayers[0];
    
    // Try to find an opponent who hasn't played player1 yet
    for (let j = 1; j < remainingPlayers.length; j++) {
      const player2 = remainingPlayers[j];
      
      // Skip if these players have played before
      if (havePlayedBefore(player1, player2)) {
        continue;
      }
      
      // Determine colors (white/black)
      const whitePlayer = determineWhitePlayer(player1, player2);
      const blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
      
      // Create a unique ID for this pairing to help identify duplicates
      const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_${round}`;
      
      // Check if this pairing (or its reverse) already exists
      const pairingExists = pairings.some(p => 
        (p.whitePlayer === whitePlayer.id && p.blackPlayer === blackPlayer.id) ||
        (p.whitePlayer === blackPlayer.id && p.blackPlayer === whitePlayer.id)
      );
      
      // Only create the pairing if it doesn't already exist
      if (!pairingExists) {
        // Create pairing
        pairings.push({
          whitePlayer: whitePlayer.id,
          blackPlayer: blackPlayer.id,
          round: round,
          board: pairings.length + 1,
          isRematch: false,
          pairingKey: pairingKey // Add a unique key to help identify this pairing
        });
        
        // Update player records
        whitePlayer.previousOpponents = whitePlayer.previousOpponents || [];
        whitePlayer.previousOpponents.push(blackPlayer.id);
        whitePlayer.colorHistory = whitePlayer.colorHistory || [];
        whitePlayer.colorHistory.push('white');
        
        blackPlayer.previousOpponents = blackPlayer.previousOpponents || [];
        blackPlayer.previousOpponents.push(whitePlayer.id);
        blackPlayer.colorHistory = blackPlayer.colorHistory || [];
        blackPlayer.colorHistory.push('black');
        
        // Mark players as paired
        pairedPlayerIds.add(whitePlayer.id.toString());
        pairedPlayerIds.add(blackPlayer.id.toString());
        
        // Remove paired players from the remaining list
        remainingPlayers = remainingPlayers.filter(p => 
          p.id.toString() !== player1.id.toString() && 
          p.id.toString() !== player2.id.toString()
        );
        
        success = true;
        break;
      } else {
        console.log(`Skipping duplicate pairing: ${whitePlayer.id} vs ${blackPlayer.id} in round ${round}`);
      }
    }
    
    if (!success) {
      // If we couldn't find a valid opponent for the first player,
      // we have a pairing problem
      return { 
        success: false, 
        pairings 
      };
    }
  }
  
  // If we paired all players in the group, return success
  if (remainingPlayers.length < 2) {
    return {
      success: true,
      pairings
    };
  } else {
    // If we hit the maximum number of attempts, pairing failed
    return {
      success: false,
      pairings: []
    };
  }
}

/**
 * Create forced pairings for the last group when no valid pairings exist
 * This is a last resort that may allow rematches
 * @param {Array} group - Array of players in the group
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings and set of paired player IDs
 */
function createForcedPairings(group, round) {
  const pairings = [];
  const pairedPlayerIds = new Set();
  
  // Simply pair players sequentially as a last resort
  for (let i = 0; i < group.length - 1; i += 2) {
    const player1 = group[i];
    const player2 = group[i + 1];
    
    // Skip if either player is already paired
    if (pairedPlayerIds.has(player1.id.toString()) || pairedPlayerIds.has(player2.id.toString())) {
      continue;
    }
    
    // Determine colors (white/black)
    let whitePlayer, blackPlayer;
    
    const player1Whites = player1.colorHistory ? 
      player1.colorHistory.filter(c => c === 'white').length : 0;
    const player2Whites = player2.colorHistory ? 
      player2.colorHistory.filter(c => c === 'white').length : 0;
    
    // Assign colors to balance white/black games
    if (player1Whites < player2Whites) {
      whitePlayer = player1;
      blackPlayer = player2;
    } else if (player2Whites < player1Whites) {
      whitePlayer = player2;
      blackPlayer = player1;
    } else {
      // If equal, alternate from previous round
      const player1LastColor = player1.colorHistory && player1.colorHistory.length > 0 ? 
        player1.colorHistory[player1.colorHistory.length - 1] : null;
      
      if (player1LastColor === 'white') {
        whitePlayer = player2;
        blackPlayer = player1;
      } else {
        whitePlayer = player1;
        blackPlayer = player2;
      }
    }
    
    // Add the pairing
    pairings.push({
      whitePlayer: whitePlayer.id,
      blackPlayer: blackPlayer.id,
      round: round,
      board: pairings.length + 1,
      isRematch: havePlayedBefore(player1, player2), // Flag if this is a rematch
      pairingKey: `${whitePlayer.id}_${blackPlayer.id}_${round}` // Add a unique key to help identify this pairing
    });
    
    // Update player records
    whitePlayer.previousOpponents = whitePlayer.previousOpponents || [];
    whitePlayer.previousOpponents.push(blackPlayer.id);
    whitePlayer.colorHistory = whitePlayer.colorHistory || [];
    whitePlayer.colorHistory.push('white');
    
    blackPlayer.previousOpponents = blackPlayer.previousOpponents || [];
    blackPlayer.previousOpponents.push(whitePlayer.id);
    blackPlayer.colorHistory = blackPlayer.colorHistory || [];
    blackPlayer.colorHistory.push('black');
    
    // Mark players as paired
    pairedPlayerIds.add(whitePlayer.id.toString());
    pairedPlayerIds.add(blackPlayer.id.toString());
  }
  
  // Handle odd number of players - should typically not happen in knockout
  if (group.length % 2 !== 0) {
    const lastPlayer = group.find(p => !pairedPlayerIds.has(p.id.toString()));
    if (lastPlayer) {
      pairings.push({
        whitePlayer: lastPlayer.id,
        blackPlayer: null,
        round: round,
        board: pairings.length + 1,
        isBye: true,
        pairingKey: `${lastPlayer.id}_bye_${round}` // Unique key for bye
      });
      pairedPlayerIds.add(lastPlayer.id.toString());
    }
  }
  
  return {
    pairings,
    pairedPlayerIds
  };
}

/**
 * Generate Swiss pairings for a round
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateSwissPairings(players, round) {
  // Check if we've exceeded the maximum rounds for Swiss system
  const maxRounds = calculateMaxSwissRounds(players.length);
  if (round > maxRounds) {
    return {
      pairings: [],
      error: {
        message: `Maximum number of rounds (${maxRounds}) exceeded for Swiss tournament with ${players.length} players.`
      }
    };
  }

  // First round is special - handle differently
  if (round === 1) {
    return generateFirstRoundPairings(players);
  }
  
  // Group players by score
  const scoreGroups = {};
  
  players.forEach(player => {
    const score = player.score || 0;
    scoreGroups[score] = scoreGroups[score] || [];
    scoreGroups[score].push(player);
  });
  
  // Sort score groups high to low
  const sortedScores = Object.keys(scoreGroups)
    .map(score => parseFloat(score))
    .sort((a, b) => b - a);
  
  const pairings = [];
  const pairedPlayerIds = new Set();
  
  // Process score groups from highest to lowest
  for (const score of sortedScores) {
    const group = scoreGroups[score];
    
    // Skip empty groups
    if (!group || group.length === 0) continue;
    
    // Handle odd-numbered group by moving last player down
    if (group.length % 2 !== 0 && score !== sortedScores[sortedScores.length - 1]) {
      // Find the next non-empty lower score group
      const lowerScoreIndex = sortedScores.findIndex(s => s === score) + 1;
      if (lowerScoreIndex < sortedScores.length) {
        const lowerScore = sortedScores[lowerScoreIndex];
        // Move last player to lower score group
        const lastPlayer = group.pop();
        scoreGroups[lowerScore].push(lastPlayer);
      }
    }
    
    // Try to pair players within this score group
    const result = createPairingsForGroup(group, round, pairings, pairedPlayerIds);
    
    if (!result.success) {
      // If pairing within the group failed, try forced pairings
      if (score === sortedScores[sortedScores.length - 1]) {
        // For the lowest score group, create forced pairings
        const unpairedPlayers = group.filter(p => !pairedPlayerIds.has(p.id.toString()));
        
        if (unpairedPlayers.length >= 2) {
          console.log(`Creating forced pairings for ${unpairedPlayers.length} players in lowest score group`);
          const forcedResult = createForcedPairings(unpairedPlayers, round);
          pairings.push(...forcedResult.pairings);
          
          // Add paired players to the set
          forcedResult.pairedPlayerIds.forEach(id => pairedPlayerIds.add(id));
        }
      }
    }
  }
  
  // Handle unpaired players (should be at most 1)
  const unpairedPlayers = players.filter(p => !pairedPlayerIds.has(p.id.toString()));
  
  if (unpairedPlayers.length === 1) {
    // Assign a bye to the unpaired player
    const byePlayer = unpairedPlayers[0];
    byePlayer.byes = (byePlayer.byes || 0) + 1;
    
    pairings.push({
      whitePlayer: byePlayer.id,
      blackPlayer: null,
      round: round,
      board: pairings.length + 1,
      isBye: true,
      pairingKey: `${byePlayer.id}_bye_${round}` // Unique key for bye
    });
  }
  
  return {
    pairings,
    error: null
  };
}

/**
 * Generate first round pairings (random or seeded)
 * @param {Array} players - Array of player objects
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateFirstRoundPairings(players) {
  // Shuffle players for first round (can be replaced with seeding if ratings available)
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const pairings = [];
  const pairedPlayerIds = new Set();
  
  // Handle odd number of players
  if (shuffledPlayers.length % 2 !== 0) {
    // Assign bye to last player after shuffle
    const byePlayer = shuffledPlayers.pop();
    byePlayer.byes = 1;
    
    // Create a unique ID for this bye pairing
    const pairingKey = `${byePlayer.id}_bye_1`;
    
    pairings.push({
      whitePlayer: byePlayer.id,
      blackPlayer: null,
      round: 1,
      board: pairings.length + 1,
      isBye: true,
      pairingKey: pairingKey // Add unique identifier
    });
    
    // Mark player as paired
    pairedPlayerIds.add(byePlayer.id.toString());
  }
  
  // Pair remaining players
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const whitePlayer = shuffledPlayers[i];
    const blackPlayer = shuffledPlayers[i + 1];
    
    // Skip if either player is already paired (shouldn't happen in first round, but added for safety)
    if (pairedPlayerIds.has(whitePlayer.id.toString()) || pairedPlayerIds.has(blackPlayer.id.toString())) {
      continue;
    }
    
    // Create a unique ID for this pairing
    const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_1`;
    
    // Check if this pairing (or its reverse) already exists
    const pairingExists = pairings.some(p => 
      (p.whitePlayer === whitePlayer.id && p.blackPlayer === blackPlayer.id) ||
      (p.whitePlayer === blackPlayer.id && p.blackPlayer === whitePlayer.id)
    );
    
    // Only create the pairing if it doesn't already exist
    if (!pairingExists) {
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: 1,
        board: pairings.length + 1,
        pairingKey: pairingKey // Add unique identifier
      });
      
      // Update player records
      whitePlayer.previousOpponents = [blackPlayer.id];
      whitePlayer.colorHistory = ['white'];
      
      blackPlayer.previousOpponents = [whitePlayer.id];
      blackPlayer.colorHistory = ['black'];
      
      // Mark players as paired
      pairedPlayerIds.add(whitePlayer.id.toString());
      pairedPlayerIds.add(blackPlayer.id.toString());
    } else {
      console.log(`Skipping duplicate pairing: ${whitePlayer.id} vs ${blackPlayer.id} in round 1`);
    }
  }
  
  return { pairings, error: null };
}

module.exports = {
  generateSwissPairings,
  calculateMaxSwissRounds,
  havePlayedBefore,
  determineWhitePlayer
};
