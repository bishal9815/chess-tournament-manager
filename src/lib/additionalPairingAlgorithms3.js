/**
 * Additional Chess Tournament Pairing Algorithms - Part 3
 * 
 * This file contains the Accelerated Pairing algorithm for chess tournaments:
 * - Accelerated Pairing (Swiss Accelerated) - Modified Swiss designed to speed up formation of top-tier matchups
 */

/**
 * Generate pairings for a tournament using Accelerated Pairing (Swiss Accelerated)
 * @param {Array} players - Array of player objects with scores, ratings, and previous opponents
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateAcceleratedPairings(players, round) {
  console.log('Generating Accelerated pairings for round', round);
  
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
    // The acceleration is usually applied in the early rounds (typically first 3-4 rounds)
    // After that, it becomes a regular Swiss tournament
    const isAccelerationRound = round <= 3;
    
    // Make a copy of players to avoid modifying the original
    const playersCopy = validPlayers.map(p => ({...p}));
    
    // Apply acceleration bonus for early rounds
    if (isAccelerationRound) {
      // Sort by rating to identify top half and bottom half
      playersCopy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
      const midpoint = Math.ceil(playersCopy.length / 2);
      
      // Apply virtual bonus points to top half players
      // This will be used only for pairing purposes, not actual scoring
      for (let i = 0; i < midpoint; i++) {
        const bonusPoints = 4 - round; // Decreases with rounds: 3, 2, 1
        playersCopy[i].accelerationBonus = bonusPoints;
        playersCopy[i].effectiveScore = (playersCopy[i].score || 0) + bonusPoints;
      }
      
      // Bottom half players get no bonus
      for (let i = midpoint; i < playersCopy.length; i++) {
        playersCopy[i].accelerationBonus = 0;
        playersCopy[i].effectiveScore = playersCopy[i].score || 0;
      }
      
      console.log('Applied acceleration bonus to top half players');
    } else {
      // For later rounds, use actual score
      for (const player of playersCopy) {
        player.effectiveScore = player.score || 0;
      }
    }
    
    // Sort players by effective score (descending)
    playersCopy.sort((a, b) => b.effectiveScore - a.effectiveScore);
    
    // Initialize results array
    const pairings = [];
    
    // Track which players have been paired in this round
    const pairedPlayers = new Set();
    
    // Handle odd number of players (assign bye)
    if (playersCopy.length % 2 !== 0) {
      console.log('Odd number of players, assigning bye');
      
      // Find the lowest-scoring player who hasn't had a bye yet
      let byePlayer = null;
      
      // First, try to find a player who hasn't had a bye yet
      for (let i = playersCopy.length - 1; i >= 0; i--) {
        if (!playersCopy[i].byes || playersCopy[i].byes === 0) {
          byePlayer = playersCopy[i];
          break;
        }
      }
      
      // If all players have had byes, assign to the lowest-scoring player
      if (!byePlayer && playersCopy.length > 0) {
        byePlayer = playersCopy[playersCopy.length - 1];
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
        
        // Find the original player in the input array and update byes
        const originalPlayer = validPlayers.find(p => p.id.toString() === byePlayer.id.toString());
        if (originalPlayer) {
          originalPlayer.byes = byePlayer.byes;
        }
      }
    }
    
    // Group players by effective score
    const scoreGroups = {};
    for (const player of playersCopy) {
      if (pairedPlayers.has(player.id.toString())) continue;
      
      if (!scoreGroups[player.effectiveScore]) {
        scoreGroups[player.effectiveScore] = [];
      }
      scoreGroups[player.effectiveScore].push(player);
    }
    
    console.log('Score groups (with acceleration):', Object.keys(scoreGroups));
    
    // Process each score group
    const scores = Object.keys(scoreGroups).sort((a, b) => b - a);
    
    // Flag to track if any pairing was impossible
    let pairingImpossible = false;
    
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
          
          // Check if these players have already played each other
          const player1Opponents = player1.previousOpponents || [];
          const alreadyPlayed = player1Opponents.some(oppId => 
            oppId && player2.id && oppId.toString() === player2.id.toString()
          );
          
          if (!alreadyPlayed) {
            opponentIndex = i;
            break;
          }
        }
        
        // If no valid opponent found in the same score group, try to find in other score groups
        if (opponentIndex === -1) {
          console.log(`No valid opponent found for player ${player1.id} in same score group`);
          
          // In accelerated pairing, it's especially important to get top players
          // facing other top players early, so we should raise an error
          if (isAccelerationRound && player1.accelerationBonus > 0) {
            return { 
              pairings: [], 
              error: {
                message: "Pairing Error: Accelerated pairings must prioritize top-tier matchups early. Ensure bonus points or initial advantages are applied correctly."
              } 
            };
          }
          
          // If we've searched all groups and still can't find a valid opponent, 
          // we have a pairing problem - raise an error
          pairingImpossible = true;
          console.log("Pairing Impossible: No valid pairing exists");
          
          return { 
            pairings: [], 
            error: {
              message: "Pairing Impossible\nNo valid pairing exists: The players could not be simultaneously matched while satisfying all absolute criteria."
            } 
          };
        }
        
        const player2 = group[opponentIndex];
        console.log(`Pairing players: ${player1.id} vs ${player2.id}`);
        
        // Determine colors (white/black) based on previous games
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
        
        // Find original players in the input array
        const originalWhitePlayer = validPlayers.find(p => p.id.toString() === whitePlayer.id.toString());
        const originalBlackPlayer = validPlayers.find(p => p.id.toString() === blackPlayer.id.toString());
        
        // Update player records in both copied and original arrays
        whitePlayer.previousOpponents = whitePlayer.previousOpponents || [];
        whitePlayer.previousOpponents.push(blackPlayer.id);
        whitePlayer.colorHistory = whitePlayer.colorHistory || [];
        whitePlayer.colorHistory.push('white');
        
        blackPlayer.previousOpponents = blackPlayer.previousOpponents || [];
        blackPlayer.previousOpponents.push(whitePlayer.id);
        blackPlayer.colorHistory = blackPlayer.colorHistory || [];
        blackPlayer.colorHistory.push('black');
        
        if (originalWhitePlayer) {
          originalWhitePlayer.previousOpponents = originalWhitePlayer.previousOpponents || [];
          originalWhitePlayer.previousOpponents.push(blackPlayer.id);
          originalWhitePlayer.colorHistory = originalWhitePlayer.colorHistory || [];
          originalWhitePlayer.colorHistory.push('white');
        }
        
        if (originalBlackPlayer) {
          originalBlackPlayer.previousOpponents = originalBlackPlayer.previousOpponents || [];
          originalBlackPlayer.previousOpponents.push(whitePlayer.id);
          originalBlackPlayer.colorHistory = originalBlackPlayer.colorHistory || [];
          originalBlackPlayer.colorHistory.push('black');
        }
        
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
        scoreGroups[nextScore].unshift(group[0]);
      }
    }
    
    console.log('Generated accelerated pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating accelerated pairings:', error);
    return { 
      pairings: [], 
      error: {
        message: "Error generating pairings: " + error.message
      }
    };
  }
}

module.exports = {
  generateAcceleratedPairings
};
