/**
 * Knockout (Single Elimination) Pairing System
 * 
 * In a knockout tournament, players are eliminated after a single loss.
 * The number of rounds is determined by the number of players.
 * With N players, the maximum number of rounds is ceiling(log2(N)).
 */

/**
 * Calculate the maximum number of rounds for a knockout tournament
 * @param {Number} playerCount - Number of players in the tournament
 * @returns {Number} - Maximum number of rounds
 */
function calculateMaxKnockoutRounds(playerCount) {
  return Math.ceil(Math.log2(playerCount));
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
 * Generate Knockout tournament pairings
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateKnockoutPairings(players, round) {
  // Calculate max rounds based on player count
  const maxRounds = calculateMaxKnockoutRounds(players.length);
  
  // Check if we've exceeded the maximum rounds
  if (round > maxRounds) {
    return {
      pairings: [],
      error: {
        message: `Maximum number of rounds (${maxRounds}) exceeded for Knockout tournament with ${players.length} players.`
      }
    };
  }
  
  // For first round, create initial pairings
  if (round === 1) {
    return generateFirstRoundKnockoutPairings(players);
  }
  
  // For subsequent rounds, only pair winners from previous round
  const winnerIds = new Set();
  const losers = [];
  
  // Get winners from previous round
  players.forEach(player => {
    if (player.knockoutStatus && player.knockoutStatus === 'active') {
      winnerIds.add(player.id.toString());
    } else if (player.knockoutStatus && player.knockoutStatus === 'eliminated') {
      losers.push(player);
    }
  });
  
  console.log(`Round ${round}: ${winnerIds.size} active players, ${losers.length} eliminated players`);
  
  // Filter players to include only winners from previous round
  const activePlayersForRound = players.filter(p => winnerIds.has(p.id.toString()));
  
  // If only one player remains, tournament is complete
  if (activePlayersForRound.length <= 1) {
    if (activePlayersForRound.length === 1) {
      console.log(`Tournament completed. Champion: ${activePlayersForRound[0].name}`);
    } else {
      console.log('Tournament completed with no players remaining.');
    }
    
    return {
      pairings: [],
      error: {
        message: 'Tournament completed. No more pairings needed.'
      }
    };
  }
  
  // Pair winners from previous round
  const pairings = [];
  const pairedPlayerIds = new Set();
  
  // Sort players by current tournament score (wins)
  const sortedPlayers = [...activePlayersForRound].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Handle odd number of players - give bye to highest scoring player not yet having a bye
  if (sortedPlayers.length % 2 !== 0) {
    // Find player with highest score who hasn't had a bye yet
    const eligiblePlayers = sortedPlayers.filter(p => !(p.byes && p.byes > 0));
    
    let byePlayer;
    if (eligiblePlayers.length > 0) {
      byePlayer = eligiblePlayers[0]; // Highest scoring player without a bye
    } else {
      byePlayer = sortedPlayers[0]; // If all have had byes, give to highest scoring
    }
    
    // Remove bye player from sorted list
    sortedPlayers.splice(sortedPlayers.indexOf(byePlayer), 1);
    
    // Award bye
    byePlayer.byes = (byePlayer.byes || 0) + 1;
    byePlayer.knockoutStatus = 'active'; // Advance to next round
    
    pairings.push({
      whitePlayer: byePlayer.id,
      blackPlayer: null,
      round: round,
      board: pairings.length + 1,
      isBye: true,
      pairingKey: `${byePlayer.id}_bye_${round}` // Unique key for bye
    });
    
    pairedPlayerIds.add(byePlayer.id.toString());
  }
  
  // Pair remaining players (1 vs 2, 3 vs 4, etc. from sorted list)
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
      pairingKey: pairingKey,
      isKnockout: true // Flag as knockout match
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

/**
 * Generate first round pairings for knockout tournament
 * @param {Array} players - Array of player objects
 * @param {Boolean} seeded - Whether to use seeding (default: false)
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateFirstRoundKnockoutPairings(players, seeded = false) {
  let sortedPlayers;
  
  if (seeded) {
    // Sort by rating for seeded pairings (higher ratings play lower ratings)
    sortedPlayers = [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else {
    // Random shuffle for non-seeded pairings
    sortedPlayers = [...players].sort(() => Math.random() - 0.5);
  }
  
  // Initialize knockout status for all players
  sortedPlayers.forEach(player => {
    player.knockoutStatus = 'active';
  });
  
  const pairings = [];
  const pairedPlayerIds = new Set();
  
  // Handle odd number of players - give bye to highest rated/first player
  if (sortedPlayers.length % 2 !== 0) {
    const byePlayer = sortedPlayers.shift(); // Take the first player for a bye
    
    byePlayer.byes = (byePlayer.byes || 0) + 1;
    
    pairings.push({
      whitePlayer: byePlayer.id,
      blackPlayer: null,
      round: 1,
      board: pairings.length + 1,
      isBye: true,
      pairingKey: `${byePlayer.id}_bye_1` // Unique key for bye
    });
    
    pairedPlayerIds.add(byePlayer.id.toString());
  }
  
  if (seeded) {
    // For seeded pairings, match 1 vs N, 2 vs N-1, etc.
    const numPlayers = sortedPlayers.length;
    const halfNumPlayers = Math.floor(numPlayers / 2);
    
    for (let i = 0; i < halfNumPlayers; i++) {
      const player1 = sortedPlayers[i]; // Higher seed
      const player2 = sortedPlayers[numPlayers - 1 - i]; // Lower seed
      
      // Higher seed gets white as a small advantage
      const whitePlayer = player1;
      const blackPlayer = player2;
      
      // Create a unique ID for this pairing
      const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_1`;
      
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: 1,
        board: pairings.length + 1,
        pairingKey: pairingKey,
        isKnockout: true // Flag as knockout match
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
  } else {
    // For random pairings, pair players sequentially after shuffling
    for (let i = 0; i < sortedPlayers.length; i += 2) {
      const player1 = sortedPlayers[i];
      const player2 = sortedPlayers[i + 1];
      
      // Determine colors randomly for first round
      const whitePlayer = Math.random() < 0.5 ? player1 : player2;
      const blackPlayer = whitePlayer === player1 ? player2 : player1;
      
      // Create a unique ID for this pairing
      const pairingKey = `${whitePlayer.id}_${blackPlayer.id}_1`;
      
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: 1,
        board: pairings.length + 1,
        pairingKey: pairingKey,
        isKnockout: true // Flag as knockout match
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
  }
  
  return { pairings, error: null };
}

module.exports = {
  generateKnockoutPairings,
  calculateMaxKnockoutRounds
};
