/**
 * Additional Chess Tournament Pairing Algorithms - Part 2
 * 
 * This file contains additional pairing algorithms for chess tournaments:
 * 1. Monrad System (Danish System) - Modified Swiss where leaders may face trailing players
 * 2. Random Pairing - Assigns opponents randomly without considering scores or rankings
 * 3. Accelerated Pairing - Modified Swiss designed to speed up formation of top-tier matchups
 */

/**
 * Generate pairings for a Monrad System (Danish System) tournament
 * @param {Array} players - Array of player objects with scores and previous opponents
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateMonradPairings(players, round) {
  console.log('Generating Monrad pairings for round', round);
  
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
    
    // Divide players into score groups
    const scoreGroups = {};
    for (const player of sortedPlayers) {
      if (pairedPlayers.has(player.id.toString())) continue;
      
      const score = player.score || 0;
      if (!scoreGroups[score]) {
        scoreGroups[score] = [];
      }
      scoreGroups[score].push(player);
    }
    
    // Get all score values and sort them (descending)
    const scores = Object.keys(scoreGroups).sort((a, b) => b - a);
    
    // In Monrad System, leaders should face trailing players
    // Each score group's players are paired with players from a different score group
    
    // Monrad balancing factor - determines how far apart score groups are paired
    const monradFactor = Math.ceil(scores.length / 3);
    
    // Process each score group
    for (let scoreIndex = 0; scoreIndex < scores.length; scoreIndex++) {
      const score = scores[scoreIndex];
      let currentGroup = scoreGroups[score].filter(p => !pairedPlayers.has(p.id.toString()));
      
      if (currentGroup.length === 0) continue;
      
      // Determine which score group to pair with (ideally a lower score group)
      // In Monrad, we intentionally want higher-scored players to face lower-scored players
      let targetScoreIndex = Math.min(scoreIndex + monradFactor, scores.length - 1);
      
      // If we're already at the lowest score group, pair within the group
      if (targetScoreIndex === scoreIndex) {
        // Pair players within the same score group
        while (currentGroup.length >= 2) {
          const player1 = currentGroup[0];
          let opponentIndex = -1;
          
          // Find first valid opponent (not previously played)
          for (let i = 1; i < currentGroup.length; i++) {
            const player2 = currentGroup[i];
            
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
          
          // If no valid opponent found, we have a pairing problem
          if (opponentIndex === -1) {
            return { 
              pairings: [], 
              error: {
                message: "Pairing Error: Pairings must follow the Monrad rule of matching leaders with trailing players. Avoid mismatched score-based pairings."
              } 
            };
          }
          
          const player2 = currentGroup[opponentIndex];
          
          // Determine colors
          let whitePlayer, blackPlayer;
          const player1Whites = player1.colorHistory ? 
            player1.colorHistory.filter(c => c === 'white').length : 0;
          const player2Whites = player2.colorHistory ? 
            player2.colorHistory.filter(c => c === 'white').length : 0;
          
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
          
          // Remove paired players from the current group
          currentGroup = currentGroup.filter(p => !pairedPlayers.has(p.id.toString()));
        }
      } else {
        // Get the target score group
        const targetScore = scores[targetScoreIndex];
        let targetGroup = scoreGroups[targetScore].filter(p => !pairedPlayers.has(p.id.toString()));
        
        // Pair players across different score groups
        while (currentGroup.length > 0 && targetGroup.length > 0) {
          const player1 = currentGroup[0]; // Higher-scored player
          let opponentIndex = -1;
          
          // Find first valid opponent from the target group
          for (let i = 0; i < targetGroup.length; i++) {
            const player2 = targetGroup[i];
            
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
          
          // If no valid opponent found, try the next score group
          if (opponentIndex === -1) {
            targetScoreIndex = (targetScoreIndex + 1) % scores.length;
            if (targetScoreIndex === scoreIndex) targetScoreIndex = (targetScoreIndex + 1) % scores.length;
            
            // If we've checked all score groups, we have a pairing problem
            if (targetScoreIndex === scoreIndex + 1 || targetScoreIndex === scoreIndex - 1) {
              return { 
                pairings: [], 
                error: {
                  message: "Pairing Error: Pairings must follow the Monrad rule of matching leaders with trailing players. Avoid mismatched score-based pairings."
                } 
              };
            }
            
            targetScore = scores[targetScoreIndex];
            targetGroup = scoreGroups[targetScore].filter(p => !pairedPlayers.has(p.id.toString()));
            continue;
          }
          
          const player2 = targetGroup[opponentIndex];
          
          // Determine colors
          let whitePlayer, blackPlayer;
          const player1Whites = player1.colorHistory ? 
            player1.colorHistory.filter(c => c === 'white').length : 0;
          const player2Whites = player2.colorHistory ? 
            player2.colorHistory.filter(c => c === 'white').length : 0;
          
          if (player1Whites < player2Whites) {
            whitePlayer = player1;
            blackPlayer = player2;
          } else if (player2Whites < player1Whites) {
            whitePlayer = player2;
            blackPlayer = player1;
          } else {
            // If equal, give white to the higher-scored player
            whitePlayer = player1;
            blackPlayer = player2;
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
          
          // Remove paired players
          currentGroup = currentGroup.filter(p => !pairedPlayers.has(p.id.toString()));
          targetGroup = targetGroup.filter(p => !pairedPlayers.has(p.id.toString()));
        }
      }
    }
    
    // Handle any remaining unpaired players (should be rare in Monrad)
    const remainingPlayers = sortedPlayers.filter(p => !pairedPlayers.has(p.id.toString()));
    
    if (remainingPlayers.length >= 2) {
      // Pair remaining players with each other using Swiss-like method
      for (let i = 0; i < remainingPlayers.length - 1; i += 2) {
        const player1 = remainingPlayers[i];
        const player2 = remainingPlayers[i + 1];
        
        // Determine colors
        let whitePlayer, blackPlayer;
        const player1Whites = player1.colorHistory ? 
          player1.colorHistory.filter(c => c === 'white').length : 0;
        const player2Whites = player2.colorHistory ? 
          player2.colorHistory.filter(c => c === 'white').length : 0;
        
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
      }
    }
    
    console.log('Generated Monrad pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating Monrad pairings:', error);
    return { 
      pairings: [], 
      error: {
        message: "Error generating pairings: " + error.message
      }
    };
  }
}

/**
 * Generate pairings for a tournament using Random Pairing
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateRandomPairings(players, round) {
  console.log('Generating Random pairings for round', round);
  
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
    // Shuffle the players randomly
    const shuffledPlayers = [...validPlayers];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }
    
    // Initialize results array
    const pairings = [];
    
    // Handle odd number of players (assign bye)
    if (shuffledPlayers.length % 2 !== 0) {
      console.log('Odd number of players, assigning bye');
      
      // In random pairing, assign bye randomly
      const randomIndex = Math.floor(Math.random() * shuffledPlayers.length);
      const byePlayer = shuffledPlayers[randomIndex];
      
      byePlayer.byes = (byePlayer.byes || 0) + 1;
      
      // Create a special "bye" pairing
      pairings.push({
        whitePlayer: byePlayer.id,
        blackPlayer: null, // null indicates a bye
        round: round,
        board: pairings.length + 1,
        isBye: true
      });
      
      // Remove player with bye from the list
      shuffledPlayers.splice(randomIndex, 1);
    }
    
    // Track previous matchups to avoid duplicates where possible
    const previousMatchups = new Set();
    
    // Get all previous matchups
    for (const player of validPlayers) {
      if (player.previousOpponents) {
        player.previousOpponents.forEach(oppId => {
          const matchupId = [player.id, oppId].sort().join('-');
          previousMatchups.add(matchupId);
        });
      }
    }
    
    // Pair remaining players randomly, but try to avoid duplicates
    const unpaired = [...shuffledPlayers];
    
    while (unpaired.length >= 2) {
      const player1 = unpaired.shift();
      let foundValidOpponent = false;
      
      // Try to find an opponent this player hasn't faced yet
      for (let i = 0; i < unpaired.length; i++) {
        const player2 = unpaired[i];
        const matchupId = [player1.id, player2.id].sort().join('-');
        
        if (!previousMatchups.has(matchupId)) {
          // Found a player they haven't faced yet
          unpaired.splice(i, 1);
          
          // Determine colors randomly
          const isPlayer1White = Math.random() < 0.5;
          const whitePlayer = isPlayer1White ? player1 : player2;
          const blackPlayer = isPlayer1White ? player2 : player1;
          
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
          
          // Add this matchup to previous matchups
          previousMatchups.add(matchupId);
          
          foundValidOpponent = true;
          break;
        }
      }
      
      // If no valid opponent found (all have played each other), allow a rematch
      if (!foundValidOpponent && unpaired.length > 0) {
        const player2 = unpaired.shift();
        
        // Determine colors randomly
        const isPlayer1White = Math.random() < 0.5;
        const whitePlayer = isPlayer1White ? player1 : player2;
        const blackPlayer = isPlayer1White ? player2 : player1;
        
        // Check how many times they've played before
        const matchCount = (player1.previousOpponents || []).filter(id => 
          id.toString() === player2.id.toString()
        ).length;
        
        // If they've already played multiple times, raise an error
        if (matchCount >= 2) {
          return { 
            pairings: [], 
            error: {
              message: "Pairing Error: Random pairings must ensure no duplicate matchups occur. Verify pairings to prevent repeated opponents unnecessarily."
            } 
          };
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
    
    console.log('Generated random pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating random pairings:', error);
    return { 
      pairings: [], 
      error: {
        message: "Error generating pairings: " + error.message
      }
    };
  }
}

module.exports = {
  generateMonradPairings,
  generateRandomPairings
};
