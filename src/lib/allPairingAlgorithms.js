/**
 * Chess Tournament Pairing Algorithms
 * 
 * This file consolidates all pairing algorithms for chess tournaments:
 * 1. Swiss System - Players with similar scores play each other, no rematches
 * 2. Double Swiss System - Similar to Swiss but allows up to 2 matches between players
 * 3. Round Robin - Each player faces every other player once (or twice in double round robin)
 * 4. Knockout (Single Elimination) - Players are eliminated after losing
 * 5. Scheveningen System - Team-based pairings (each player from Team A plays every player from Team B)
 * 6. Monrad System (Danish System) - Modified Swiss where leaders may face trailing players
 * 7. Random Pairing - Assigns opponents randomly without considering scores or rankings
 * 8. Accelerated Pairing - Modified Swiss designed to speed up formation of top-tier matchups
 */

// Import original pairing algorithms
const { 
  generateSwissPairings,
  generateDoubleSwissPairings,
  generateRoundRobinPairings
} = require('./pairingAlgorithms');

// Import additional pairing algorithms
const {
  generateKnockoutPairings,
  generateScheveningenPairings
} = require('./additionalPairingAlgorithms');

const {
  generateMonradPairings,
  generateRandomPairings
} = require('./additionalPairingAlgorithms2');

const {
  generateAcceleratedPairings
} = require('./additionalPairingAlgorithms3');

// Export all algorithms together
module.exports = {
  generateSwissPairings,
  generateDoubleSwissPairings,
  generateRoundRobinPairings,
  generateKnockoutPairings,
  generateScheveningenPairings,
  generateMonradPairings,
  generateRandomPairings,
  generateAcceleratedPairings
};
