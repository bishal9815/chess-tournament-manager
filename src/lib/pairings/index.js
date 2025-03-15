/**
 * Centralized export file for all tournament pairing systems
 * 
 * This file imports all individual pairing systems and exports them
 * as a unified API for the tournament setup interface to use.
 */

// Import all pairing systems
const { generateSwissPairings, calculateMaxSwissRounds } = require('./swiss');
const { generateDoubleSwissPairings, calculateMaxDoubleSwissRounds } = require('./doubleSwiss');
const { generateKnockoutPairings, calculateMaxKnockoutRounds } = require('./knockout');
const { 
    generateRoundRobinPairings, 
    calculateMaxRoundRobinRounds,
    generateBergerTables
} = require('./roundRobin');

/**
 * Map of tournament types to their pairing generation functions
 */
const pairingGenerators = {
    'swiss': generateSwissPairings,
    'doubleSwiss': generateDoubleSwissPairings,
    'knockout': generateKnockoutPairings,
    'roundRobin': (players, round) => generateRoundRobinPairings(players, round, false),
    'doubleRoundRobin': (players, round) => generateRoundRobinPairings(players, round, true)
};

/**
 * Map of tournament types to their maximum round calculation functions
 */
const maxRoundCalculators = {
    'swiss': calculateMaxSwissRounds,
    'doubleSwiss': calculateMaxDoubleSwissRounds,
    'knockout': calculateMaxKnockoutRounds,
    'roundRobin': (playerCount) => calculateMaxRoundRobinRounds(playerCount, false),
    'doubleRoundRobin': (playerCount) => calculateMaxRoundRobinRounds(playerCount, true)
};

/**
 * Generate pairings for a tournament based on its type
 * @param {String} tournamentType - Type of tournament (swiss, doubleSwiss, knockout, etc.)
 * @param {Array} players - Array of player objects
 * @param {Number} round - Current round number
 * @returns {Object} - Contains pairings array and error object if applicable
 */
function generatePairings(tournamentType, players, round) {
    // Check if the tournament type is supported
    if (!pairingGenerators[tournamentType]) {
        return {
            pairings: [],
            error: {
                message: `Unsupported tournament type: ${tournamentType}`
            }
        };
    }
    
    // Call the appropriate pairing generator
    return pairingGenerators[tournamentType](players, round);
}

/**
 * Calculate maximum rounds for a tournament based on its type
 * @param {String} tournamentType - Type of tournament (swiss, doubleSwiss, knockout, etc.)
 * @param {Number} playerCount - Number of players in the tournament
 * @returns {Number} - Maximum number of rounds
 */
function calculateMaxRounds(tournamentType, playerCount) {
    // Check if the tournament type is supported
    if (!maxRoundCalculators[tournamentType]) {
        return 0;
    }
    
    // Call the appropriate max round calculator
    return maxRoundCalculators[tournamentType](playerCount);
}

/**
 * Get supported tournament types
 * @returns {Array} - Array of supported tournament type strings
 */
function getSupportedTournamentTypes() {
    return Object.keys(pairingGenerators);
}

// Export the public API
module.exports = {
    // Main functions
    generatePairings,
    calculateMaxRounds,
    getSupportedTournamentTypes,
    
    // Individual pairing systems (for direct access if needed)
    generateSwissPairings,
    generateDoubleSwissPairings,
    generateKnockoutPairings,
    generateRoundRobinPairings,
    
    // Max round calculators
    calculateMaxSwissRounds,
    calculateMaxDoubleSwissRounds,
    calculateMaxKnockoutRounds,
    calculateMaxRoundRobinRounds,
    
    // Additional utilities
    generateBergerTables
};
