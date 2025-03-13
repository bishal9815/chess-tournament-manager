/**
 * Tournament Setup Service
 * 
 * Provides frontend integration with the backend player data processing system
 * for quick and easy tournament setup.
 */

/**
 * Create a new tournament
 * @param {Object} tournamentData - Tournament configuration data
 * @returns {Promise<Object>} - Created tournament data
 */
async function createTournament(tournamentData) {
  try {
    const response = await fetch('/api/tournaments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(tournamentData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create tournament');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error creating tournament:', error);
    throw error;
  }
}

/**
 * Process and validate player data without storing
 * @param {Array<Object>} players - Array of player objects
 * @returns {Promise<Object>} - Processing results
 */
async function validatePlayers(players) {
  try {
    const response = await fetch('/api/players/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ players })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to validate players');
    }
    
    return data;
  } catch (error) {
    console.error('Error validating players:', error);
    throw error;
  }
}

/**
 * Upload and process player data from a file
 * @param {File} file - File object containing player data
 * @returns {Promise<Object>} - Processing results
 */
async function uploadPlayerFile(file) {
  try {
    const formData = new FormData();
    formData.append('playersFile', file);
    
    const response = await fetch('/api/players/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload player file');
    }
    
    return data;
  } catch (error) {
    console.error('Error uploading player file:', error);
    throw error;
  }
}

/**
 * Add players to a tournament
 * @param {string} tournamentId - Tournament ID
 * @param {Array<Object>} players - Array of player objects
 * @returns {Promise<Object>} - Result of adding players
 */
async function addPlayersToTournament(tournamentId, players) {
  try {
    const response = await fetch(`/api/tournaments/${tournamentId}/players`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ players })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add players to tournament');
    }
    
    return data;
  } catch (error) {
    console.error('Error adding players to tournament:', error);
    throw error;
  }
}

/**
 * Upload player file and add to tournament
 * @param {string} tournamentId - Tournament ID
 * @param {File} file - File object containing player data
 * @returns {Promise<Object>} - Result of adding players
 */
async function uploadPlayersToTournament(tournamentId, file) {
  try {
    const formData = new FormData();
    formData.append('playersFile', file);
    
    const response = await fetch(`/api/tournaments/${tournamentId}/players/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload players to tournament');
    }
    
    return data;
  } catch (error) {
    console.error('Error uploading players to tournament:', error);
    throw error;
  }
}

/**
 * Lookup player information from Chess.com
 * @param {Array<string>} usernames - Array of Chess.com usernames
 * @returns {Promise<Object>} - Chess.com player data
 */
async function lookupChesscomPlayers(usernames) {
  try {
    const response = await fetch('/api/players/chesscom-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ usernames })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to lookup Chess.com players');
    }
    
    return data;
  } catch (error) {
    console.error('Error looking up Chess.com players:', error);
    throw error;
  }
}

/**
 * Search for existing players in the database
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results
 */
async function searchPlayers(query) {
  try {
    const response = await fetch(`/api/players/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to search players');
    }
    
    return data;
  } catch (error) {
    console.error('Error searching players:', error);
    throw error;
  }
}

/**
 * Get tournament details including participants
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Object>} - Tournament details
 */
async function getTournamentDetails(tournamentId) {
  try {
    const response = await fetch(`/api/tournaments/${tournamentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get tournament details');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error getting tournament details:', error);
    throw error;
  }
}

/**
 * Complete tournament setup in one step
 * @param {Object} tournamentData - Tournament configuration
 * @param {Array<Object>} manualPlayers - Manually entered players
 * @param {File} playerFile - File containing player data
 * @returns {Promise<Object>} - Setup results
 */
async function quickTournamentSetup(tournamentData, manualPlayers = [], playerFile = null) {
  try {
    // Step 1: Create the tournament
    const tournament = await createTournament(tournamentData);
    
    // Step 2: Add players from different sources
    const results = {
      tournament,
      manualPlayersAdded: 0,
      filePlayersAdded: 0,
      invalidPlayers: [],
      duplicates: []
    };
    
    // Add manual players if provided
    if (manualPlayers && manualPlayers.length > 0) {
      const manualResult = await addPlayersToTournament(tournament._id, manualPlayers);
      results.manualPlayersAdded = manualResult.count;
      results.invalidPlayers = [...results.invalidPlayers, ...(manualResult.data.invalidPlayers || [])];
      results.duplicates = [...results.duplicates, ...(manualResult.data.duplicates || [])];
    }
    
    // Upload player file if provided
    if (playerFile) {
      const fileResult = await uploadPlayersToTournament(tournament._id, playerFile);
      results.filePlayersAdded = fileResult.count;
      results.invalidPlayers = [...results.invalidPlayers, ...(fileResult.data.invalidPlayers || [])];
      results.duplicates = [...results.duplicates, ...(fileResult.data.duplicates || [])];
    }
    
    // Step 3: Get the updated tournament details
    const updatedTournament = await getTournamentDetails(tournament._id);
    results.tournament = updatedTournament.tournament;
    
    return results;
  } catch (error) {
    console.error('Error setting up tournament:', error);
    throw error;
  }
}

module.exports = {
  createTournament,
  validatePlayers,
  uploadPlayerFile,
  addPlayersToTournament,
  uploadPlayersToTournament,
  lookupChesscomPlayers,
  searchPlayers,
  getTournamentDetails,
  quickTournamentSetup
}; 