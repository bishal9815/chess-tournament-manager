/**
 * Google Sheets Service
 * 
 * This service provides functionality for interacting with Google Sheets.
 * It includes methods for creating new sheets, retrieving player data,
 * storing OAuth tokens, and refreshing tokens.
 * 
 
 */

const fs = require('fs');
const path = require('path');

// Mock data storage
const mockStorage = {
  tokens: {},
  spreadsheets: {}
};

/**
 * Generate an authentication URL for Google OAuth
 * @returns {string} The authorization URL
 */
const generateAuthUrl = () => {
  console.log('Mock: Generating Google Auth URL');
  return 'https://accounts.google.com/o/oauth2/auth?mock=true';
};

/**
 * Get tokens from authorization code
 * @param {string} code - The authorization code
 * @returns {Promise<Object>} The tokens
 */
const getTokensFromCode = async (code) => {
  console.log('Mock: Getting tokens from code:', code);
  
  // Generate mock tokens
  const tokens = {
    access_token: 'mock_access_token_' + Date.now(),
    refresh_token: 'mock_refresh_token_' + Date.now(),
    expiry_date: Date.now() + 3600000 // 1 hour from now
  };
  
  return tokens;
};

/**
 * Create a new Google Sheet for tournament registration
 * @param {Object} tokens - The OAuth tokens
 * @param {Object} tournament - The tournament object
 * @returns {Promise<Object>} The created spreadsheet details
 */
const createTournamentSheet = async (tokens, tournament) => {
  console.log('Mock: Creating tournament sheet for:', tournament.name);
  
  try {
    // Generate a mock spreadsheet ID
    const spreadsheetId = 'mock_spreadsheet_' + Date.now();
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    
    // Store mock data
    mockStorage.spreadsheets[spreadsheetId] = {
      title: `${tournament.name} - Registration Form`,
      sheets: [
        {
          title: 'Player Registration',
          data: []
        },
        {
          title: 'Tournament Info',
          data: [
            ['Tournament Name:', tournament.name],
            ['Location:', tournament.location],
            ['Start Date:', new Date(tournament.startDate).toLocaleDateString()],
            ['End Date:', new Date(tournament.endDate).toLocaleDateString()],
            ['Rounds:', tournament.rounds],
            ['Registration Deadline:', tournament.registrationDeadline ? new Date(tournament.registrationDeadline).toLocaleDateString() : 'Not specified'],
            ['Entry Fee:', tournament.entryFee ? `$${tournament.entryFee}` : 'Free'],
            ['Description:', tournament.description || 'No description provided']
          ]
        }
      ]
    };
    
    // Create a mock data file for this spreadsheet
    try {
      const dataDir = path.join(__dirname, '../../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const mockDataFile = path.join(dataDir, `${spreadsheetId}.json`);
      fs.writeFileSync(mockDataFile, JSON.stringify(mockStorage.spreadsheets[spreadsheetId], null, 2));
      console.log('Mock: Created data file at:', mockDataFile);
    } catch (error) {
      console.error('Error creating mock data file:', error);
      // Continue even if we can't create the data file
    }
    
    return {
      spreadsheetId,
      spreadsheetUrl
    };
  } catch (error) {
    console.error('Error in createTournamentSheet:', error);
    throw new Error('Failed to create tournament sheet: ' + error.message);
  }
};

/**
 * Get player data from a tournament spreadsheet
 * @param {Object} tokens - The OAuth tokens
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @returns {Promise<Array<Object>>} The player data
 */
const getPlayerDataFromSheet = async (tokens, spreadsheetId) => {
  console.log('Mock: Getting player data from sheet:', spreadsheetId);
  
  // Check if we have mock data for this spreadsheet
  let mockData = [];
  try {
    const mockDataFile = path.join(__dirname, '../../../data', `${spreadsheetId}.json`);
    if (fs.existsSync(mockDataFile)) {
      const spreadsheetData = JSON.parse(fs.readFileSync(mockDataFile, 'utf8'));
      
      // Get the player registration sheet
      const playerSheet = spreadsheetData.sheets.find(sheet => sheet.title === 'Player Registration');
      if (playerSheet && playerSheet.data) {
        mockData = playerSheet.data;
      }
    }
  } catch (error) {
    console.error('Error reading mock data file:', error);
  }
  
  // If no mock data exists, generate some sample players
  if (mockData.length === 0) {
    mockData = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        chessRating: 1500,
        chesscomUsername: 'johndoe',
        phone: '555-123-4567',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        registrationDate: new Date().toISOString()
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        chessRating: 1650,
        chesscomUsername: 'janesmith',
        phone: '555-987-6543',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        registrationDate: new Date().toISOString()
      },
      {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@example.com',
        chessRating: 1200,
        chesscomUsername: 'bobjohnson',
        phone: '555-555-5555',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        registrationDate: new Date().toISOString()
      }
    ];
    
    // Save the mock data
    try {
      const mockDataFile = path.join(__dirname, '../../../data', `${spreadsheetId}.json`);
      const spreadsheetData = JSON.parse(fs.readFileSync(mockDataFile, 'utf8'));
      
      // Update the player registration sheet
      const playerSheet = spreadsheetData.sheets.find(sheet => sheet.title === 'Player Registration');
      if (playerSheet) {
        playerSheet.data = mockData;
      }
      
      fs.writeFileSync(mockDataFile, JSON.stringify(spreadsheetData, null, 2));
    } catch (error) {
      console.error('Error updating mock data file:', error);
    }
  }
  
  return mockData;
};

/**
 * Store Google OAuth tokens for a user
 * @param {string} userId - The user ID
 * @param {Object} tokens - The OAuth tokens
 * @returns {Promise<void>}
 */
const storeTokensForUser = async (userId, tokens) => {
  console.log('Mock: Storing tokens for user:', userId);
  mockStorage.tokens[userId] = tokens;
  
  // Also store in the User model if available
  try {
    const User = require('../../models/User');
    await User.findByIdAndUpdate(userId, {
      googleTokens: tokens
    });
  } catch (error) {
    console.error('Error storing tokens in User model:', error);
  }
};

/**
 * Get Google OAuth tokens for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} The OAuth tokens
 */
const getTokensForUser = async (userId) => {
  console.log('Mock: Getting tokens for user:', userId);
  
  // Check if we have tokens in mock storage
  if (mockStorage.tokens[userId]) {
    return mockStorage.tokens[userId];
  }
  
  // For mock implementation, always generate tokens
  // Skip trying to get from User model
  /*
  // Try to get from User model
  try {
    const User = require('../../models/User');
    const user = await User.findById(userId);
    
    if (user && user.googleTokens) {
      return user.googleTokens;
    }
  } catch (error) {
    console.error('Error getting tokens from User model:', error);
  }
  */
  
  // Generate mock tokens
  const mockTokens = {
    access_token: 'mock_access_token_' + Date.now(),
    refresh_token: 'mock_refresh_token_' + Date.now(),
    expiry_date: Date.now() + 3600000 // 1 hour from now
  };
  
  // Store the mock tokens
  mockStorage.tokens[userId] = mockTokens;
  
  return mockTokens;
};

/**
 * Refresh Google OAuth tokens if they're expired
 * @param {Object} tokens - The OAuth tokens
 * @returns {Promise<Object>} The refreshed tokens
 */
const refreshTokensIfNeeded = async (tokens) => {
  console.log('Mock: Refreshing tokens if needed');
  
  // Check if tokens are expired
  if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
    console.log('Mock: Tokens expired, refreshing');
    
    // Generate new mock tokens
    return {
      access_token: 'mock_refreshed_token_' + Date.now(),
      refresh_token: tokens.refresh_token,
      expiry_date: Date.now() + 3600000 // 1 hour from now
    };
  }
  
  return tokens;
};

module.exports = {
  generateAuthUrl,
  getTokensFromCode,
  createTournamentSheet,
  getPlayerDataFromSheet,
  storeTokensForUser,
  getTokensForUser,
  refreshTokensIfNeeded
}; 