/**
 * Tournament Utility Functions
 * 
 * This file contains utility functions for tournament management:
 * - Tiebreak calculations
 * - Tournament statistics
 * - Other helper functions
 */

const mongoose = require('mongoose');

/**
 * Calculate tiebreaks for a tournament
 * @param {Object} tournament - Tournament document with participants
 * @param {Array} matches - Matches for the tournament
 * @returns {Object} - Updated tournament with tiebreak values
 */
async function calculateTiebreaks(tournament, matches) {
  try {
    console.log('Calculating tiebreaks for tournament:', tournament._id);
    
    // If matches are not provided, use the tournament matches
    if (!matches || !Array.isArray(matches)) {
      const Match = mongoose.model('Match');
      matches = await Match.find({ 
        tournament: tournament._id,
        result: { $ne: '*' } // Only completed matches
      });
    }
    
    console.log(`Found ${matches.length} completed matches for tiebreak calculation`);
    
    // Create a map of player IDs to their opponents and results
    const playerOpponents = {};
    const playerScores = {};
    const playerWins = {};
    const playerBlackWins = {};
    
    // Initialize maps
    tournament.participants.forEach(participant => {
      if (participant.player) {
        const playerId = participant.player._id.toString();
        playerOpponents[playerId] = [];
        playerScores[playerId] = {
          roundScores: [],
          totalScore: 0
        };
        playerWins[playerId] = 0;
        playerBlackWins[playerId] = 0;
      }
    });
    
    // Process matches to build opponent lists and progressive scores
    matches.forEach(match => {
      if (!match.whitePlayer || !match.blackPlayer) return;
      
      const whiteId = match.whitePlayer.toString();
      const blackId = match.blackPlayer.toString();
      
      // Record opponents and results
      if (playerOpponents[whiteId]) {
        const whiteResult = match.result === '1-0' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerOpponents[whiteId].push({
          opponent: blackId,
          result: whiteResult
        });
        
        // Count wins
        if (whiteResult === 1) {
          playerWins[whiteId] = (playerWins[whiteId] || 0) + 1;
        }
      }
      
      if (playerOpponents[blackId]) {
        const blackResult = match.result === '0-1' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerOpponents[blackId].push({
          opponent: whiteId,
          result: blackResult
        });
        
        // Count wins and black wins
        if (blackResult === 1) {
          playerWins[blackId] = (playerWins[blackId] || 0) + 1;
          playerBlackWins[blackId] = (playerBlackWins[blackId] || 0) + 1;
        }
      }
      
      // Update progressive scores
      if (playerScores[whiteId]) {
        const roundScore = match.result === '1-0' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerScores[whiteId].roundScores[match.round - 1] = roundScore;
      }
      
      if (playerScores[blackId]) {
        const roundScore = match.result === '0-1' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerScores[blackId].roundScores[match.round - 1] = roundScore;
      }
    });
    
    // Calculate progressive scores
    Object.keys(playerScores).forEach(playerId => {
      let runningTotal = 0;
      playerScores[playerId].progressiveScore = 0;
      
      playerScores[playerId].roundScores.forEach(score => {
        if (score !== undefined) {
          runningTotal += score;
          playerScores[playerId].progressiveScore += runningTotal;
        }
      });
      
      playerScores[playerId].totalScore = runningTotal;
    });
    
    // Calculate Buchholz and Sonneborn-Berger for each player
    tournament.participants.forEach((participant, index) => {
      if (!participant.player) return;
      
      const playerId = participant.player._id.toString();
      const opponents = playerOpponents[playerId] || [];
      
      // Reset tiebreak values
      participant.buchholz = 0;
      participant.buchholzCut1 = 0;
      participant.sonnebornBerger = 0;
      participant.progressiveScore = playerScores[playerId]?.progressiveScore || 0;
      participant.wins = playerWins[playerId] || 0;
      participant.blackWins = playerBlackWins[playerId] || 0;
      
      // Calculate Buchholz (sum of opponents' scores)
      if (opponents.length > 0) {
        // Get opponent scores
        const opponentScores = opponents.map(opp => {
          const oppIndex = tournament.participants.findIndex(
            p => p.player && p.player._id.toString() === opp.opponent
          );
          return oppIndex !== -1 ? tournament.participants[oppIndex].score : 0;
        });
        
        // Full Buchholz
        participant.buchholz = opponentScores.reduce((sum, score) => sum + score, 0);
        
        // Buchholz Cut 1 (remove lowest opponent score)
        if (opponentScores.length > 1) {
          const minScore = Math.min(...opponentScores);
          participant.buchholzCut1 = participant.buchholz - minScore;
        } else {
          participant.buchholzCut1 = participant.buchholz;
        }
        
        // Sonneborn-Berger (sum of scores of opponents defeated + half scores of opponents drawn)
        participant.sonnebornBerger = opponents.reduce((sum, opp) => {
          const oppIndex = tournament.participants.findIndex(
            p => p.player && p.player._id.toString() === opp.opponent
          );
          const oppScore = oppIndex !== -1 ? tournament.participants[oppIndex].score : 0;
          return sum + (oppScore * opp.result);
        }, 0);
      }
      
      console.log(`Player ${playerId} tiebreaks: Buchholz=${participant.buchholz}, BuchholzCut1=${participant.buchholzCut1}, SB=${participant.sonnebornBerger}, PS=${participant.progressiveScore}, Wins=${participant.wins}, BlackWins=${participant.blackWins}`);
    });
    
    console.log('Tiebreak calculation completed');
    return tournament;
    
  } catch (error) {
    console.error('Error calculating tiebreaks:', error);
    throw error;
  }
}

module.exports = {
  calculateTiebreaks
};
