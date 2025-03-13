/**
 * Additional Chess Tournament Pairing Algorithms
 * 
 * This file contains additional pairing algorithms for chess tournaments:
 * 1. Knockout (Single Elimination) - Players are eliminated after losing
 * 2. Scheveningen System - Team-based pairings where each player faces every opponent from the opposing team
 * 3. Monrad System (Danish System) - Modified Swiss where leaders may face trailing players
 * 4. Random Pairing - Assigns opponents randomly without considering scores or rankings
 * 5. Accelerated Pairing - Modified Swiss designed to speed up formation of top-tier matchups
 */

/**
 * Generate pairings for a Knockout (Single Elimination) tournament
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateKnockoutPairings(players, round) {
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
  
  if (validPlayers.length === 1) {
    console.log('Only one player found - this player is the champion');
    return { 
      pairings: [], 
      error: {
        message: "Tournament complete! The champion has been determined."
      }
    };
  }
  
  console.log('Valid players for pairing:', validPlayers.length);
  
  try {
    // Identify players who have advanced to this round (winners from previous rounds)
    let eligiblePlayers = [...validPlayers];
    
    // If this is not the first round, check for previous round winners
    if (round > 1) {
      // Players should have a 'knockoutStatus' property showing if they're still active
      eligiblePlayers = validPlayers.filter(player => 
        player.knockoutStatus !== 'eliminated' && 
        player.knockoutRound >= round - 1
      );
      
      console.log(`Eligible players for round ${round}:`, eligiblePlayers.length);
      
      // Verify that we have the correct number of players for this round
      // In a knockout, round 1 has N players, round 2 has N/2, round 3 has N/4, etc.
      const expectedPlayerCount = Math.pow(2, Math.ceil(Math.log2(validPlayers.length)) - (round - 1));
      
      if (eligiblePlayers.length !== expectedPlayerCount && eligiblePlayers.length > 1) {
        return {
          pairings: [],
          error: {
            message: "Pairing Error: Each match must have a clear winner to advance. Ensure no player advances without winning or verify tiebreakers if applicable."
          }
        };
      }
    }
    
    // For round 1 or players without knockout status, seed them based on ratings or initial seeding
    if (round === 1) {
      // Sort players by rating (if available) or any other seeding criteria
      eligiblePlayers.sort((a, b) => {
        // If ratings are available, use them
        if (a.rating && b.rating) {
          return b.rating - a.rating;
        }
        // Otherwise, use alphabetical order or some other criteria
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    
    // Handle byes if player count is not a power of 2
    const pairings = [];
    
    // If we have an odd number of players in the first round, we need to handle byes
    if (round === 1 && eligiblePlayers.length % 2 !== 0) {
      const totalPlayers = eligiblePlayers.length;
      const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(totalPlayers)));
      const byesNeeded = nextPowerOfTwo - totalPlayers;
      
      console.log(`Need to assign ${byesNeeded} byes`);
      
      // In knockout tournaments, byes are usually given to top seeds
      for (let i = 0; i < byesNeeded; i++) {
        // Give bye to the top seed (who is at index i because we're starting from top)
        const playerWithBye = eligiblePlayers[i];
        
        // Mark this player as advanced to the next round
        playerWithBye.knockoutStatus = 'active';
        playerWithBye.knockoutRound = round + 1;
        
        // Create a bye pairing
        pairings.push({
          whitePlayer: playerWithBye.id,
          blackPlayer: null, // null indicates a bye
          round: round,
          board: pairings.length + 1,
          isBye: true
        });
        
        // Remove this player from the list to be paired
        eligiblePlayers.splice(i, 1);
        i--; // Adjust index since we removed an element
      }
    }
    
    // Now pair the remaining players
    // In knockout tournaments, the standard seeding is: 1 vs 16, 8 vs 9, 5 vs 12, 4 vs 13, etc.
    // This ensures that the top seeds don't meet until later rounds
    while (eligiblePlayers.length >= 2) {
      const player1 = eligiblePlayers.shift(); // Get highest seed
      const player2 = eligiblePlayers.pop();   // Get lowest seed of remaining players
      
      // Determine colors (white/black) - can be based on seeding or alternating
      // In this example, higher seed gets white
      const whitePlayer = player1;
      const blackPlayer = player2;
      
      // Add the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: round,
        board: pairings.length + 1,
        isKnockout: true
      });
      
      // In knockout, we don't update previousOpponents because it's not relevant
      // Each match is an elimination match
    }
    
    console.log('Generated knockout pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating knockout pairings:', error);
    return { 
      pairings: [], 
      error: {
        message: "Error generating pairings: " + error.message
      }
    };
  }
}

/**
 * Generate pairings for a Scheveningen System tournament
 * @param {Array} players - Array of player objects with team designation
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generateScheveningenPairings(players, round) {
  console.log('Generating Scheveningen pairings for round', round);
  
  if (!players || !Array.isArray(players) || players.length === 0) {
    console.log('No players provided for pairing');
    return { pairings: [], error: null };
  }
  
  // Ensure all players have the required properties
  const validPlayers = players.filter(player => player && player.id && player.team);
  
  if (validPlayers.length === 0) {
    console.log('No valid players found for pairing');
    return { pairings: [], error: null };
  }
  
  // Group players by team
  const teams = {};
  for (const player of validPlayers) {
    if (!teams[player.team]) {
      teams[player.team] = [];
    }
    teams[player.team].push(player);
  }
  
  // We should have exactly 2 teams for Scheveningen
  const teamIds = Object.keys(teams);
  if (teamIds.length !== 2) {
    return {
      pairings: [],
      error: {
        message: "Pairing Error: Scheveningen System requires exactly 2 teams. Please ensure all players are assigned to one of two teams."
      }
    };
  }
  
  // Both teams should have the same number of players
  const team1 = teams[teamIds[0]];
  const team2 = teams[teamIds[1]];
  
  if (team1.length !== team2.length) {
    return {
      pairings: [],
      error: {
        message: "Pairing Error: Both teams must have the same number of players in Scheveningen System."
      }
    };
  }
  
  const teamSize = team1.length;
  
  try {
    // In Scheveningen, each player from Team A plays against each player from Team B
    // Total rounds needed = number of players in each team
    
    if (round > teamSize) {
      return {
        pairings: [],
        error: {
          message: "Round number exceeds maximum rounds for Scheveningen tournament."
        }
      };
    }
    
    // Initialize pairings array
    const pairings = [];
    
    // Sort players within each team (usually by rating or board number)
    team1.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    team2.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    // For each round, rotate one team to create new pairings
    // This is a common method in Scheveningen to ensure each player faces every opponent
    
    // Keep track of previous matches to avoid duplicates
    let playerMatchups = new Set();
    
    // Check existing matchups
    for (const player of validPlayers) {
      if (player.previousOpponents) {
        for (const oppId of player.previousOpponents) {
          // Create a unique identifier for each matchup (smaller ID first for consistency)
          const matchupId = [player.id, oppId].sort().join('-');
          playerMatchups.add(matchupId);
        }
      }
    }
    
    // Create pairings for the current round
    // Rotate team2 for each round
    const rotatedTeam2 = [...team2];
    for (let i = 1; i < round; i++) {
      // Rotate: move first element to the end
      rotatedTeam2.push(rotatedTeam2.shift());
    }
    
    for (let i = 0; i < teamSize; i++) {
      const player1 = team1[i];
      const player2 = rotatedTeam2[i];
      
      // Check if these players have already played each other
      const matchupId = [player1.id, player2.id].sort().join('-');
      
      if (playerMatchups.has(matchupId)) {
        return {
          pairings: [],
          error: {
            message: "Pairing Error: Each player must face every opponent from the opposing team exactly once. Check for missing or incorrect matchups between teams."
          }
        };
      }
      
      // Determine colors based on team and round
      // Alternate colors between rounds
      let whitePlayer, blackPlayer;
      if ((round + i) % 2 === 0) {
        whitePlayer = player1;
        blackPlayer = player2;
      } else {
        whitePlayer = player2;
        blackPlayer = player1;
      }
      
      // Add the pairing
      pairings.push({
        whitePlayer: whitePlayer.id,
        blackPlayer: blackPlayer.id,
        round: round,
        board: i + 1, // Board number corresponds to player's position in team
        teamMatch: true,
        team1: teamIds[0],
        team2: teamIds[1]
      });
      
      // Update player records
      whitePlayer.previousOpponents = whitePlayer.previousOpponents || [];
      whitePlayer.previousOpponents.push(blackPlayer.id);
      
      blackPlayer.previousOpponents = blackPlayer.previousOpponents || [];
      blackPlayer.previousOpponents.push(whitePlayer.id);
    }
    
    console.log('Generated Scheveningen pairings:', pairings);
    return { pairings, error: null };
  } catch (error) {
    console.error('Error generating Scheveningen pairings:', error);
    return { 
      pairings: [], 
      error: {
        message: "Error generating pairings: " + error.message
      }
    };
  }
}

module.exports = {
  generateKnockoutPairings,
  generateScheveningenPairings
};
