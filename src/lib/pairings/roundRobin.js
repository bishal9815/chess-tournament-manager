/**
 * Round Robin Pairing System
 * 
 * In Round Robin, each player faces every other player once (or twice in double round robin).
 * The number of rounds equals N-1 for single round robin (where N is number of players)
 * and 2*(N-1) for double round robin.
 */

/**
 * Calculate the maximum number of rounds for Round Robin tournament
 * @param {Number} playerCount - Number of players in the tournament
 * @param {Boolean} isDoubleRoundRobin - Whether this is a double round robin
 * @returns {Number} - Maximum number of rounds
 */
function calculateMaxRoundRobinRounds(playerCount, isDoubleRoundRobin = false) {
  const singleRoundRobinRounds = playerCount - 1;
  return isDoubleRoundRobin ? 2 * singleRoundRobinRounds : singleRoundRobinRounds;
}

/**
 * Determine white player based on color history
 * @param {Object} player1 - First player
 * @param {Object} player2 - Second player
 * @returns {Object} - Player who should play white
 */
function determineWhitePlayer(player1, player2) {
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
}

/**
 * Generate Round Robin pairings for a round
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @param {Boolean} isDoubleRoundRobin - Whether this is a double round robin
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateRoundRobinPairings(players, round, isDoubleRoundRobin = false) {
  // Calculate maximum rounds based on player count
  const maxRounds = calculateMaxRoundRobinRounds(players.length, isDoubleRoundRobin);
  
  // Check if we've exceeded the maximum rounds
  if (round > maxRounds) {
    return {
      pairings: [],
      error: {
        message: `Maximum number of rounds (${maxRounds}) exceeded for ${isDoubleRoundRobin ? 'Double ' : ''}Round Robin tournament with ${players.length} players.`
      }
    };
  }
  
  // Determine if we're in the second cycle of double round robin
  const isSecondCycle = isDoubleRoundRobin && round > (players.length - 1);
  const adjustedRound = isSecondCycle ? round - (players.length - 1) : round;
  
  // Using a round robin scheduling algorithm (circle method)
  // Players are arranged in a circle and rotated after each round
  const pairings = [];
  
  // Create a fixed pivot and rotate the rest
  let playerPositions = [...players];
  
  // Handle odd number of players by adding a "ghost" player that represents a bye
  if (playerPositions.length % 2 !== 0) {
    playerPositions.push({ id: 'bye', name: 'BYE' });
  }
  
  const n = playerPositions.length;
  
  // Rotate players to the correct configuration for this round
  // Keep first player fixed and rotate others
  for (let i = 1; i < adjustedRound; i++) {
    playerPositions = [
      playerPositions[0],
      ...playerPositions.slice(n - 1, n),
      ...playerPositions.slice(1, n - 1)
    ];
  }
  
  // Create pairings from the positions
  for (let i = 0; i < n / 2; i++) {
    const player1 = playerPositions[i];
    const player2 = playerPositions[n - 1 - i];
    
    // Skip if either player is the "ghost" (bye)
    if (player1.id === 'bye' || player2.id === 'bye') {
      const byePlayer = player1.id === 'bye' ? player2 : player1;
      
      // Award a bye
      byePlayer.byes = (byePlayer.byes || 0) + 1;
      
      pairings.push({
        whitePlayer: byePlayer.id,
        blackPlayer: null,
        round: round,
        board: pairings.length + 1,
        isBye: true,
        pairingKey: `${byePlayer.id}_bye_${round}` // Unique key for bye
      });
      
      continue;
    }
    
    // Determine colors for regular pairings
    let whitePlayer, blackPlayer;
    
    if (isSecondCycle) {
      // In second cycle, reverse colors from first cycle
      // Check if these players have played before
      const previousPairing = player1.previousOpponents && 
        player1.previousOpponents.includes(player2.id);
      
      if (previousPairing) {
        // Find color from first cycle
        const player1Index = players.findIndex(p => p.id === player1.id);
        const player2Index = players.findIndex(p => p.id === player2.id);
        
        if (player1Index !== -1 && player2Index !== -1) {
          // Get the match from first cycle
          const firstCycleRound = round - (players.length - 1);
          const player1ColorInFirstCycle = players[player1Index].colorHistory[firstCycleRound - 1];
          
          // Reverse colors for second cycle
          if (player1ColorInFirstCycle === 'white') {
            whitePlayer = player2;
            blackPlayer = player1;
          } else {
            whitePlayer = player1;
            blackPlayer = player2;
          }
        } else {
          // Fallback to color balance
          whitePlayer = determineWhitePlayer(player1, player2);
          blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
        }
      } else {
        // These players haven't played before (shouldn't happen in round robin)
        whitePlayer = determineWhitePlayer(player1, player2);
        blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
      }
    } else {
      // For first cycle or single round robin, determine colors by balance
      whitePlayer = determineWhitePlayer(player1, player2);
      blackPlayer = whitePlayer.id === player1.id ? player2 : player1;
    }
    
    // Create a unique ID for this pairing
    const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_${round}`;
    
    pairings.push({
      whitePlayer: whitePlayer.id,
      blackPlayer: blackPlayer.id,
      round: round,
      board: pairings.length + 1,
      isRematch: isSecondCycle, // Flag if this is a rematch (second cycle)
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
  }
  
  return { pairings, error: null };
}

/**
 * Generate Berger tables for round robin tournaments
 * This is an alternative algorithm that can be used
 * @param {Array} players - Array of player objects
 * @returns {Array} - Array of rounds, each with pairings
 */
function generateBergerTables(players) {
  const n = players.length;
  const rounds = [];
  
  // Add ghost player for odd number of players
  const adjustedPlayers = [...players];
  if (n % 2 !== 0) {
    adjustedPlayers.push({ id: 'bye', name: 'BYE' });
  }
  
  const m = adjustedPlayers.length;
  
  // Generate the round robin schedule
  for (let round = 1; round <= m - 1; round++) {
    const roundPairings = [];
    
    for (let i = 0; i < m / 2; i++) {
      const j = (m - 1 - i) % (m - 1);
      
      let player1 = i === 0 ? adjustedPlayers[0] : adjustedPlayers[(round + i - 1) % (m - 1) + 1];
      let player2 = adjustedPlayers[(round + j - 1) % (m - 1) + 1];
      
      // Handle bye
      if (player1.id === 'bye' || player2.id === 'bye') {
        const actualPlayer = player1.id === 'bye' ? player2 : player1;
        roundPairings.push({
          whitePlayer: actualPlayer.id,
          blackPlayer: null,
          isBye: true
        });
      } else {
        // Alternate colors based on round number and board number
        const whitePlayer = (round + i) % 2 === 0 ? player1 : player2;
        const blackPlayer = (round + i) % 2 === 0 ? player2 : player1;
        
        roundPairings.push({
          whitePlayer: whitePlayer.id,
          blackPlayer: blackPlayer.id
        });
      }
    }
    
    rounds.push(roundPairings);
  }
  
  return rounds;
}

module.exports = {
  generateRoundRobinPairings,
  calculateMaxRoundRobinRounds,
  generateBergerTables
};
