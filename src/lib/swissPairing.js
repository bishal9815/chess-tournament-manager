/**
 * Swiss Pairing Algorithm for Chess Tournaments
 * 
 * This implementation follows the basic Swiss system rules:
 * 1. Players with the same score are paired together when possible
 * 2. No player should play against the same opponent twice
 * 3. Each player should have an equal number of white and black games when possible
 * 4. Players are paired based on their current score
 * 5. When there's an odd number of players, one player gets a bye (free point)
 */

/**
 * Generate pairings for a tournament round using the Swiss system
 * @param {Array} players - Array of player objects with scores and previous opponents
 * @param {Number} round - Current round number
 * @returns {Array} - Array of match objects with white and black player assignments
 */
function generateSwissPairings(players, round) {
  console.log('Generating Swiss pairings for round', round);
  console.log('Players:', JSON.stringify(players));
  
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.log('No players provided for pairing');
    return [];
  }
  
  // Ensure all players have the required properties
  const validPlayers = players.filter(player => player && player.id);
  
  if (validPlayers.length === 0) {
    console.log('No valid players found for pairing');
    return [];
  }
  
  if (validPlayers.length === 1) {
    console.log('Only one player found, cannot generate pairings');
    return [];
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
        
        // If no valid opponent found in the same score group, just take the next player
        if (opponentIndex === -1) {
          console.log(`No valid opponent found for player ${player1.id} in same score group`);
          opponentIndex = 1;
          console.log(`Pairing with next available player: ${group[opponentIndex].id}`);
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
    return pairings;
  } catch (error) {
    console.error('Error generating pairings:', error);
    return [];
  }
}

module.exports = { generateSwissPairings }; 