/**
 * Chess Tournament Pairing Algorithms
 * 
 * This file contains six different pairing algorithms for chess tournaments:
 * 1. Swiss Pairing - Players with similar scores play each other, no rematches allowed
 * 2. Double Swiss Pairing - Similar to Swiss but allows up to 2 matches between the same players
 * 3. Round Robin Pairing - Each player faces every other player once (or twice in double round robin)
 * 4. Knockout Pairing - Single elimination tournament where winners advance and losers are eliminated
 * 5. Scheveningen System - Each player from Team A plays against each player from Team B
 * 6. Monrad (Danish) System - Leading players are paired with trailing players
 */

/**
 * Generate pairings for a tournament round using the Swiss system
 * @param {Array} players - Array of player objects with scores and previous opponents
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateSwissPairings(players, round) {
  console.log('Generating Swiss pairings for round', round);
  
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.log('No players provided for pairing');
    return { pairings: [], error: null };
  }
  
  // Ensure all players have the required properties
  const validPlayers = players.filter(player => player && player.id);
  
  if (validPlayers.length === 0) {
    console.log('No valid players found for pairing');
    return { pairings: [], error: null };
  }
  
  if (validPlayers.length === 1) {
    console.log('Only one player found, cannot generate pairings');
    return { pairings: [], error: null };
  }
  
  console.log('Valid players for pairing:', validPlayers.length);
  
  try {
    // Initialize pairing results
    const pairings = [];
    const pairedPlayers = new Set();
    
    // For first round, random pairings are acceptable
    if (round === 1) {
      console.log('First round - using random pairings');
      return generateFirstRoundPairings(validPlayers);
    }
    
    // Sort players by score (descending)
    const sortedPlayers = [...validPlayers].sort((a, b) => {
      // Primary sort by score
      const scoreComparison = (b.score || 0) - (a.score || 0);
      if (scoreComparison !== 0) return scoreComparison;
      
      // Secondary sort by tiebreak criteria (can be customized)
      // Here we're using previous opponent average score as tiebreak
      const aOpponentAvgScore = calculateOpponentAverageScore(a, validPlayers);
      const bOpponentAvgScore = calculateOpponentAverageScore(b, validPlayers);
      return bOpponentAvgScore - aOpponentAvgScore;
    });
    
    // Handle odd number of players (assign bye)
    if (sortedPlayers.length % 2 !== 0) {
      console.log('Odd number of players, assigning bye');
      
      // Find eligible players for bye (prioritize those who haven't had byes)
      const eligibleForBye = sortedPlayers.filter(player => 
        !pairedPlayers.has(player.id.toString()) && 
        (!player.byes || player.byes === 0)
      );
      
      // If no eligible players, take the lowest scoring player who hasn't been paired
      let byePlayer = null;
      
      if (eligibleForBye.length > 0) {
        // Take the lowest scoring eligible player
        byePlayer = eligibleForBye[eligibleForBye.length - 1];
      } else {
        // Take any lowest scoring player who hasn't been paired
        for (let i = sortedPlayers.length - 1; i >= 0; i--) {
          if (!pairedPlayers.has(sortedPlayers[i].id.toString())) {
            byePlayer = sortedPlayers[i];
            break;
          }
        }
      }
      
      if (byePlayer) {
        console.log('Assigning bye to player:', byePlayer.id);
        byePlayer.byes = (byePlayer.byes || 0) + 1;
        
        // Create a special "bye" pairing
        pairings.push({
          whitePlayer: byePlayer.id,
          blackPlayer: null, // null indicates a bye
          round: round,
          board: pairings.length + 1,
          isBye: true
        });
        
        // Mark player as paired
        pairedPlayers.add(byePlayer.id.toString());
      }
    }
    
    // Group players by score
    const scoreGroups = {};
    for (const player of sortedPlayers) {
      if (pairedPlayers.has(player.id.toString())) continue;
      
      const score = player.score || 0;
      if (!scoreGroups[score]) {
        scoreGroups[score] = [];
      }
      scoreGroups[score].push(player);
    }
    
    console.log('Score groups:', Object.keys(scoreGroups));
    
    // Process each score group in descending order
    const scores = Object.keys(scoreGroups).sort((a, b) => b - a);
    
    // Track players who need to be moved down to the next score group
    let floaters = [];
    
    for (let scoreIndex = 0; scoreIndex < scores.length; scoreIndex++) {
      const score = scores[scoreIndex];
      // Add any floaters from the previous group to the current group
      let currentGroup = [...floaters, ...scoreGroups[score]];
      floaters = []; // Reset floaters
      
      console.log(`Processing score group ${score} with ${currentGroup.length} players`);
      
      // If we have an odd number of players in this group and there are more groups,
      // prepare to float one player down
      if (currentGroup.length % 2 !== 0) {
        // If this is the last group, we should have handled odd total players with a bye already
        // Otherwise, identify a suitable floater
        if (scoreIndex < scores.length - 1) {
          const floater = selectFloater(currentGroup, validPlayers);
          floaters.push(floater);
          currentGroup = currentGroup.filter(p => p.id.toString() !== floater.id.toString());
          console.log(`Selected player ${floater.id} as downfloater to next score group`);
        }
      }
      
      // Create pairings within this score group
      const groupPairings = createPairingsForGroup(currentGroup, round, pairedPlayers);
      
      // If pairing was successful, add to overall pairings
      if (groupPairings.success) {
        pairings.push(...groupPairings.pairings);
        
        // Move any unpaired players to the next group as floaters
        const unpairedInGroup = currentGroup.filter(
          p => !pairedPlayers.has(p.id.toString())
        );
        
        if (unpairedInGroup.length > 0) {
          console.log(`Moving ${unpairedInGroup.length} unpaired players to next score group`);
          floaters.push(...unpairedInGroup);
        }
      } else {
        // If pairing was impossible, try different combinations
        console.log('Pairing impossible in score group, trying with more flexible criteria');
        
        // If this isn't the last group, float all remaining players
        if (scoreIndex < scores.length - 1) {
          console.log(`Floating all ${currentGroup.length} players to next score group`);
          floaters.push(...currentGroup);
        } else {
          // For the last group, we have to make pairings work
          // Last resort: Allow potential rematches in the last group
          console.log('Last score group - allowing rematches as last resort');
          const forcedPairings = createForcedPairings(currentGroup, round);
          pairings.push(...forcedPairings.pairings);
          
          // If we still have unpaired players, that's an error
          const stillUnpaired = currentGroup.filter(
            p => !forcedPairings.pairedPlayerIds.has(p.id.toString())
          );
          
          if (stillUnpaired.length > 0) {
            console.log('Error: Unable to pair all players');
            return { 
              pairings: [], 
              error: {
                message: "Pairing Error: Unable to pair all players while following Swiss system rules. Please check for problematic player combinations."
              } 
            };
          }
        }
      }
    }
    
    // If we have leftover floaters that couldn't be paired, report an error
    if (floaters.length > 0) {
      console.log('Error: Leftover players could not be paired');
      return { 
        pairings: [], 
        error: {
          message: "Pairing Error: Some players could not be paired while following Swiss system rules. Please check for problematic player combinations."
        } 
      };
    }
    
    console.log('Generated pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating pairings:', error);
    return { 
      pairings: [], 
      error: {
        message: "Error generating Swiss pairings: " + error.message
      } 
    };
  }
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

/**
 * Calculate the average score of a player's opponents
 * @param {Object} player - Player object
 * @param {Array} allPlayers - Array of all player objects
 * @returns {Number} - Average opponent score
 */
function calculateOpponentAverageScore(player, allPlayers) {
  if (!player.previousOpponents || player.previousOpponents.length === 0) {
    return 0;
  }
  
  let totalScore = 0;
  let opponentCount = 0;
  
  for (const oppId of player.previousOpponents) {
    if (!oppId) continue;
    
    const opponent = allPlayers.find(p => p.id.toString() === oppId.toString());
    if (opponent) {
      totalScore += (opponent.score || 0);
      opponentCount++;
    }
  }
  
  return opponentCount > 0 ? totalScore / opponentCount : 0;
}

/**
 * Select a player to float down to the next score group
 * @param {Array} group - Array of players in current score group
 * @param {Array} allPlayers - Array of all player objects
 * @returns {Object} - Selected player to float
 */
function selectFloater(group, allPlayers) {
  // Sort potential floaters by:
  // 1. Previous float status (prefer players who haven't floated before)
  // 2. Color balance (prefer players with more balanced colors)
  // 3. Score (prefer lower scoring players within this group)
  
  return group.sort((a, b) => {
    // Priority 1: Previous float status
    const aFloated = a.hasFloated ? 1 : 0;
    const bFloated = b.hasFloated ? 1 : 0;
    if (aFloated !== bFloated) return aFloated - bFloated;
    
    // Priority 2: Color balance
    const aWhiteCount = a.colorHistory ? a.colorHistory.filter(c => c === 'white').length : 0;
    const aBlackCount = a.colorHistory ? a.colorHistory.filter(c => c === 'black').length : 0;
    const aColorDiff = Math.abs(aWhiteCount - aBlackCount);
    
    const bWhiteCount = b.colorHistory ? b.colorHistory.filter(c => c === 'white').length : 0;
    const bBlackCount = b.colorHistory ? b.colorHistory.filter(c => c === 'black').length : 0;
    const bColorDiff = Math.abs(bWhiteCount - bBlackCount);
    
    if (aColorDiff !== bColorDiff) return aColorDiff - bColorDiff;
    
    // Priority 3: Score
    return (a.score || 0) - (b.score || 0);
  })[0];
}

/**
 * Create pairings for a group of players with the same score
 * @param {Array} group - Array of players in the score group
 * @param {Number} round - Current round number
 * @param {Set} pairedPlayers - Set of already paired player IDs
 * @returns {Object} - Contains pairings and success status
 */
function createPairingsForGroup(group, round, pairedPlayers) {
  const pairings = [];
  const localPairedPlayers = new Set([...pairedPlayers]); // Create a local copy
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loops
  
  // Try to pair all players in the group
  while (group.length >= 2 && attempts < maxAttempts) {
    attempts++;
    let success = false;
    
    const player1 = group[0];
    
    // Try to find a valid opponent for player1
    for (let i = 1; i < group.length; i++) {
      const player2 = group[i];
      
      // Skip if either player is already paired
      if (localPairedPlayers.has(player1.id.toString()) || 
          localPairedPlayers.has(player2.id.toString())) {
        continue;
      }
      
      // Check if these players have already played each other
      const player1Opponents = player1.previousOpponents || [];
      const alreadyPlayed = player1Opponents.some(oppId => 
        oppId && player2.id && oppId.toString() === player2.id.toString()
      );
      
      if (!alreadyPlayed) {
        // Found a valid opponent
        success = true;
        
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
          localPairedPlayers.add(whitePlayer.id.toString());
          localPairedPlayers.add(blackPlayer.id.toString());
          pairedPlayers.add(whitePlayer.id.toString());
          pairedPlayers.add(blackPlayer.id.toString());
        } else {
          console.log(`Skipping duplicate pairing: ${whitePlayer.id} vs ${blackPlayer.id} in round ${round}`);
        }
        
        // Remove paired players from the group
        group = group.filter(p => 
          p.id.toString() !== player1.id.toString() && 
          p.id.toString() !== player2.id.toString()
        );
        
        break;
      }
    }
    
    if (!success) {
      // If we couldn't find a valid opponent for the first player,
      // we have a pairing problem
      return { 
        success: false, 
        pairings: [] 
      };
    }
  }
  
  // If we paired all players in the group, return success
  if (group.length < 2) {
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
  // but could occur if a player withdraws
  if (group.length % 2 !== 0) {
    const remainingPlayer = group[group.length - 1];
    console.log(`Warning: Odd number of players in knockout round. Player ${remainingPlayer.id} gets a bye to next round.`);
    
    // Create a special "bye" pairing for the remaining player
    pairings.push({
      whitePlayer: remainingPlayer.id,
      blackPlayer: null,
      round: round,
      board: pairings.length + 1,
      isBye: true
    });
    
    // Update player record
    remainingPlayer.colorHistory = remainingPlayer.colorHistory || [];
    remainingPlayer.colorHistory.push('white');
  }
  
  return {
    pairings,
    pairedPlayerIds
  };
}

/**
 * Determine which player should play white based on previous color history
 * @param {Object} player1 - First player
 * @param {Object} player2 - Second player
 * @returns {Object} - Player who should play white
 */
function determineWhitePlayer(player1, player2) {
  // Calculate color history stats
  const player1Whites = player1.colorHistory ? 
    player1.colorHistory.filter(c => c === 'white').length : 0;
  const player1Blacks = player1.colorHistory ? 
    player1.colorHistory.filter(c => c === 'black').length : 0;
  
  const player2Whites = player2.colorHistory ? 
    player2.colorHistory.filter(c => c === 'white').length : 0;
  const player2Blacks = player2.colorHistory ? 
    player2.colorHistory.filter(c => c === 'black').length : 0;
  
  // Calculate color differences (positive means more whites than blacks)
  const player1ColorDiff = player1Whites - player1Blacks;
  const player2ColorDiff = player2Whites - player2Blacks;
  
  // If one player has a greater color imbalance, give them the needed color
  if (player1ColorDiff < player2ColorDiff) {
    return player1; // player1 needs white more
  } else if (player2ColorDiff < player1ColorDiff) {
    return player2; // player2 needs white more
  }
  
  // If both have the same imbalance, alternate from their previous colors
  const player1LastColor = player1.colorHistory && player1.colorHistory.length > 0 ? 
    player1.colorHistory[player1.colorHistory.length - 1] : null;
  
  const player2LastColor = player2.colorHistory && player2.colorHistory.length > 0 ? 
    player2.colorHistory[player2.colorHistory.length - 1] : null;
  
  if (player1LastColor === 'black' && player2LastColor === 'white') {
    return player1;
  } else if (player1LastColor === 'white' && player2LastColor === 'black') {
    return player2;
  }
  
  // If we still can't decide, use a simple alternation
  if (player1LastColor === 'white') {
    return player2;
  } else if (player2LastColor === 'white') {
    return player1;
  }
  
  // If no previous history or same last colors, choose randomly
  return Math.random() < 0.5 ? player1 : player2;
}

/**
 * Check if two players have played against each other before
 * @param {Object} player1 - First player
 * @param {Object} player2 - Second player
 * @returns {Boolean} - True if they have played before
 */
function havePlayedBefore(player1, player2) {
  const player1Opponents = player1.previousOpponents || [];
  return player1Opponents.some(oppId => 
    oppId && player2.id && oppId.toString() === player2.id.toString()
  );
}

/**
 * Generate pairings for a tournament round using the Double Swiss system
 * @param {Array} players - Array of player objects with scores and previous opponents
 * @param {Number} round - Current round number
 * @param {Number} cycleNumber - Current cycle number (1 or 2)
 * @param {Number} cycleRounds - Number of rounds in each cycle
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateDoubleSwissPairings(players, round, cycleNumber, cycleRounds) {
  console.log('Generating Double Swiss pairings for round', round, 'cycle', cycleNumber);
  
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.log('No players provided for pairing');
    return { pairings: [], error: null };
  }
  
  // Ensure all players have the required properties
  const validPlayers = players.filter(player => player && player.id);
  
  if (validPlayers.length === 0) {
    console.log('No valid players found for pairing');
    return { pairings: [], error: null };
  }
  
  if (validPlayers.length === 1) {
    console.log('Only one player found, cannot generate pairings');
    return { pairings: [], error: null };
  }
  
  console.log('Valid players for pairing:', validPlayers.length);
  
  try {
    // Handle start of second cycle - we track cycle1Score but reset the current score
    if (cycleNumber === 2 && round === 1) {
      console.log('Starting second cycle - resetting scores while preserving cycle 1 scores');
      for (const player of validPlayers) {
        // Store cycle 1 score before resetting
        player.cycle1Score = player.score || 0;
        player.score = 0;
        // Keep previous opponents to prevent excessive rematches across cycles
      }
    }
    
    // Special handling for first round of each cycle
    if (round === 1) {
      if (cycleNumber === 1) {
        // First round of first cycle - use random pairings (like standard Swiss)
        return generateFirstRoundSwissPairings(validPlayers);
      } else if (cycleNumber === 2) {
        // First round of second cycle - pair based on performance in first cycle
        return generateSecondCycleFirstRoundPairings(validPlayers);
      }
    }
    
    // Regular Swiss pairing for all other rounds
    // Sort players by score (descending)
    const sortedPlayers = [...validPlayers].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Initialize results array
    const pairings = [];
    
    // Track which players have been paired in this round
    const pairedPlayers = new Set();
    
    // Handle odd number of players (assign bye)
    if (sortedPlayers.length % 2 !== 0) {
      console.log('Odd number of players, assigning bye');
      
      // Find the lowest-scoring player who hasn't had a bye yet
      let byePlayer = null;
      
      // First, try to find a player who hasn't had a bye yet
      for (let i = sortedPlayers.length - 1; i >= 0; i--) {
        if (!sortedPlayers[i].byes || sortedPlayers[i].byes === 0) {
          byePlayer = sortedPlayers[i];
          break;
        }
      }
      
      // If all players have had byes, assign to the lowest-scoring player
      if (!byePlayer && sortedPlayers.length > 0) {
        byePlayer = sortedPlayers[sortedPlayers.length - 1];
      }
      
      if (byePlayer) {
        console.log('Assigning bye to player:', byePlayer.id);
        byePlayer.byes = (byePlayer.byes || 0) + 1;
        
        // Create a special "bye" pairing
        pairings.push({
          whitePlayer: byePlayer.id,
          blackPlayer: null, // null indicates a bye
          round: round,
          board: pairings.length + 1,
          isBye: true
        });
        
        // Mark player as paired
        pairedPlayers.add(byePlayer.id.toString());
      }
    }
    
    // Group players by score
    const scoreGroups = {};
    for (const player of sortedPlayers) {
      if (pairedPlayers.has(player.id.toString())) continue;
      
      const score = player.score || 0;
      if (!scoreGroups[score]) {
        scoreGroups[score] = [];
      }
      scoreGroups[score].push(player);
    }
    
    console.log('Score groups:', Object.keys(scoreGroups));
    
    // Process each score group
    const scores = Object.keys(scoreGroups).sort((a, b) => b - a);
    
    for (const score of scores) {
      let group = scoreGroups[score];
      console.log(`Processing score group ${score} with ${group.length} players`);
      
      // If we have an odd number of players in this group and there are more groups,
      // move one player to the next group
      if (group.length % 2 !== 0 && scores.indexOf(score) < scores.length - 1) {
        const nextScore = scores[scores.indexOf(score) + 1];
        console.log(`Moving one player from score group ${score} to ${nextScore}`);
        const playerToMove = group[group.length - 1];
        group = group.slice(0, group.length - 1);
        scoreGroups[nextScore].unshift(playerToMove);
      }
      
      // Pair players within the same score group
      while (group.length >= 2) {
        const player1 = group[0];
        
        // Find a valid opponent for player1
        let opponentIndex = -1;
        
        for (let i = 1; i < group.length; i++) {
          const player2 = group[i];
          
          // Check if these players have already played each other twice
          const player1Opponents = player1.previousOpponents || [];
          
          // Count how many times they've played
          const matchCount = player1Opponents.filter(oppId => 
            oppId && player2.id && oppId.toString() === player2.id.toString()
          ).length;
          
          // In double Swiss, players can face each other up to twice (once per cycle ideally)
          if (matchCount < 2) {
            opponentIndex = i;
            break;
          }
        }
        
        // If no valid opponent found (all have played twice already), raise error
        if (opponentIndex === -1) {
          console.log(`No valid opponent found for player ${player1.id} - all have faced twice already`);
          
          return { 
            pairings: [], 
            error: {
              message: "Pairing Error:\nPlayers have already faced each other twice. Please ensure no player competes against the same opponent more than twice across both cycles."
            } 
          };
        }
        
        const player2 = group[opponentIndex];
        console.log(`Pairing players: ${player1.id} vs ${player2.id}`);
        
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
          cycle: cycleNumber,
          board: pairings.length + 1
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
        pairedPlayers.add(whitePlayer.id.toString());
        pairedPlayers.add(blackPlayer.id.toString());
        
        // Remove paired players from the group
        group = group.filter(p => !pairedPlayers.has(p.id.toString()));
      }
      
      // If we have one player left, move them to the next score group
      if (group.length === 1 && scores.indexOf(score) < scores.length - 1) {
        const nextScore = scores[scores.indexOf(score) + 1];
        console.log(`Moving leftover player from score group ${score} to ${nextScore}`);
        const playerToMove = group[0];
        scoreGroups[nextScore].unshift(playerToMove);
      }
    }
    
    return { pairings, error: null };
  } catch (error) {
    console.error('Error in Double Swiss pairing algorithm:', error);
    return { 
      pairings: [], 
      error: {
        message: `Pairing Error: ${error.message || 'Unknown error in pairing algorithm'}`
      } 
    };
  }
}

/**
 * Generate the first round pairings for the second cycle of a Double Swiss tournament
 * @param {Array} players - Array of players who completed the first cycle
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateSecondCycleFirstRoundPairings(players) {
  console.log('Generating first round pairings for the second cycle');
  
  try {
    // Sort players by their cycle 1 score (descending)
    const sortedPlayers = [...players].sort((a, b) => (b.cycle1Score || 0) - (a.cycle1Score || 0));
    
    // Initialize results array
    const pairings = [];
    
    // Handle odd number of players (assign bye)
    if (sortedPlayers.length % 2 !== 0) {
      // Find the lowest-scoring player who hasn't had a bye yet
      let byePlayer = null;
      
      // First, try to find a player who hasn't had a bye yet
      for (let i = sortedPlayers.length - 1; i >= 0; i--) {
        if (!sortedPlayers[i].byes || sortedPlayers[i].byes === 0) {
          byePlayer = sortedPlayers[i];
          break;
        }
      }
      
      // If all players have had byes, assign to the lowest-scoring player
      if (!byePlayer && sortedPlayers.length > 0) {
        byePlayer = sortedPlayers[sortedPlayers.length - 1];
      }
      
      if (byePlayer) {
        console.log('Assigning bye to player:', byePlayer.id);
        byePlayer.byes = (byePlayer.byes || 0) + 1;
        
        // Create a special "bye" pairing
        pairings.push({
          whitePlayer: byePlayer.id,
          blackPlayer: null, // null indicates a bye
          round: 1,
          cycle: 2,
          board: pairings.length + 1,
          isBye: true
        });
        
        // Remove from players to be paired
        sortedPlayers.splice(sortedPlayers.indexOf(byePlayer), 1);
      }
    }
    
    // Pair #1 with #N/2+1, #2 with #N/2+2, etc. (like in the first round of a Swiss)
    // But now we're pairing based on performance in first cycle
    const halfway = Math.floor(sortedPlayers.length / 2);
    
    for (let i = 0; i < halfway; i++) {
      const topHalfPlayer = sortedPlayers[i];
      const bottomHalfPlayer = sortedPlayers[i + halfway];
      
      // Check if these players have already played each other
      const player1Opponents = topHalfPlayer.previousOpponents || [];
      const alreadyPlayed = player1Opponents.some(oppId => 
        oppId && bottomHalfPlayer.id && oppId.toString() === bottomHalfPlayer.id.toString()
      );
      
      // If they've already played, try to find a replacement opponent
      let finalOpponent = bottomHalfPlayer;
      
      if (alreadyPlayed) {
        // Look for a different opponent in the bottom half
        let replacementFound = false;
        
        for (let j = halfway; j < sortedPlayers.length; j++) {
          const potentialOpponent = sortedPlayers[j];
          if (potentialOpponent === bottomHalfPlayer) continue;
          
          const hasPlayed = (topHalfPlayer.previousOpponents || []).some(oppId => 
            oppId && potentialOpponent.id && oppId.toString() === potentialOpponent.id.toString()
          );
          
          if (!hasPlayed) {
            // Swap positions with the original opponent
            sortedPlayers[i + halfway] = potentialOpponent;
            sortedPlayers[j] = bottomHalfPlayer;
            finalOpponent = potentialOpponent;
            replacementFound = true;
            break;
          }
        }
        
        // If we couldn't find a replacement, proceed with the original pairing
        // This might lead to a second match between these players
        if (!replacementFound) {
          console.log(`Warning: Players ${topHalfPlayer.id} and ${bottomHalfPlayer.id} will play for the second time`);
          finalOpponent = bottomHalfPlayer;
        }
      }
      
      // Determine colors
      let whitePlayer, blackPlayer;
      
      const player1Whites = topHalfPlayer.colorHistory ? 
        topHalfPlayer.colorHistory.filter(c => c === 'white').length : 0;
      const player2Whites = finalOpponent.colorHistory ? 
        finalOpponent.colorHistory.filter(c => c === 'white').length : 0;
      
      // Assign colors to balance white/black games
      if (player1Whites < player2Whites) {
        whitePlayer = topHalfPlayer;
        blackPlayer = finalOpponent;
      } else if (player2Whites < player1Whites) {
        whitePlayer = finalOpponent;
        blackPlayer = topHalfPlayer;
      } else {
        // If equal colors, randomize
        if (Math.random() < 0.5) {
          whitePlayer = topHalfPlayer;
          blackPlayer = finalOpponent;
        } else {
          whitePlayer = finalOpponent;
          blackPlayer = topHalfPlayer;
        }
      }
      
      // Add the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: 1,
        cycle: 2,
        board: pairings.length + 1
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
    }
    
    return { pairings, error: null };
  } catch (error) {
    console.error('Error in second cycle first round pairing:', error);
    return { 
      pairings: [], 
      error: {
        message: `Pairing Error: ${error.message || 'Unknown error in pairing algorithm'}`
      } 
    };
  }
}

/**
 * Calculate the final standings for a Double Swiss tournament
 * @param {Array} players - Array of player objects with scores
 * @param {Number} cycleRounds - Number of rounds in each cycle
 * @returns {Array} - Sorted array of players with combined scores
 */
function calculateDoubleSwissStandings(players, cycleRounds) {
  // Calculate final standings by combining scores from both cycles
  const finalStandings = players.map(player => {
    // For players who only played in one cycle, ensure they have a cycle1Score
    if (typeof player.cycle1Score === 'undefined') {
      player.cycle1Score = player.score || 0;
      player.cycle2Score = 0;
    } else {
      player.cycle2Score = player.score || 0;
    }
    
    return {
      ...player,
      totalScore: (player.cycle1Score || 0) + (player.cycle2Score || 0)
    };
  });
  
  // Sort by total score (primary), then by tiebreaks if needed
  return finalStandings.sort((a, b) => {
    // Primary sort by total score
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    
    // Tiebreak 1: Cycle 2 score (more weight to later performance)
    if (b.cycle2Score !== a.cycle2Score) {
      return b.cycle2Score - a.cycle2Score;
    }
    
    // Tiebreak 2: Average opponent score across both cycles
    const aOpponentAvg = a.opponentAverageScore || 0;
    const bOpponentAvg = b.opponentAverageScore || 0;
    
    return bOpponentAvg - aOpponentAvg;
  });
}

/**
 * Generate pairings for a Round Robin tournament
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @param {Boolean} isDoubleRoundRobin - Whether this is a double round robin tournament
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateRoundRobinPairings(players, round, isDoubleRoundRobin = false) {
  console.log('Generating Round Robin pairings for round', round);
  
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.log('No players provided for pairing');
    return { pairings: [], error: null };
  }
  
  // Ensure all players have the required properties
  const validPlayers = players.filter(player => player && player.id);
  
  if (validPlayers.length === 0) {
    console.log('No valid players found for pairing');
    return { pairings: [], error: null };
  }
  
  if (validPlayers.length === 1) {
    console.log('Only one player found, cannot generate pairings');
    return { pairings: [], error: null };
  }
  
  console.log('Valid players for pairing:', validPlayers.length);
  
  try {
    // Round robin uses a specific schedule based on the number of players
    let n = validPlayers.length;
    
    // If we have an odd number of players, add a "dummy" player for byes
    const hasDummy = n % 2 !== 0;
    if (hasDummy) {
      n++;
    }
    
    // Total rounds in a round robin tournament with n players is (n-1)
    const totalRounds = n - 1;
    
    // In double round robin, we double the rounds
    const adjustedTotalRounds = isDoubleRoundRobin ? totalRounds * 2 : totalRounds;
    
    // Check if the round number is valid
    if (round > adjustedTotalRounds) {
      return { 
        pairings: [], 
        error: {
          message: "Round number exceeds maximum rounds for Round Robin tournament."
        } 
      };
    }
    
    // Determine which cycle we're in (for double round robin)
    const cycle = isDoubleRoundRobin && round > totalRounds ? 2 : 1;
    
    // Calculate the actual round within the current cycle
    let actualRound = cycle === 1 ? round : round - totalRounds;
    
    // Create a copy of players
    const scheduledPlayers = [...validPlayers];
    
    // Add dummy player if needed
    if (hasDummy) {
      scheduledPlayers.push({ id: 'dummy', name: 'Bye' });
    }
    
    // Standard Round Robin algorithm using the "circle method"
    // In this method:
    // 1. Player at position 0 remains fixed
    // 2. All other players rotate clockwise
    const pairings = [];
    
    // Create a rotated array for the current round
    const rotatedPlayers = [...scheduledPlayers];
    
    // Skip player at index 0 (fixed position)
    const fixed = rotatedPlayers[0];
    
    // Handle first round separately (no rotation needed)
    if (actualRound > 1) {
      // Apply rotation based on the round number
      // For each round, rotate players (except fixed) clockwise
      const rotating = scheduledPlayers.slice(1);
      
      // Rotate players based on the round number
      // For round r, rotate r-1 positions
      const rotationAmount = actualRound - 1;
      const rotated = [];
      
      // First player stays fixed
      rotated.push(fixed);
      
      // Rotate the remaining players
      for (let i = 0; i < rotating.length; i++) {
        const newPosition = (i - rotationAmount + rotating.length) % rotating.length;
        rotated.push(rotating[newPosition]);
      }
      
      // Replace the array with rotated players
      for (let i = 0; i < rotatedPlayers.length; i++) {
        rotatedPlayers[i] = rotated[i];
      }
    }
    
    // Generate pairings based on the rotated array
    for (let i = 0; i < n / 2; i++) {
      const player1 = rotatedPlayers[i];
      const player2 = rotatedPlayers[n - 1 - i];
      
      // Skip if either player is the dummy (bye)
      if (player1.id === 'dummy' || player2.id === 'dummy') {
        const playerWithBye = player1.id === 'dummy' ? player2 : player1;
        
        // Add bye pairing
        pairings.push({
          whitePlayer: playerWithBye.id,
          blackPlayer: null, // null indicates a bye
          round: round,
          board: pairings.length + 1,
          isBye: true
        });
        
        continue;
      }
      
      // Check if players have already met the maximum times
      // In single round robin, players should meet exactly once
      // In double round robin, exactly twice
      const player1Opponents = player1.previousOpponents || [];
      const matchCount = player1Opponents.filter(oppId => 
        oppId && player2.id && oppId.toString() === player2.id.toString()
      ).length;
      
      // Maximum allowed matches between players
      const maxMatches = isDoubleRoundRobin ? 2 : 1;
      
      if (matchCount >= maxMatches) {
        console.log(`Error: Players ${player1.id} and ${player2.id} have already played ${matchCount} times`);
        return { 
          pairings: [], 
          error: {
            message: "Pairing Error: Players have already played the maximum number of games against each other. In Round Robin, each player must face every other player exactly once (or twice in Double Round Robin)."
          } 
        };
      }
      
      // Determine colors
      let whitePlayer, blackPlayer;
      
      // In Double Round Robin second cycle, reverse colors from first meeting
      if (isDoubleRoundRobin && cycle === 2) {
        // Find if they played before and what colors they had
        let previousColorWasWhite = false;
        let foundPreviousMatch = false;
        
        for (let j = 0; j < player1Opponents.length; j++) {
          if (player1Opponents[j].toString() === player2.id.toString()) {
            // They played before, check what color player1 had
            if (player1.colorHistory && player1.colorHistory[j] === 'white') {
              previousColorWasWhite = true;
            }
            foundPreviousMatch = true;
            break;
          }
        }
        
        if (foundPreviousMatch) {
          // Reverse colors in second cycle
          if (previousColorWasWhite) {
            whitePlayer = player2;
            blackPlayer = player1;
          } else {
            whitePlayer = player1;
            blackPlayer = player2;
          }
        } else {
          // If no previous match found (shouldn't happen), use default assignment
          whitePlayer = i % 2 === 0 ? player1 : player2;
          blackPlayer = i % 2 === 0 ? player2 : player1;
        }
      } else {
        // First cycle - assign colors based on position
        whitePlayer = i % 2 === 0 ? player1 : player2;
        blackPlayer = i % 2 === 0 ? player2 : player1;
      }
      
      // Add the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: round,
        board: pairings.length + 1
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
    }
    
    console.log('Generated pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating pairings:', error);
    return { 
      pairings: [], 
      error: {
        message: "Error generating Round Robin pairings: " + error.message
      }
    };
  }
}

/**
 * Extract winners from the previous round for knockout tournaments
 * @param {Array} players - Array of all players
 * @param {Array} previousResults - Array of results from previous rounds
 * @param {Number} previousRound - Previous round number
 * @returns {Array} - Array of players who won in the previous round
 */
function getWinnersFromPreviousRound(players, previousResults, previousRound) {
  if (!previousResults || !Array.isArray(previousResults)) {
    return [];
  }
  
  // Filter results from the previous round
  const relevantResults = previousResults.filter(result => 
    result && result.round === previousRound
  );
  
  // Extract winner IDs from each result
  const winnerIds = new Set();
  
  for (const result of relevantResults) {
    if (!result.result) continue; // Skip incomplete results
    
    if (result.isBye) {
      // Player with a bye automatically advances
      winnerIds.add(result.whitePlayer);
    } else if (result.result === '1-0') {
      // White win
      winnerIds.add(result.whitePlayer);
    } else if (result.result === '0-1') {
      // Black win
      winnerIds.add(result.blackPlayer);
    } else if (result.result === '1/2-1/2') {
      // Draw - in knockout, we need a tiebreak rule
      // For simplicity, we'll advance the white player (in practice, use rapid/blitz games)
      console.log(`Draw in knockout match between ${result.whitePlayer} and ${result.blackPlayer}. White advances.`);
      winnerIds.add(result.whitePlayer);
    }
  }
  
  // Match winner IDs with player objects
  return players.filter(player => 
    player && player.id && winnerIds.has(player.id)
  );
}

/**
 * Generate pairings for a tournament round using the Knockout (Single Elimination) system
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @param {Array} previousResults - Array of results from previous rounds
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateKnockoutPairings(players, round, previousResults) {
  console.log('Generating Knockout pairings for round', round);
  
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.log('No players provided for pairing');
    return { pairings: [], error: null };
  }
  
  // Ensure all players have the required properties
  const validPlayers = players.filter(player => player && player.id);
  
  if (validPlayers.length === 0) {
    console.log('No valid players found for pairing');
    return { pairings: [], error: null };
  }
  
  try {
    // For the first round, pair all players randomly or by seed
    if (round === 1) {
      return generateFirstRoundKnockoutPairings(validPlayers);
    }
    
    // For subsequent rounds, only winners from the previous round participate
    const winners = getWinnersFromPreviousRound(validPlayers, previousResults, round - 1);
    
    if (winners.length === 0) {
      return { 
        pairings: [], 
        error: {
          message: "No winners found from previous round. Please ensure all previous matches have results."
        } 
      };
    }
    
    if (winners.length === 1) {
      console.log('Only one player left - tournament completed');
      return { 
        pairings: [],
        tournamentCompleted: true,
        champion: winners[0].id,
        error: null
      };
    }
    
    // Generate pairings for this round
    const pairings = [];
    
    // Shuffle winners for random pairings
    // In a more advanced implementation, this could maintain bracket structure
    const shuffledWinners = shuffleArray([...winners]);
    
    // Pair winners
    for (let i = 0; i < shuffledWinners.length - 1; i += 2) {
      const player1 = shuffledWinners[i];
      const player2 = shuffledWinners[i + 1];
      
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
        board: pairings.length + 1
      });
      
      // Update player records
      whitePlayer.colorHistory = whitePlayer.colorHistory || [];
      whitePlayer.colorHistory.push('white');
      
      blackPlayer.colorHistory = blackPlayer.colorHistory || [];
      blackPlayer.colorHistory.push('black');
    }
    
    // Handle odd number of players - should typically not happen in knockout
    // but could occur if a player withdraws
    if (shuffledWinners.length % 2 !== 0) {
      const remainingPlayer = shuffledWinners[shuffledWinners.length - 1];
      console.log(`Warning: Odd number of players in knockout round. Player ${remainingPlayer.id} gets a bye to next round.`);
      
      // Create a special "bye" pairing for the remaining player
      pairings.push({
        whitePlayer: remainingPlayer.id,
        blackPlayer: null,
        round: round,
        board: pairings.length + 1,
        isBye: true
      });
      
      // Update player record
      remainingPlayer.colorHistory = remainingPlayer.colorHistory || [];
      remainingPlayer.colorHistory.push('white');
    }
    
    return { pairings, error: null };
  } catch (error) {
    console.error('Error in Knockout pairing algorithm:', error);
    return { 
      pairings: [], 
      error: {
        message: `Pairing Error: ${error.message || 'Unknown error in pairing algorithm'}`
      } 
    };
  }
}

/**
 * Generate the first round pairings for a Knockout tournament
 * @param {Array} players - Array of all players in the tournament
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateFirstRoundKnockoutPairings(players) {
  console.log('Generating first round pairings for knockout tournament');
  
  try {
    // Shuffle players for random pairings
    // For seeded tournaments, a different approach would be used
    const shuffledPlayers = shuffleArray([...players]);
    const pairings = [];
    
    // Pair players
    for (let i = 0; i < shuffledPlayers.length - 1; i += 2) {
      const player1 = shuffledPlayers[i];
      const player2 = shuffledPlayers[i + 1];
      
      // Simple white/black assignment (random for first round)
      const whitePlayer = Math.random() < 0.5 ? player1 : player2;
      const blackPlayer = whitePlayer === player1 ? player2 : player1;
      
      // Add the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: 1,
        board: pairings.length + 1
      });
      
      // Initialize player records
      whitePlayer.colorHistory = ['white'];
      blackPlayer.colorHistory = ['black'];
    }
    
    // Handle odd number of players
    if (shuffledPlayers.length % 2 !== 0) {
      const remainingPlayer = shuffledPlayers[shuffledPlayers.length - 1];
      console.log(`Odd number of players. Player ${remainingPlayer.id} gets a bye to next round.`);
      
      // Create a special "bye" pairing for the remaining player
      pairings.push({
        whitePlayer: remainingPlayer.id,
        blackPlayer: null,
        round: 1,
        board: pairings.length + 1,
        isBye: true
      });
      
      // Initialize player record
      remainingPlayer.colorHistory = ['white'];
    }
    
    return { pairings, error: null };
  } catch (error) {
    console.error('Error in first round knockout pairing:', error);
    return { 
      pairings: [], 
      error: {
        message: `Pairing Error: ${error.message || 'Unknown error in pairing algorithm'}`
      } 
    };
  }
}

/**
 * Calculate the required number of rounds for a Knockout tournament
 * @param {Number} playerCount - Number of players in the tournament
 * @returns {Number} - Number of rounds required
 */
function calculateKnockoutRounds(playerCount) {
  if (playerCount <= 1) return 0;
  return Math.ceil(Math.log2(playerCount));
}

/**
 * Shuffle an array
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Calculate the final standings for a completed Knockout tournament
 * @param {Array} players - Array of all players
 * @param {Array} allResults - All match results
 * @param {Number} totalRounds - Total rounds played
 * @returns {Array} - Final standings with placement
 */
function calculateKnockoutStandings(players, allResults, totalRounds) {
  // Create a map to track when each player was eliminated
  const eliminationRound = new Map();
  const byePlayers = new Set();
  
  // Process results round by round
  for (let round = 1; round <= totalRounds; round++) {
    const roundResults = allResults.filter(r => r && r.round === round);
    
    for (const result of roundResults) {
      if (!result.result) continue; // Skip incomplete results
      
      if (result.isBye) {
        byePlayers.add(result.whitePlayer);
        continue;
      }
      
      if (!result.result) continue; // Skip incomplete results
      
      if (result.result === '1-0') {
        // White won, black eliminated
        eliminationRound.set(result.blackPlayer, round);
      } else if (result.result === '0-1') {
        // Black won, white eliminated
        eliminationRound.set(result.whitePlayer, round);
      } else if (result.result === '1/2-1/2') {
        // Draw - in knockout, we need a tiebreak rule
        // For simplicity, we'll advance the white player (in practice, use rapid/blitz games)
        console.log(`Draw in knockout match between ${result.whitePlayer} and ${result.blackPlayer}. White advances.`);
        eliminationRound.set(result.blackPlayer, round);
      }
    }
  }
  
  // Create standings with placement information
  const standings = players.map(player => {
    const id = player.id;
    let placement;
    
    if (!eliminationRound.has(id)) {
      // Winner (never eliminated)
      placement = 1;
    } else {
      // Calculate placement based on elimination round
      // Earlier elimination = worse placement
      const round = eliminationRound.get(id);
      
      // In knockout, players eliminated in same round share the same placement
      // For example, all semifinal losers are tied for 3rd/4th place
      placement = Math.pow(2, totalRounds - round) + 1;
    }
    
    return {
      ...player,
      placement,
      eliminatedInRound: eliminationRound.get(id) || 'N/A',
      receivedBye: byePlayers.has(id)
    };
  });
  
  // Sort by placement (ascending)
  return standings.sort((a, b) => a.placement - b.placement);
}

/**
 * Generate seeded pairings for a Knockout tournament
 * This is an alternative to random pairings for the first round
 * @param {Array} players - Array of players with seeding information
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateSeededKnockoutPairings(players) {
  // Ensure players have seeding information
  if (!players.every(p => p.seed !== undefined)) {
    console.log('Not all players have seeding information');
    // Fall back to random pairings
    return generateFirstRoundKnockoutPairings(players);
  }
  
  try {
    // Sort players by seed
    const sortedPlayers = [...players].sort((a, b) => a.seed - b.seed);
    const pairings = [];
    const n = sortedPlayers.length;
    
    // Generate optimal bracket pairing (1 vs n, 2 vs n-1, etc.)
    // This ensures top seeds don't meet until later rounds
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const highSeed = sortedPlayers[i];
      const lowSeed = sortedPlayers[n - 1 - i];
      
      // Higher seed typically gets white
      const whitePlayer = highSeed;
      const blackPlayer = lowSeed;
      
      // Add the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: 1,
        board: pairings.length + 1
      });
      
      // Initialize player records
      whitePlayer.colorHistory = ['white'];
      blackPlayer.colorHistory = ['black'];
    }
    
    // Handle odd number of players
    if (n % 2 !== 0) {
      const middleSeed = sortedPlayers[Math.floor(n / 2)];
      console.log(`Odd number of players. Middle seed ${middleSeed.id} gets a bye.`);
      
      // Create a special "bye" pairing for the middle seed
      pairings.push({
        whitePlayer: middleSeed.id,
        blackPlayer: null,
        round: 1,
        board: pairings.length + 1,
        isBye: true
      });
      
      // Initialize player record
      middleSeed.colorHistory = ['white'];
    }
    
    return { pairings, error: null };
  } catch (error) {
    console.error('Error in seeded knockout pairing:', error);
    return { 
      pairings: [], 
      error: {
        message: `Pairing Error: ${error.message || 'Unknown error in pairing algorithm'}`
      } 
    };
  }
}

/**
 * Generate pairings for a tournament round using the Scheveningen System
 * In this system, each player from Team A plays against each player from Team B
 * @param {Array} teamA - Array of player objects for Team A
 * @param {Array} teamB - Array of player objects for Team B
 * @param {Number} round - Current round number (1-based)
 * @param {Array} previousResults - Results from previous rounds
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateScheveningenPairings(teamA, teamB, round, previousResults = []) {
  console.log('Generating Scheveningen pairings for round', round);

  // Validate input teams
  if (!teamA || !Array.isArray(teamA) || teamA.length === 0) {
    return { 
      pairings: [], 
      error: { message: "Team A has no valid players." } 
    };
  }

  if (!teamB || !Array.isArray(teamB) || teamB.length === 0) {
    return { 
      pairings: [], 
      error: { message: "Team B has no valid players." } 
    };
  }

  // Ensure all players have the required properties
  const validTeamA = teamA.filter(player => player && player.id);
  const validTeamB = teamB.filter(player => player && player.id);

  if (validTeamA.length === 0) {
    return { 
      pairings: [], 
      error: { message: "Team A has no valid players with IDs." } 
    };
  }

  if (validTeamB.length === 0) {
    return { 
      pairings: [], 
      error: { message: "Team B has no valid players with IDs." } 
    };
  }

  try {
    // Calculate total rounds needed
    const totalRounds = Math.ceil((validTeamA.length * validTeamB.length) / 
                       Math.min(validTeamA.length, validTeamB.length));
    
    if (round < 1 || round > totalRounds) {
      return { 
        pairings: [], 
        error: { message: `Invalid round number. Valid rounds are 1 to ${totalRounds}.` } 
      };
    }

    // Create a set of completed pairings to avoid duplicates
    const completedPairings = new Set();
    
    // Add all already played pairings to the set
    if (previousResults && Array.isArray(previousResults)) {
      for (const result of previousResults) {
        if (result.whitePlayer && result.blackPlayer) {
          const pairingKey = `${result.whitePlayer}-${result.blackPlayer}`;
          completedPairings.add(pairingKey);
        }
      }
    }
    
    // Generate all possible pairings
    const possiblePairings = [];
    for (let i = 0; i < validTeamA.length; i++) {
      for (let j = 0; j < validTeamB.length; j++) {
        const playerA = validTeamA[i];
        const playerB = validTeamB[j];
        const pairingKey = `${playerA.id}-${playerB.id}`;
        
        // Skip if this pairing has already been played
        if (completedPairings.has(pairingKey)) continue;
        
        possiblePairings.push({
          playerA,
          playerB,
          pairingKey
        });
      }
    }
    
    // If no possible pairings remain, check if all matches have been played
    if (possiblePairings.length === 0) {
      if (completedPairings.size === validTeamA.length * validTeamB.length) {
        return {
          pairings: [],
          tournamentCompleted: true,
          error: null
        };
      } else {
        return {
          pairings: [],
          error: { message: "No valid pairings can be created for this round." }
        };
      }
    }
    
    // Calculate pairings per round
    const pairingsPerRound = Math.min(validTeamA.length, validTeamB.length);
    
    // Get pairings for this round
    const startIdx = (round - 1) * pairingsPerRound;
    const endIdx = Math.min(startIdx + pairingsPerRound, possiblePairings.length);
    const roundPairings = possiblePairings.slice(startIdx, endIdx);
    
    // Initialize pairings array
    const pairings = [];
    
    // Convert to our standard pairing format
    for (let i = 0; i < roundPairings.length; i++) {
      const { playerA, playerB } = roundPairings[i];
      
      // Determine colors (white/black)
      let whitePlayer, blackPlayer;
      
      // Balance colors based on previous games
      const playerAWhites = playerA.colorHistory ? 
        playerA.colorHistory.filter(c => c === 'white').length : 0;
      const playerBWhites = playerB.colorHistory ? 
        playerB.colorHistory.filter(c => c === 'white').length : 0;
      
      if (playerAWhites < playerBWhites) {
        whitePlayer = playerA;
        blackPlayer = playerB;
      } else if (playerBWhites < playerAWhites) {
        whitePlayer = playerB;
        blackPlayer = playerA;
      } else {
        // If equal, alternate based on round
        if ((round + i) % 2 === 0) {
          whitePlayer = playerA;
          blackPlayer = playerB;
        } else {
          whitePlayer = playerB;
          blackPlayer = playerA;
        }
      }
      
      // Add the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: round,
        board: i + 1,
        teamWhite: whitePlayer === playerA ? 'A' : 'B',
        teamBlack: blackPlayer === playerA ? 'A' : 'B'
      });
      
      // Update player records
      whitePlayer.colorHistory = whitePlayer.colorHistory || [];
      whitePlayer.colorHistory.push('white');
      
      blackPlayer.colorHistory = blackPlayer.colorHistory || [];
      blackPlayer.colorHistory.push('black');
    }
    
    return { pairings, error: null };
  } catch (error) {
    console.error('Error in Scheveningen pairing algorithm:', error);
    return { 
      pairings: [], 
      error: { message: `Pairing Error: ${error.message || 'Unknown error in pairing algorithm'}` } 
    };
  }
}

/**
 * Calculate the total number of rounds needed for a Scheveningen tournament
 * @param {Number} teamASize - Number of players in Team A
 * @param {Number} teamBSize - Number of players in Team B
 * @returns {Number} - Total rounds needed
 */
function calculateScheveningenRounds(teamASize, teamBSize) {
  const totalGames = teamASize * teamBSize;
  const gamesPerRound = Math.min(teamASize, teamBSize);
  
  return Math.ceil(totalGames / gamesPerRound);
}

/**
 * Calculate team scores and individual performance for a Scheveningen tournament
 * @param {Array} teamA - Array of player objects for Team A
 * @param {Array} teamB - Array of player objects for Team B
 * @param {Array} results - Array of match results
 * @returns {Object} - Team scores and individual player performances
 */
function calculateScheveningenResults(teamA, teamB, results) {
  // Create maps of player IDs to team
  const teamAMap = new Map(teamA.map(p => [String(p.id), p]));
  const teamBMap = new Map(teamB.map(p => [String(p.id), p]));
  
  // Initialize team scores
  let teamAScore = 0;
  let teamBScore = 0;
  let matchesCompleted = 0;
  const totalMatches = teamA.length * teamB.length;
  
  // Track individual performance
  const playerPerformance = {};
  
  // Initialize player performance records
  for (const player of teamA) {
    playerPerformance[player.id] = {
      name: player.name || `Player ${player.id}`,
      team: 'A',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      score: 0,
      opponents: []
    };
  }
  
  for (const player of teamB) {
    playerPerformance[player.id] = {
      name: player.name || `Player ${player.id}`,
      team: 'B',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      score: 0,
      opponents: []
    };
  }
  
  // Process results
  if (results && Array.isArray(results)) {
    for (const result of results) {
      if (!result.result) continue; // Skip incomplete results
      
      const whiteId = String(result.whitePlayer);
      const blackId = String(result.blackPlayer);
      
      // Validate that the pairing is between teams A and B
      const whiteInTeamA = teamAMap.has(whiteId);
      const blackInTeamA = teamAMap.has(blackId);
      
      if ((whiteInTeamA && blackInTeamA) || (!whiteInTeamA && !blackInTeamA)) {
        console.warn('Invalid Scheveningen pairing - both players from same team:', result);
        continue;
      }
      
      matchesCompleted++;
      
      // Update player records
      const whitePlayer = playerPerformance[whiteId];
      const blackPlayer = playerPerformance[blackId];
      
      if (whitePlayer) {
        whitePlayer.played++;
        whitePlayer.opponents.push(blackId);
      }
      
      if (blackPlayer) {
        blackPlayer.played++;
        blackPlayer.opponents.push(whiteId);
      }
      
      // Calculate scores based on result
      if (result.result === '1-0') {
        // White win
        if (whiteInTeamA) {
          teamAScore += 1;
        } else {
          teamBScore += 1;
        }
        
        if (whitePlayer) {
          whitePlayer.wins++;
          whitePlayer.score += 1;
        }
        
        if (blackPlayer) {
          blackPlayer.losses++;
        }
      } else if (result.result === '0-1') {
        // Black win
        if (blackInTeamA) {
          teamAScore += 1;
        } else {
          teamBScore += 1;
        }
        
        if (blackPlayer) {
          blackPlayer.wins++;
          blackPlayer.score += 1;
        }
        
        if (whitePlayer) {
          whitePlayer.losses++;
        }
      } else if (result.result === '1/2-1/2') {
        // Draw
        teamAScore += 0.5;
        teamBScore += 0.5;
        
        if (whitePlayer) {
          whitePlayer.draws++;
          whitePlayer.score += 0.5;
        }
        
        if (blackPlayer) {
          blackPlayer.draws++;
          blackPlayer.score += 0.5;
        }
      }
    }
  }
  
  // Check for uncompleted matches
  const uncompletedMatches = totalMatches - matchesCompleted;
  
  // Convert player performance to sorted arrays
  const teamAPerformance = Object.values(playerPerformance)
    .filter(p => p.team === 'A')
    .sort((a, b) => b.score - a.score);
  
  const teamBPerformance = Object.values(playerPerformance)
    .filter(p => p.team === 'B')
    .sort((a, b) => b.score - a.score);
  
  return {
    teamAScore,
    teamBScore,
    matchesCompleted,
    uncompletedMatches,
    totalMatches,
    teamAPerformance,
    teamBPerformance,
    // Check if all possible games have been played
    completed: matchesCompleted === totalMatches
  };
}

/**
 * Generate pairings for a tournament round using the Monrad (Danish) System
 * In this system, leading players are paired with trailing players
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @param {Array} previousPairings - Array of previous pairings
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateMonradPairings(players, round, previousPairings = []) {
  console.log('Generating Monrad (Danish) pairings for round', round);
  
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.log('No players provided for pairing');
    return { pairings: [], error: null };
  }
  
  // Ensure all players have the required properties
  const validPlayers = players.filter(player => player && player.id);
  
  if (validPlayers.length === 0) {
    console.log('No valid players found for pairing');
    return { pairings: [], error: null };
  }
  
  try {
    // Sort players by score (descending)
    const sortedPlayers = [...validPlayers].sort((a, b) => {
      return (b.score || 0) - (a.score || 0);
    });
    
    // Initialize pairings array
    const pairings = [];
    
    // Track which players have been paired in this round
    let pairedPlayers = new Set();
    
    // Create a helper function to check if two players have played before
    const havePlayed = (player1, player2) => {
      const player1Id = String(player1.id);
      const player2Id = String(player2.id);
      
      // Check previous opponents list if available
      if (player1.opponents && player1.opponents.includes(player2Id)) {
        return true;
      }
      
      // Check previous pairings array if available
      if (previousPairings && Array.isArray(previousPairings)) {
        return previousPairings.some(pairing => {
          return (pairing.whitePlayer === player1Id && pairing.blackPlayer === player2Id) ||
                 (pairing.whitePlayer === player2Id && pairing.blackPlayer === player1Id);
        });
      }
      
      return false;
    };
    
    // Create a helper function for determining colors
    const determineColors = (player1, player2) => {
      const player1Whites = player1.colorHistory ? 
        player1.colorHistory.filter(c => c === 'white').length : 0;
      const player2Whites = player2.colorHistory ? 
        player2.colorHistory.filter(c => c === 'white').length : 0;
      
      if (player1Whites < player2Whites) {
        return [player1, player2]; // player1 is white
      } else if (player2Whites < player1Whites) {
        return [player2, player1]; // player2 is white
      } else {
        // If equal, alternate from previous round
        const player1LastColor = player1.colorHistory && player1.colorHistory.length > 0 ? 
          player1.colorHistory[player1.colorHistory.length - 1] : null;
        
        if (player1LastColor === 'white') {
          return [player2, player1]; // player2 is white
        } else {
          return [player1, player2]; // player1 is white
        }
      }
    };
    
    // Monrad (Danish) pairing logic
    // In Monrad, we pair the top half with the bottom half when possible
    // Top player plays middle player, second plays middle+1, etc.
    const middleIndex = Math.floor(sortedPlayers.length / 2);
    
    for (let i = 0; i < middleIndex; i++) {
      // Skip already paired players
      if (pairedPlayers.has(sortedPlayers[i].id)) continue;
      
      const leadingPlayer = sortedPlayers[i];
      
      // Look for a valid trailing player
      let trailingPlayerIndex = middleIndex;
      let foundMatch = false;
      
      // Try to find a trailing player who hasn't played with the leading player
      while (trailingPlayerIndex < sortedPlayers.length && !foundMatch) {
        const trailingPlayer = sortedPlayers[trailingPlayerIndex];
        
        // If trailing player already paired or has played the leading player, move to next
        if (pairedPlayers.has(trailingPlayer.id) || havePlayed(leadingPlayer, trailingPlayer)) {
          trailingPlayerIndex++;
          continue;
        }
        
        pairedPlayers.add(leadingPlayer.id);
        pairedPlayers.add(trailingPlayer.id);
        
        // Determine colors
        const [whitePlayer, blackPlayer] = determineColors(leadingPlayer, trailingPlayer);
        
        // Create the pairing
        pairings.push({
          whitePlayer: whitePlayer.id,
          blackPlayer: blackPlayer.id,
          round: round,
          board: pairings.length + 1
        });
        
        // Update player records
        whitePlayer.colorHistory = whitePlayer.colorHistory || [];
        whitePlayer.colorHistory.push('white');
        
        blackPlayer.colorHistory = blackPlayer.colorHistory || [];
        blackPlayer.colorHistory.push('black');
        
        // Add opponents to player records
        if (!whitePlayer.opponents) whitePlayer.opponents = [];
        if (!blackPlayer.opponents) blackPlayer.opponents = [];
        
        whitePlayer.opponents.push(blackPlayer.id);
        blackPlayer.opponents.push(whitePlayer.id);
        
        foundMatch = true;
      }
      
      // If no valid trailing player found, check any unpaired player
      if (!foundMatch && !pairedPlayers.has(leadingPlayer.id)) {
        for (let j = 0; j < sortedPlayers.length; j++) {
          const potentialOpponent = sortedPlayers[j];
          
          if (potentialOpponent.id !== leadingPlayer.id && 
              !pairedPlayers.has(potentialOpponent.id) &&
              !havePlayed(leadingPlayer, potentialOpponent)) {
            
            pairedPlayers.add(leadingPlayer.id);
            pairedPlayers.add(potentialOpponent.id);
            
            // Determine colors
            const [whitePlayer, blackPlayer] = determineColors(leadingPlayer, potentialOpponent);
            
            // Create the pairing
            pairings.push({
              whitePlayer: whitePlayer.id,
              blackPlayer: blackPlayer.id,
              round: round,
              board: pairings.length + 1
            });
            
            // Update player records
            whitePlayer.colorHistory = whitePlayer.colorHistory || [];
            whitePlayer.colorHistory.push('white');
            
            blackPlayer.colorHistory = blackPlayer.colorHistory || [];
            blackPlayer.colorHistory.push('black');
            
            // Add opponents to player records
            if (!whitePlayer.opponents) whitePlayer.opponents = [];
            if (!blackPlayer.opponents) blackPlayer.opponents = [];
            
            whitePlayer.opponents.push(blackPlayer.id);
            blackPlayer.opponents.push(whitePlayer.id);
            
            break;
          }
        }
      }
    }
    
    // Pair any remaining players
    const remainingPlayers = sortedPlayers.filter(p => !pairedPlayers.has(p.id));
    
    for (let i = 0; i < remainingPlayers.length - 1; i += 2) {
      const player1 = remainingPlayers[i];
      const player2 = remainingPlayers[i + 1];
      
      // Determine colors
      const [whitePlayer, blackPlayer] = determineColors(player1, player2);
      
      // Create the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: round,
        board: pairings.length + 1
      });
      
      // Update player records
      whitePlayer.colorHistory = whitePlayer.colorHistory || [];
      whitePlayer.colorHistory.push('white');
      
      blackPlayer.colorHistory = blackPlayer.colorHistory || [];
      blackPlayer.colorHistory.push('black');
      
      // Add opponents to player records
      if (!whitePlayer.opponents) whitePlayer.opponents = [];
      if (!blackPlayer.opponents) blackPlayer.opponents = [];
      
      whitePlayer.opponents.push(blackPlayer.id);
      blackPlayer.opponents.push(whitePlayer.id);
    }
    
    // Handle odd number of players - assign a bye to the lowest-ranked available player
    if (remainingPlayers.length % 2 !== 0) {
      const byePlayer = remainingPlayers[remainingPlayers.length - 1];
      
      console.log(`Odd number of players. Player ${byePlayer.id} gets a bye.`);
      
      // Create a special "bye" pairing for the remaining player
      pairings.push({
        whitePlayer: byePlayer.id,
        blackPlayer: null,
        round: round,
        board: pairings.length + 1,
        isBye: true
      });
      
      // Update player record
      byePlayer.colorHistory = byePlayer.colorHistory || [];
      byePlayer.colorHistory.push('white');
      
      // For Monrad system, a bye typically counts as a win (1 point)
      byePlayer.score = (byePlayer.score || 0) + 1;
    }
    
    return { pairings, error: null };
  } catch (error) {
    console.error('Error in Monrad pairing algorithm:', error);
    return { 
      pairings: [], 
      error: {
        message: `Pairing Error: ${error.message || 'Unknown error in pairing algorithm'}`
      } 
    };
  }
}

/**
 * Calculate standings for a Monrad (Danish) tournament
 * @param {Array} players - Array of player objects with scores
 * @param {Array} allResults - All match results
 * @returns {Array} - Sorted array of players with performance statistics
 */
function calculateMonradStandings(players, allResults) {
  if (!players || !Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  // Create a deep copy of players to avoid modifying the original objects
  const playersCopy = players.map(player => ({
    ...player,
    wins: 0,
    draws: 0,
    losses: 0,
    playedGames: 0,
    opponentTotalScore: 0, // For tiebreak calculation
    buchholz: 0,            // Buchholz score (sum of opponents' scores)
    sonneborn: 0,           // Sonneborn-Berger score (sum of defeated opponents' scores + half of drawn opponents' scores)
    performance: 0          // Performance rating for Monrad tournaments
  }));
  
  // Create a map for quick access to player data
  const playerMap = new Map(playersCopy.map(player => [String(player.id), player]));
  
  // Process all results to calculate stats
  if (allResults && Array.isArray(allResults)) {
    for (const result of allResults) {
      if (!result.result) continue; // Skip incomplete results
      
      const whitePlayer = playerMap.get(String(result.whitePlayer));
      const blackPlayer = playerMap.get(String(result.blackPlayer));
      
      // Skip if either player is not found
      if (!whitePlayer || (!blackPlayer && !result.isBye)) continue;
      
      if (result.isBye) {
        // Handle byes
        whitePlayer.wins++;
        whitePlayer.playedGames++;
        // No opponent score calculations for byes
      } else {
        // Regular game, update played count
        whitePlayer.playedGames++;
        blackPlayer.playedGames++;
        
        // Track opponents for buchholz calculation
        if (!whitePlayer.opponents) whitePlayer.opponents = [];
        if (!blackPlayer.opponents) blackPlayer.opponents = [];
        
        whitePlayer.opponents.push(blackPlayer.id);
        blackPlayer.opponents.push(whitePlayer.id);
        
        // Update stats based on result
        if (result.result === '1-0') {
          // White win
          whitePlayer.wins++;
          blackPlayer.losses++;
        } else if (result.result === '0-1') {
          // Black win
          blackPlayer.wins++;
          whitePlayer.losses++;
        } else if (result.result === '1/2-1/2') {
          // Draw
          whitePlayer.draws++;
          blackPlayer.draws++;
        }
      }
    }
  }
  
  // Calculate scores for each player
  for (const player of playersCopy) {
    // Standard scoring (1 for win, 0.5 for draw, 0 for loss)
    player.score = player.wins + (player.draws * 0.5);
    
    // Calculate opponent total score for tiebreaks
    if (player.opponents) {
      for (const opponentId of player.opponents) {
        const opponent = playerMap.get(String(opponentId));
        if (opponent) {
          player.opponentTotalScore += opponent.score || 0;
        }
      }
      
      // Buchholz score = sum of opponents' scores
      player.buchholz = player.opponentTotalScore;
      
      // Calculate Sonneborn-Berger score
      // For each opponent, add their score if the player won, or half their score if drawn
      for (const opponentId of player.opponents) {
        const opponent = playerMap.get(String(opponentId));
        if (!opponent) continue;
        
        // Find the game result between this player and the opponent
        const gameResult = allResults.find(result => {
          const whiteId = String(result.whitePlayer);
          const blackId = String(result.blackPlayer);
          return (whiteId === String(player.id) && blackId === opponentId) || 
                 (whiteId === opponentId && blackId === String(player.id));
        });
        
        if (!gameResult || !gameResult.result) continue;
        
        const playerWon = (gameResult.whitePlayer === player.id && gameResult.result === '1-0') ||
                         (gameResult.blackPlayer === player.id && gameResult.result === '0-1');
        const playerDrew = gameResult.result === '1/2-1/2';
        
        if (playerWon) {
          player.sonneborn += opponent.score || 0;
        } else if (playerDrew) {
          player.sonneborn += (opponent.score || 0) / 2;
        }
      }
    }
    
    // Calculate performance metric specific to Monrad tournaments
    // In Monrad, we give extra weight to wins against higher-ranked players
    player.performance = player.score;
    
    // Add adjustments based on opponent strength - this rewards players who beat strong opponents
    if (player.opponents) {
      let opponentRankBonus = 0;
      
      for (const opponentId of player.opponents) {
        const opponent = playerMap.get(String(opponentId));
        if (!opponent) continue;
        
        // Find the game result
        const gameResult = allResults.find(result => {
          const whiteId = String(result.whitePlayer);
          const blackId = String(result.blackPlayer);
          return (whiteId === String(player.id) && blackId === opponentId) || 
                 (whiteId === opponentId && blackId === String(player.id));
        });
        
        if (!gameResult || !gameResult.result) continue;
        
        const playerWon = (gameResult.whitePlayer === player.id && gameResult.result === '1-0') ||
                         (gameResult.blackPlayer === player.id && gameResult.result === '0-1');
        
        if (playerWon) {
          // Calculate opponent's initial rank (based on score) for bonus
          const opponentInitialRank = playersCopy.filter(p => p.score > opponent.score).length + 1;
          
          // Wins against highly ranked players are worth more in Monrad system
          // This is a small adjustment that doesn't affect the primary score
          const rankBonus = 1 / opponentInitialRank; // Higher ranked players (lower rank number) give higher bonus
          opponentRankBonus += rankBonus;
        }
      }
      
      // Add a fractional bonus that doesn't affect the main score but helps with tiebreaks
      player.performance += opponentRankBonus * 0.01;
    }
  }
  
  // Sort players by score and tiebreakers
  const sortedPlayers = [...playersCopy].sort((a, b) => {
    // First by score
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    
    // Then by Monrad performance (which includes opponent strength)
    if (b.performance !== a.performance) {
      return b.performance - a.performance;
    }
    
    // Then by Buchholz score
    if (b.buchholz !== a.buchholz) {
      return b.buchholz - a.buchholz;
    }
    
    // Then by Sonneborn-Berger score
    if (b.sonneborn !== a.sonneborn) {
      return b.sonneborn - a.sonneborn;
    }
    
    // Then by direct encounter
    const directEncounter = allResults.find(result => {
      const whiteId = String(result.whitePlayer);
      const blackId = String(result.blackPlayer);
      return (whiteId === String(a.id) && blackId === String(b.id)) || 
             (whiteId === String(b.id) && blackId === String(a.id));
    });
    
    if (directEncounter && directEncounter.result) {
      if (directEncounter.whitePlayer === a.id) {
        if (directEncounter.result === '1-0') return -1;
        if (directEncounter.result === '0-1') return 1;
      } else {
        if (directEncounter.result === '0-1') return -1;
        if (directEncounter.result === '1-0') return 1;
      }
    }
    
    // Then by number of wins
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    
    // Finally alphabetically by name if available
    if (a.name && b.name) {
      return a.name.localeCompare(b.name);
    }
    
    return 0;
  });
  
  // Add ranks
  sortedPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });
  
  return sortedPlayers;
}

module.exports = { 
  generateSwissPairings,
  generateDoubleSwissPairings,
  generateRoundRobinPairings,
  generateKnockoutPairings,
  calculateKnockoutStandings,
  calculateDoubleSwissStandings,
  generateSeededKnockoutPairings,
  calculateKnockoutRounds,
  generateScheveningenPairings,
  calculateScheveningenRounds,
  calculateScheveningenResults,
  generateMonradPairings,
  calculateMonradStandings
};
