/**
 * Player Registration JavaScript
 * 
 * This file handles the functionality for player registration, including:
 * - Manual player entry
 * - File upload for player lists
 * - Player record uploads
 * - Chess.com integration
 */

document.addEventListener('DOMContentLoaded', function() {
  // Get tournament ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tournamentId = urlParams.get('id');
  
  // If tournament ID is present, fetch tournament details
  if (tournamentId) {
    fetchTournamentDetails(tournamentId);
    fetchRegisteredPlayers(tournamentId);
  } else {
    // Show error if no tournament ID
    showError('No tournament ID provided. Please select a tournament first.');
  }
  
  // Tab switching
  const manualTab = document.getElementById('manual-tab');
  const fileTab = document.getElementById('file-tab');
  const manualEntry = document.getElementById('manual-entry');
  const fileUpload = document.getElementById('file-upload');
  
  manualTab.addEventListener('click', function() {
    manualTab.classList.add('active');
    fileTab.classList.remove('active');
    manualEntry.style.display = 'block';
    fileUpload.style.display = 'none';
  });
  
  fileTab.addEventListener('click', function() {
    fileTab.classList.add('active');
    manualTab.classList.remove('active');
    fileUpload.style.display = 'block';
    manualEntry.style.display = 'none';
  });
  
  // Add player row
  const addPlayerBtn = document.getElementById('add-player-btn');
  const playerRows = document.getElementById('player-rows');
  
  addPlayerBtn.addEventListener('click', function() {
    addNewPlayerRow();
  });
  
  // Form submission for manual entry
  const manualForm = document.getElementById('manual-form');
  manualForm.addEventListener('submit', function(e) {
    e.preventDefault();
    submitManualPlayers(tournamentId);
  });
  
  // Form submission for file upload
  const fileForm = document.getElementById('file-form');
  fileForm.addEventListener('submit', function(e) {
    e.preventDefault();
    submitFileUpload(tournamentId);
  });
  
  // Chess.com lookup
  const lookupChesscomBtn = document.getElementById('lookup-chesscom-btn');
  lookupChesscomBtn.addEventListener('click', function() {
    lookupChesscomData();
  });
  
  // Initialize event listeners for remove buttons
  initializeRemoveButtons();
});

/**
 * Add a new player row to the manual entry form
 */
function addNewPlayerRow() {
  const playerRows = document.getElementById('player-rows');
  const newRow = document.createElement('tr');
  
  newRow.innerHTML = `
    <td>
      <input type="text" class="form-control player-name" name="player-name[]" placeholder="Enter player name" required>
    </td>
    <td>
      <input type="email" class="form-control player-email" name="player-email[]" placeholder="Enter email (optional)">
    </td>
    <td>
      <input type="number" class="form-control player-rating" name="player-rating[]" placeholder="Enter rating (optional)" min="0" max="3000">
    </td>
    <td>
      <input type="text" class="form-control player-chesscom" name="player-chesscom[]" placeholder="Chess.com username">
    </td>
    <td>
      <button type="button" class="btn btn-sm btn-danger remove-player-btn">
        <i class="bi bi-trash"></i> Remove
      </button>
    </td>
  `;
  
  playerRows.appendChild(newRow);
  initializeRemoveButtons();
}

/**
 * Initialize event listeners for remove buttons
 */
function initializeRemoveButtons() {
  const removeButtons = document.querySelectorAll('.remove-player-btn');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      this.closest('tr').remove();
    });
  });
}

/**
 * Fetch tournament details by ID
 * @param {string} tournamentId - The tournament ID
 */
function fetchTournamentDetails(tournamentId) {
  fetch(`/api/tournaments/${tournamentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch tournament details');
    }
    return response.json();
  })
  .then(data => {
    if (data.success && data.data) {
      // Update tournament name in the UI
      document.getElementById('tournament-name').textContent = data.data.name;
      document.title = `Player Registration - ${data.data.name}`;
    }
  })
  .catch(error => {
    console.error('Error fetching tournament details:', error);
    showError(`Error: ${error.message}`);
  });
}

/**
 * Fetch registered players for a tournament
 * @param {string} tournamentId - The tournament ID
 */
function fetchRegisteredPlayers(tournamentId) {
  fetch(`/api/tournaments/${tournamentId}/players`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch registered players');
    }
    return response.json();
  })
  .then(data => {
    if (data.success && data.data) {
      // Update the registered players table
      updateRegisteredPlayersTable(data.data);
    }
  })
  .catch(error => {
    console.error('Error fetching registered players:', error);
    showError(`Error: ${error.message}`);
  });
}

/**
 * Update the registered players table with fetched data
 * @param {Array} players - Array of player objects
 */
function updateRegisteredPlayersTable(players) {
  const tableBody = document.getElementById('registered-players');
  tableBody.innerHTML = '';
  
  if (players.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="8" class="text-center">No players registered yet</td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  players.forEach(player => {
    const row = document.createElement('tr');
    
    // Format the record cell based on whether player has records
    let recordCell = '<span class="text-muted">No records</span>';
    if (player.records && player.records.length > 0) {
      recordCell = `<a href="#" class="btn btn-sm btn-outline-info view-records" data-player-id="${player._id}">
        <i class="bi bi-file-earmark"></i> View
      </a>`;
    }
    
    row.innerHTML = `
      <td>${player.name}</td>
      <td>${player.email || '-'}</td>
      <td>${player.rating || '-'}</td>
      <td>${player.chesscomUsername || '-'}</td>
      <td>
        <span class="badge ${player.status === 'confirmed' ? 'bg-success' : 'bg-warning'}">
          ${player.status === 'confirmed' ? 'Confirmed' : 'Pending'}
        </span>
      </td>
      <td>
        <span class="badge ${player.paymentStatus === 'paid' ? 'bg-success' : 'bg-danger'}">
          ${player.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
        </span>
      </td>
      <td>${recordCell}</td>
      <td>
        <button class="btn btn-sm btn-danger remove-registered-player" data-player-id="${player._id}">
          <i class="bi bi-trash"></i> Remove
        </button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Add event listeners for view records buttons
  document.querySelectorAll('.view-records').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const playerId = this.getAttribute('data-player-id');
      viewPlayerRecords(playerId);
    });
  });
  
  // Add event listeners for remove buttons
  document.querySelectorAll('.remove-registered-player').forEach(button => {
    button.addEventListener('click', function() {
      const playerId = this.getAttribute('data-player-id');
      removeRegisteredPlayer(playerId);
    });
  });
}

/**
 * Submit manually entered players
 * @param {string} tournamentId - The tournament ID
 */
function submitManualPlayers(tournamentId) {
  if (!tournamentId) {
    showError('No tournament ID provided. Cannot add players.');
    return;
  }
  
  // Collect player data
  const players = [];
  const playerNameInputs = document.querySelectorAll('.player-name');
  const playerEmailInputs = document.querySelectorAll('.player-email');
  const playerRatingInputs = document.querySelectorAll('.player-rating');
  const playerChesscomInputs = document.querySelectorAll('.player-chesscom');
  
  for (let i = 0; i < playerNameInputs.length; i++) {
    const name = playerNameInputs[i].value.trim();
    if (name) {
      players.push({
        name: name,
        email: playerEmailInputs[i].value.trim(),
        rating: playerRatingInputs[i].value.trim(),
        chesscomUsername: playerChesscomInputs[i].value.trim()
      });
    }
  }
  
  if (players.length === 0) {
    showError('Please enter at least one player name.');
    return;
  }
  
  // Get player record file if any
  const recordFile = document.getElementById('player-record-file').files[0];
  const recordDescription = document.getElementById('record-description').value.trim();
  
  // First, add the players
  showLoading('Adding players...');
  
  fetch(`/api/tournaments/${tournamentId}/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    },
    body: JSON.stringify({ players })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to add players');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // If there's a record file, upload it
      if (recordFile) {
        return uploadPlayerRecords(tournamentId, recordFile, recordDescription, data.data.addedPlayers);
      } else {
        return data;
      }
    } else {
      throw new Error(data.error || 'Failed to add players');
    }
  })
  .then(data => {
    hideLoading();
    showSuccess(`Successfully added ${data.count || 0} players to the tournament.`);
    
    // Reset form
    document.getElementById('manual-form').reset();
    
    // Keep only one row
    const playerRows = document.getElementById('player-rows');
    while (playerRows.children.length > 1) {
      playerRows.removeChild(playerRows.lastChild);
    }
    
    // Refresh the registered players list
    fetchRegisteredPlayers(tournamentId);
  })
  .catch(error => {
    hideLoading();
    console.error('Error in submitManualPlayers:', error);
    showError(`Failed to add players: ${error.message}`);
  });
}

/**
 * Submit file upload for player list
 * @param {string} tournamentId - The tournament ID
 */
function submitFileUpload(tournamentId) {
  if (!tournamentId) {
    showError('No tournament ID provided. Cannot add players.');
    return;
  }
  
  const playerFile = document.getElementById('player-file-upload').files[0];
  const recordFile = document.getElementById('bulk-player-record-file').files[0];
  const recordDescription = document.getElementById('bulk-record-description').value.trim();
  
  if (!playerFile) {
    showError('Please select a player list file to upload.');
    return;
  }
  
  // Create FormData object
  const formData = new FormData();
  formData.append('playersFile', playerFile);
  formData.append('tournamentId', tournamentId);
  
  showLoading('Uploading player file...');
  
  fetch(`/api/tournaments/${tournamentId}/players/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    },
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to upload player file');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // If there's a record file, upload it
      if (recordFile) {
        return uploadPlayerRecords(tournamentId, recordFile, recordDescription, data.data.addedPlayers);
      } else {
        return data;
      }
    } else {
      throw new Error(data.error || 'Failed to upload player file');
    }
  })
  .then(data => {
    hideLoading();
    showSuccess(`Successfully uploaded player file and added ${data.count || 0} players to the tournament.`);
    
    // Reset form
    document.getElementById('file-form').reset();
    
    // Refresh the registered players list
    fetchRegisteredPlayers(tournamentId);
  })
  .catch(error => {
    hideLoading();
    console.error('Error in submitFileUpload:', error);
    showError(`Failed to upload player file: ${error.message}`);
  });
}

/**
 * Upload player records
 * @param {string} tournamentId - The tournament ID
 * @param {File} recordFile - The record file to upload
 * @param {string} description - Description of the record
 * @param {Array} playerIds - Array of player IDs to associate with the record
 * @returns {Promise} - Promise that resolves with the response data
 */
function uploadPlayerRecords(tournamentId, recordFile, description, playerIds) {
  const formData = new FormData();
  formData.append('recordFile', recordFile);
  formData.append('description', description);
  formData.append('tournamentId', tournamentId);
  
  if (playerIds && playerIds.length > 0) {
    formData.append('playerIds', JSON.stringify(playerIds));
  }
  
  return fetch(`/api/tournaments/${tournamentId}/player-records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    },
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to upload player records');
    }
    return response.json();
  });
}

/**
 * Lookup Chess.com data for players
 */
function lookupChesscomData() {
  // Collect Chess.com usernames
  const usernames = [];
  const chesscomInputs = document.querySelectorAll('.player-chesscom');
  
  chesscomInputs.forEach(input => {
    const username = input.value.trim();
    if (username) {
      usernames.push(username);
    }
  });
  
  if (usernames.length === 0) {
    showError('Please enter at least one Chess.com username.');
    return;
  }
  
  showLoading('Looking up Chess.com data...');
  
  fetch('/api/players/chesscom-lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    },
    body: JSON.stringify({ usernames })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch Chess.com data');
    }
    return response.json();
  })
  .then(data => {
    hideLoading();
    
    if (!data.success || data.data.length === 0) {
      showError('No valid Chess.com profiles found');
      return;
    }
    
    // Create a map for quick lookup
    const chesscomDataMap = new Map();
    data.data.forEach(profile => {
      chesscomDataMap.set(profile.username.toLowerCase(), profile);
    });
    
    // Update player inputs with Chess.com data
    const playerNameInputs = document.querySelectorAll('.player-name');
    const playerRatingInputs = document.querySelectorAll('.player-rating');
    const playerChesscomInputs = document.querySelectorAll('.player-chesscom');
    
    for (let i = 0; i < playerChesscomInputs.length; i++) {
      const username = playerChesscomInputs[i].value.trim().toLowerCase();
      if (!username) continue;
      
      const chesscomInfo = chesscomDataMap.get(username);
      if (!chesscomInfo) continue;
      
      // Use Chess.com name if player name is empty
      if (!playerNameInputs[i].value.trim()) {
        playerNameInputs[i].value = chesscomInfo.name || username;
      }
      
      // Use Chess.com rating if player rating is empty
      if (!playerRatingInputs[i].value.trim() && chesscomInfo.rating) {
        playerRatingInputs[i].value = chesscomInfo.rating;
      }
    }
    
    showSuccess(`Successfully retrieved data for ${data.data.length} Chess.com profiles`);
  })
  .catch(error => {
    hideLoading();
    console.error('Error in lookupChesscomData:', error);
    showError(`Failed to fetch Chess.com data: ${error.message}`);
  });
}

/**
 * View player records
 * @param {string} playerId - The player ID
 */
function viewPlayerRecords(playerId) {
  // This would typically open a modal with the player's records
  alert(`Viewing records for player ID: ${playerId}`);
}

/**
 * Remove a registered player
 * @param {string} playerId - The player ID
 */
function removeRegisteredPlayer(playerId) {
  if (!confirm('Are you sure you want to remove this player?')) {
    return;
  }
  
  const tournamentId = new URLSearchParams(window.location.search).get('id');
  if (!tournamentId) {
    showError('No tournament ID provided. Cannot remove player.');
    return;
  }
  
  showLoading('Removing player...');
  
  fetch(`/api/tournaments/${tournamentId}/players/${playerId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to remove player');
    }
    return response.json();
  })
  .then(data => {
    hideLoading();
    if (data.success) {
      showSuccess('Player removed successfully');
      // Refresh the registered players list
      fetchRegisteredPlayers(tournamentId);
    } else {
      throw new Error(data.error || 'Failed to remove player');
    }
  })
  .catch(error => {
    hideLoading();
    console.error('Error in removeRegisteredPlayer:', error);
    showError(`Failed to remove player: ${error.message}`);
  });
}

/**
 * Show loading message
 * @param {string} message - The loading message
 */
function showLoading(message = 'Loading...') {
  // Create loading element if it doesn't exist
  let loadingEl = document.getElementById('loading-indicator');
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'loading-indicator';
    loadingEl.className = 'loading-indicator';
    loadingEl.innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <div class="loading-message"></div>
    `;
    document.body.appendChild(loadingEl);
  }
  
  // Update message and show
  loadingEl.querySelector('.loading-message').textContent = message;
  loadingEl.style.display = 'flex';
}

/**
 * Hide loading message
 */
function hideLoading() {
  const loadingEl = document.getElementById('loading-indicator');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
}

/**
 * Show success message
 * @param {string} message - The success message
 */
function showSuccess(message) {
  // Create alert container if it doesn't exist
  let alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    alertContainer.className = 'alert-container';
    document.body.appendChild(alertContainer);
  }
  
  // Create alert element
  const alertEl = document.createElement('div');
  alertEl.className = 'alert alert-success alert-dismissible fade show';
  alertEl.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Add to container
  alertContainer.appendChild(alertEl);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertEl.classList.remove('show');
    setTimeout(() => {
      alertContainer.removeChild(alertEl);
    }, 150);
  }, 5000);
}

/**
 * Show error message
 * @param {string} message - The error message
 */
function showError(message) {
  // Create alert container if it doesn't exist
  let alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    alertContainer.className = 'alert-container';
    document.body.appendChild(alertContainer);
  }
  
  // Create alert element
  const alertEl = document.createElement('div');
  alertEl.className = 'alert alert-danger alert-dismissible fade show';
  alertEl.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Add to container
  alertContainer.appendChild(alertEl);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertEl.classList.remove('show');
    setTimeout(() => {
      alertContainer.removeChild(alertEl);
    }, 150);
  }, 5000);
} 