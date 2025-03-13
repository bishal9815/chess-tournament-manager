/**
 * Chess Tournament Pairing Algorithms
 * 
 * This file contains three different pairing algorithms for chess tournaments:
 * 1. Swiss Pairing - Players with similar scores play each other, no rematches allowed
 * 2. Double Swiss Pairing - Similar to Swiss but allows up to 2 matches between the same players
 * 3. Round Robin Pairing - Each player faces every other player once (or twice in double round robin)
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
        scoreGroups[nextScore].unshift(group[0]);
      }
    }
    
    console.log('Generated pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating pairings:', error);
    return { pairings: [], error: null };
  }
}

/**
 * Generate pairings for a tournament round using the Double Swiss system
 * @param {Array} players - Array of player objects with scores and previous opponents
 * @param {Number} round - Current round number
 * @param {Number} cycleNumber - Current cycle number (1 or 2)
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateDoubleSwissPairings(players, round, cycleNumber) {
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
          
          // In double Swiss, players can face each other up to twice
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
        scoreGroups[nextScore].unshift(group[0]);
      }
    }
    
    console.log('Generated pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating pairings:', error);
    return { pairings: [], error: null };
  }
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
    
    let actualRound = round;
    // For double round robin, adjust the round for the second cycle
    if (isDoubleRoundRobin && round > totalRounds) {
      actualRound = round - totalRounds;
    }
    
    // Create a copy of players
    const scheduledPlayers = [...validPlayers];
    
    // Add dummy player if needed
    if (hasDummy) {
      scheduledPlayers.push({ id: 'dummy', name: 'Bye' });
    }
    
    // Round robin algorithm using the "circle method"
    // Player at index 0 stays fixed, others rotate
    const pairings = [];
    
    // For each round, pair players correctly
    if (actualRound <= totalRounds) {
      // Create pairings for the current round
      let rotatedPlayers = [...scheduledPlayers];
      
      // Rotate based on the round number
      if (actualRound > 1) {
        const fixed = rotatedPlayers[0];
        rotatedPlayers = [fixed];
        
        for (let i = 0; i < n - 1; i++) {
          const idx = (i - (actualRound - 1) + (n - 1)) % (n - 1) + 1;
          rotatedPlayers.push(scheduledPlayers[idx]);
        }
      }
      
      // Generate pairings from the rotated list
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
        // In regular round robin, players should meet exactly once
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
              message: "Pairing Error: \nEach player must face every other player exactly once (or twice in a double Round Robin). Please check for missing or repeated matchups and correct the pairings."
            } 
          };
        }
        
        // Determine white and black based on round (alternate colors in second cycle)
        let whitePlayer, blackPlayer;
        
        if (isDoubleRoundRobin && round > totalRounds) {
          // In second cycle, reverse colors from first meeting
          const player1LastColor = player1.colorHistory && player1.colorHistory.length > 0 ? 
            player1.colorHistory[player1.colorHistory.length - 1] : null;
          
          // Find if they played before and if so, what colors they had
          let previousMatchIndex = -1;
          for (let j = 0; j < player1Opponents.length; j++) {
            if (player1Opponents[j].toString() === player2.id.toString()) {
              previousMatchIndex = j;
              break;
            }
          }
          
          if (previousMatchIndex !== -1) {
            // Find the color in that match
            const colorInPreviousMatch = player1.colorHistory[previousMatchIndex];
            if (colorInPreviousMatch === 'white') {
              // Reverse in second cycle
              whitePlayer = player2;
              blackPlayer = player1;
            } else {
              whitePlayer = player1;
              blackPlayer = player2;
            }
          } else {
            // If no previous match (shouldn't happen in double round robin)
            whitePlayer = i % 2 === 0 ? player1 : player2;
            blackPlayer = i % 2 === 0 ? player2 : player1;
          }
        } else {
          // First cycle or regular round robin
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
    }
    
    console.log('Generated pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating pairings:', error);
    return { pairings: [], error: null };
  }
}

module.exports = { 
  generateSwissPairings,
  generateDoubleSwissPairings,
  generateRoundRobinPairings
};
