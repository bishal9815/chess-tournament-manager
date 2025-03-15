/**
 * Double Swiss Pairing System
 * 
 * In the Double Swiss system, players go through two Swiss cycles. 
 * The maximum number of rounds is twice the maximum Swiss rounds.
 * This allows for more rounds in a tournament with the same number of players.
 */

const { 
  determineWhitePlayer, 
  havePlayedBefore,
  calculateMaxSwissRounds
} = require('./swiss');

/**
 * Calculate the maximum number of rounds for Double Swiss tournament
 * @param {Number} playerCount - Number of players in the tournament
 * @returns {Number} - Maximum number of rounds (2 * Swiss rounds)
 */
function calculateMaxDoubleSwissRounds(playerCount) {
  return 2 * calculateMaxSwissRounds(playerCount);
}

/**
 * Create pairings for a group of players with the same score
 * This is a modified version for Double Swiss that allows up to one rematch per cycle
 * @param {Array} group - Array of players with the same score
 * @param {Number} round - Current round number
 * @param {Array} pairings - Current pairings array to be filled
 * @param {Set} pairedPlayerIds - Set of player IDs already paired
 * @param {Number} cycle - Current cycle (1 or 2)
 * @returns {Object} - Contains success flag and pairings
 */
function createDoubleSwissPairingsForGroup(group, round, pairings, pairedPlayerIds, cycle) {
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
    
    // Try to find an opponent who hasn't played player1 too many times
    for (let j = 1; j < remainingPlayers.length; j++) {
      const player2 = remainingPlayers[j];
      
      // Count how many times these players have played before
      const matchCount = countPreviousMatches(player1, player2);
      
      // In Double Swiss, allow up to one rematch per cycle
      // In cycle 1: no rematches
      // In cycle 2: allow one rematch only if they played in cycle 1
      if ((cycle === 1 && matchCount > 0) || (cycle === 2 && matchCount >= 2)) {
        continue;
      }
      
      // Determine colors (white/black)
      const whitePlayer = determineWhitePlayer(player1, player2);
      const blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
      
      // Create a unique ID for this pairing
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
          isRematch: matchCount > 0,
          cycle: cycle,
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
 * Count how many times two players have faced each other
 * @param {Object} player1 - First player object
 * @param {Object} player2 - Second player object
 * @returns {Number} - Number of previous matches between the players
 */
function countPreviousMatches(player1, player2) {
  if (!player1.previousOpponents || !player2.id) return 0;
  
  return player1.previousOpponents.filter(
    id => id.toString() === player2.id.toString()
  ).length;
}

/**
 * Create forced pairings for Double Swiss System
 * Allows more flexibility in rematches as a last resort
 * @param {Array} group - Array of players in the group
 * @param {Number} round - Current round number
 * @param {Number} cycle - Current cycle (1 or 2)
 * @returns {Object} - Contains pairings and set of paired player IDs
 */
function createForcedDoubleSwissPairings(group, round, cycle) {
  const pairings = [];
  const pairedPlayerIds = new Set();
  
  // Sort players to pair those who haven't played each other yet
  const sortedPlayers = [...group];
  
  // Try to pair players who haven't played each other yet
  for (let i = 0; i < sortedPlayers.length; i++) {
    if (pairedPlayerIds.has(sortedPlayers[i].id.toString())) continue;
    
    const player1 = sortedPlayers[i];
    let pairFound = false;
    
    // Find the first available player who hasn't played player1 too many times
    for (let j = i + 1; j < sortedPlayers.length; j++) {
      if (pairedPlayerIds.has(sortedPlayers[j].id.toString())) continue;
      
      const player2 = sortedPlayers[j];
      const matchCount = countPreviousMatches(player1, player2);
      
      // In Double Swiss forced pairings, allow up to 2 matches total
      if (matchCount < 2) {
        // Determine colors (white/black)
        const whitePlayer = determineWhitePlayer(player1, player2);
        const blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
        
        // Create a unique ID for this pairing
        const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_${round}`;
        
        // Add the pairing
        pairings.push({
          whitePlayer: whitePlayer.id,
          blackPlayer: blackPlayer.id,
          round: round,
          board: pairings.length + 1,
          isRematch: matchCount > 0,
          cycle: cycle,
          pairingKey: pairingKey
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
        
        pairFound = true;
        break;
      }
    }
    
    // If no suitable pair found, pair with anyone available
    if (!pairFound && !pairedPlayerIds.has(player1.id.toString())) {
      for (let j = i + 1; j < sortedPlayers.length; j++) {
        if (pairedPlayerIds.has(sortedPlayers[j].id.toString())) continue;
        
        const player2 = sortedPlayers[j];
        
        // Determine colors (white/black)
        const whitePlayer = determineWhitePlayer(player1, player2);
        const blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
        
        // Create a unique ID for this pairing
        const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_${round}`;
        
        // Add the pairing
        pairings.push({
          whitePlayer: whitePlayer.id,
          blackPlayer: blackPlayer.id,
          round: round,
          board: pairings.length + 1,
          isRematch: havePlayedBefore(player1, player2),
          cycle: cycle,
          pairingKey: pairingKey
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
        
        break;
      }
    }
  }
  
  // Handle odd number of players
  if (group.length % 2 !== 0) {
    const lastPlayer = group.find(p => !pairedPlayerIds.has(p.id.toString()));
    if (lastPlayer) {
      pairings.push({
        whitePlayer: lastPlayer.id,
        blackPlayer: null,
        round: round,
        board: pairings.length + 1,
        isBye: true,
        cycle: cycle,
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
 * Generate Double Swiss pairings for a round
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateDoubleSwissPairings(players, round) {
  // Check if we've exceeded the maximum rounds for Double Swiss system
  const maxRounds = calculateMaxDoubleSwissRounds(players.length);
  if (round > maxRounds) {
    return {
      pairings: [],
      error: {
        message: `Maximum number of rounds (${maxRounds}) exceeded for Double Swiss tournament with ${players.length} players.`
      }
    };
  }

  // Calculate which cycle we're in (1 or 2)
  const maxSwissRounds = calculateMaxSwissRounds(players.length);
  const cycle = round <= maxSwissRounds ? 1 : 2;
  
  console.log(`Double Swiss - Round ${round}, Cycle ${cycle}`);
  
  // First round of each cycle is special
  if (round === 1 || round === maxSwissRounds + 1) {
    // For first round of cycle 1: random pairings
    if (round === 1) {
      // Use standard Swiss first round pairings
      const firstRoundResult = generateFirstRoundDoubleSwissPairings(players);
      
      // Add cycle information to each pairing
      firstRoundResult.pairings.forEach(p => {
        p.cycle = 1;
      });
      
      return firstRoundResult;
    }
    // For first round of cycle 2: pair based on standings from cycle 1
    else {
      // For second cycle, first pair the top player with the second, third with fourth, etc.
      // Sort players by score
      const sortedPlayers = [...players].sort((a, b) => {
        const scoreA = a.cycleOneScore !== undefined ? a.cycleOneScore : (a.score || 0);
        const scoreB = b.cycleOneScore !== undefined ? b.cycleOneScore : (b.score || 0);
        return scoreB - scoreA;
      });
      
      const pairings = [];
      const pairedPlayerIds = new Set();
      
      // Handle odd number of players
      if (sortedPlayers.length % 2 !== 0) {
        // Assign bye to last player by score from cycle 1
        const byePlayer = sortedPlayers.pop();
        byePlayer.byes = (byePlayer.byes || 0) + 1;
        
        pairings.push({
          whitePlayer: byePlayer.id,
          blackPlayer: null,
          round: round,
          board: pairings.length + 1,
          isBye: true,
          cycle: 2,
          pairingKey: `${byePlayer.id}_bye_${round}` // Unique key for bye
        });
        
        pairedPlayerIds.add(byePlayer.id.toString());
      }
      
      // Pair players by standings (1-2, 3-4, etc.)
      for (let i = 0; i < sortedPlayers.length; i += 2) {
        const player1 = sortedPlayers[i];
        const player2 = sortedPlayers[i + 1];
        
        // Determine colors (white/black)
        const whitePlayer = determineWhitePlayer(player1, player2);
        const blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
        
        // Create a unique ID for this pairing
        const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_${round}`;
        
        pairings.push({
          whitePlayer: whitePlayer.id,
          blackPlayer: blackPlayer.id,
          round: round,
          board: pairings.length + 1,
          isRematch: havePlayedBefore(player1, player2),
          cycle: 2,
          pairingKey: pairingKey
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
      
      return { pairings, error: null };
    }
  }
  
  // For other rounds, use modified Swiss algorithm
  // Group players by score
  const scoreGroups = {};
  
  players.forEach(player => {
    // For cycle 2, use only the score from cycle 2
    const score = cycle === 2 ? (player.cycleTwoScore || 0) : (player.score || 0);
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
    const result = createDoubleSwissPairingsForGroup(group, round, pairings, pairedPlayerIds, cycle);
    
    if (!result.success) {
      // If pairing within the group failed, try forced pairings
      if (score === sortedScores[sortedScores.length - 1]) {
        // For the lowest score group, create forced pairings
        const unpairedPlayers = group.filter(p => !pairedPlayerIds.has(p.id.toString()));
        
        if (unpairedPlayers.length >= 2) {
          console.log(`Creating forced pairings for ${unpairedPlayers.length} players in lowest score group`);
          const forcedResult = createForcedDoubleSwissPairings(unpairedPlayers, round, cycle);
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
      cycle: cycle,
      pairingKey: `${byePlayer.id}_bye_${round}` // Unique key for bye
    });
  }
  
  // Special handling for transitioning between cycles
  if (round === maxSwissRounds) {
    // At the end of cycle 1, store the scores for each player
    players.forEach(player => {
      player.cycleOneScore = player.score || 0;
      // Reset score for cycle 2
      player.cycleTwoScore = 0;
    });
    
    console.log("End of cycle 1. Stored cycle 1 scores and reset for cycle 2.");
  }
  
  return {
    pairings,
    error: null
  };
}

/**
 * Generate first round pairings for double Swiss (random pairings)
 * @param {Array} players - Array of player objects
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateFirstRoundDoubleSwissPairings(players) {
  // Shuffle players for first round
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
    
    // Create a unique ID for this pairing
    const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_1`;
    
    pairings.push({
      whitePlayer: whitePlayer.id,
      blackPlayer: blackPlayer.id,
      round: 1,
      board: pairings.length + 1,
      pairingKey: pairingKey // Add unique identifier
    });
    
    // Initialize player records
    whitePlayer.previousOpponents = [blackPlayer.id];
    whitePlayer.colorHistory = ['white'];
    
    blackPlayer.previousOpponents = [whitePlayer.id];
    blackPlayer.colorHistory = ['black'];
    
    // Mark players as paired
    pairedPlayerIds.add(whitePlayer.id.toString());
    pairedPlayerIds.add(blackPlayer.id.toString());
  }
  
  return { pairings, error: null };
}

module.exports = {
  generateDoubleSwissPairings,
  calculateMaxDoubleSwissRounds
};
