/**
 * Google Docs Service
 * 
 * This service handles integration with Google Docs API for tournament data management.
 * It includes both real API implementation and a mock implementation for development.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Tournament = require('../../models/Tournament');
const Player = require('../../models/Player');

// Set up Google API
let googleApi = null;
let oauth2Client = null;
let useRealApi = false;

try {
  const { google } = require('googleapis');
  const { OAuth2Client } = require('google-auth-library');
  googleApi = google;
  oauth2Client = OAuth2Client;
  useRealApi = true;
  console.log('Using real Google API');
} catch (error) {
  console.log('Google API not available, using mock implementation');
  // Mock implementation will be used
}

// Mock data storage (used when real API is not available)
const mockStorage = {
  tokens: {},
  documents: {}
};

// OAuth2 client setup (only if real API is available)
if (useRealApi) {
  try {
    const { OAuth2 } = googleApi.auth;
    oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    console.log('OAuth2 client initialized successfully');
  } catch (error) {
    console.error('Error setting up OAuth2 client:', error);
    useRealApi = false;
    console.log('Falling back to mock implementation due to OAuth2 initialization error');
  }
}

/**
 * Generate an authentication URL for Google OAuth
 * @returns {string} The authorization URL
 */
const generateAuthUrl = () => {
  if (useRealApi) {
    try {
      console.log('Generating Google Auth URL with real API');
      return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/forms'
        ],
        prompt: 'consent'
      });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      console.log('Falling back to mock auth URL');
      return 'https://accounts.google.com/o/oauth2/auth?mock=true';
    }
  } else {
    console.log('Mock: Generating Google Auth URL');
    return 'https://accounts.google.com/o/oauth2/auth?mock=true';
  }
};

/**
 * Get tokens from authorization code
 * @param {string} code - The authorization code
 * @returns {Promise<Object>} The tokens
 */
const getTokensFromCode = async (code) => {
  if (useRealApi) {
    try {
      console.log('Getting tokens from code...');
      const { tokens } = await oauth2Client.getToken(code);
      console.log('Successfully obtained tokens from code');
      return tokens;
    } catch (error) {
      console.error('Error getting tokens from code:', error);
      // If we can't get real tokens, fall back to mock implementation
      console.log('Falling back to mock tokens due to error');
      
      // Generate mock tokens
      const mockTokens = {
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: 'mock_refresh_token_' + Date.now(),
        expiry_date: Date.now() + 3600000 // 1 hour from now
      };
      
      return mockTokens;
    }
  } else {
    console.log('Mock: Getting tokens from code:', code);
    
    // Generate mock tokens
    const tokens = {
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      expiry_date: Date.now() + 3600000 // 1 hour from now
    };
    
    return tokens;
  }
};

/**
 * Create a new Google Doc for tournament registration
 * @param {Object} tokens - The OAuth tokens
 * @param {Object} tournament - The tournament object
 * @returns {Promise<Object>} The created document details
 */
const createTournamentDoc = async (tokens, tournament) => {
  if (useRealApi) {
    try {
      // Set credentials
      oauth2Client.setCredentials(tokens);
      
      // Initialize Google Docs and Drive APIs
      const { google } = require('googleapis');
      const docs = google.docs({ version: 'v1', auth: oauth2Client });
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Create a new document
      const docResponse = await docs.documents.create({
        requestBody: {
          title: `${tournament.name} - Registration Form`
        }
      });
      
      const documentId = docResponse.data.documentId;
      const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
      
      // Add tournament information to the document
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: 1
                },
                text: `Tournament: ${tournament.name}\n` +
                      `Location: ${tournament.location}\n` +
                      `Start Date: ${new Date(tournament.startDate).toLocaleDateString()}\n` +
                      `End Date: ${new Date(tournament.endDate).toLocaleDateString()}\n` +
                      `Rounds: ${tournament.rounds}\n` +
                      `Registration Deadline: ${tournament.registrationDeadline ? new Date(tournament.registrationDeadline).toLocaleDateString() : 'Not specified'}\n` +
                      `Entry Fee: ${tournament.entryFee ? `$${tournament.entryFee}` : 'Free'}\n` +
                      `Description: ${tournament.description || 'No description provided'}\n\n` +
                      `PLAYER REGISTRATION\n\n` +
                      `Instructions: Please add player information below in the following format:\n` +
                      `First Name, Last Name, Email, Chess Rating, Username, Phone, City, State, Country\n\n`
              }
            }
          ]
        }
      });
      
      // Make the document public
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'writer',
          type: 'anyone'
        }
      });
      
      return {
        documentId,
        documentUrl
      };
    } catch (error) {
      console.error('Error in createTournamentDoc:', error);
      throw new Error('Failed to create tournament document: ' + error.message);
    }
  } else {
    console.log('Mock: Creating tournament doc for:', tournament.name);
    
    try {
      // Generate a mock document ID
      const documentId = 'mock_document_' + Date.now();
      const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
      
      // Store mock data
      mockStorage.documents[documentId] = {
        title: `${tournament.name} - Registration Form`,
        content: `Tournament: ${tournament.name}\n` +
                 `Location: ${tournament.location}\n` +
                 `Start Date: ${new Date(tournament.startDate).toLocaleDateString()}\n` +
                 `End Date: ${new Date(tournament.endDate).toLocaleDateString()}\n` +
                 `Rounds: ${tournament.rounds}\n` +
                 `Registration Deadline: ${tournament.registrationDeadline ? new Date(tournament.registrationDeadline).toLocaleDateString() : 'Not specified'}\n` +
                 `Entry Fee: ${tournament.entryFee ? `$${tournament.entryFee}` : 'Free'}\n` +
                 `Description: ${tournament.description || 'No description provided'}\n\n` +
                 `PLAYER REGISTRATION\n\n` +
                 `Instructions: Please add player information below in the following format:\n` +
                 `First Name, Last Name, Email, Chess Rating, Username, Phone, City, State, Country\n\n`,
        players: []
      };
      
      // Create a mock data file for this document
      try {
        const dataDir = path.join(__dirname, '../../../data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const mockDataFile = path.join(dataDir, `${documentId}.json`);
        fs.writeFileSync(mockDataFile, JSON.stringify(mockStorage.documents[documentId], null, 2));
        console.log('Mock: Created data file at:', mockDataFile);
      } catch (error) {
        console.error('Error creating mock data file:', error);
        // Continue even if we can't create the data file
      }
      
      return {
        documentId,
        documentUrl
      };
    } catch (error) {
      console.error('Error in createTournamentDoc:', error);
      throw new Error('Failed to create tournament document: ' + error.message);
    }
  }
};

/**
 * Get player data from a tournament document
 * @param {Object} tokens - The OAuth tokens
 * @param {string} documentId - The ID of the document
 * @param {Array<string>} processedData - Array of already processed data hashes
 * @returns {Promise<Object>} Object containing player data and newly processed data hashes
 */
const getPlayerDataFromDoc = async (tokens, documentId, processedData = []) => {
  if (useRealApi) {
    try {
      console.log('Getting player data from Google Doc:', documentId);
      console.log('Already processed data entries:', processedData.length);
      
      // Set credentials
      oauth2Client.setCredentials(tokens);
      
      // Initialize Google Docs API
      const { google } = require('googleapis');
      const docs = google.docs({ version: 'v1', auth: oauth2Client });
      
      console.log('Google Docs API initialized');
      
      // Get the document content
      console.log('Fetching document content...');
      const response = await docs.documents.get({
        documentId
      });
      
      console.log('Document fetched successfully');
      const document = response.data;
      const content = document.body.content;
      
      // Extract text content
      let fullText = '';
      content.forEach(item => {
        if (item.paragraph) {
          item.paragraph.elements.forEach(element => {
            if (element.textRun) {
              fullText += element.textRun.content;
            }
          });
        }
      });
      
      console.log('Extracted text content from document');
      console.log('Document text length:', fullText.length);
      
      // Log the full document text for debugging
      console.log('Full document text:');
      console.log(fullText);
      
      // Try different extraction methods
      let players = [];
      
      // First try to extract from a PLAYER REGISTRATION section
      console.log('Attempting to extract players from PLAYER REGISTRATION section...');
      players = extractPlayersFromRegistrationSection(fullText);
      
      // If that didn't work, try to extract from a table
      if (players.length === 0) {
        console.log('No players found in PLAYER REGISTRATION section, trying table extraction...');
        const tableData = extractTableData(document);
        if (tableData && tableData.length > 0) {
          console.log(`Found ${tableData.length} rows of table data`);
          players = extractPlayersFromTableData(tableData);
        } else {
          console.log('No table data found in the document');
        }
      }
      
      // If still no players, try to extract from the document text directly
      if (players.length === 0) {
        console.log('No players found in tables, trying to extract from document text directly...');
        players = extractPlayersFromText(fullText);
      }
      
      // Log the results
      if (players.length === 0) {
        console.error('No players found in the document');
        return { 
          error: `No players found in the document. Please ensure the document contains player information in one of the supported formats:
          
1. A section titled "PLAYER REGISTRATION" followed by player names (one per line)
2. A table with player information (with columns for name, email, etc.)
3. A list of player names in the document text

Remember that only first name and last name are required. Other fields like email and chess rating are optional.

Example formats:
- John Smith
- Jane Doe, jane@example.com, 1500
- First Name: John, Last Name: Smith
          `
        };
      }
      
      console.log(`Successfully extracted ${players.length} players from the document`);
      
      // Validate the players
      const validPlayers = players.filter(player => {
        // A player is valid if they have at least a first name or last name
        return player && (player.firstName || player.lastName);
      });
      
      if (validPlayers.length === 0) {
        console.error('No valid players found in the document');
          return {
          error: 'No valid players found in the document. Please ensure each player has at least a first name or last name.' 
        };
      }
      
      if (validPlayers.length < players.length) {
        console.warn(`Filtered out ${players.length - validPlayers.length} invalid players`);
      }
      
      console.log(`Returning ${validPlayers.length} valid players`);
      return { 
        players: validPlayers, 
        newDataHashes: []
      };
    } catch (error) {
      console.error('Error getting player data from document:', error);
      throw new Error('Failed to get player data from document: ' + error.message);
    }
  } else {
    console.log('Mock: Getting player data from document:', documentId);
    
    // Return mock player data
    const mockPlayers = [
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          chessRating: 1500,
        chesscomUsername: 'johndoe'
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          chessRating: 1650,
        chesscomUsername: 'janesmith'
      }
    ];
    
    // Generate hashes for mock players
    const mockHashes = mockPlayers.map(player => createPlayerHash(player));
    
    // Filter out already processed players
    const newPlayers = mockPlayers.filter((player, index) => 
      !processedData.includes(mockHashes[index])
    );
    
    const newHashes = mockHashes.filter(hash => 
      !processedData.includes(hash)
    );
    
    return { 
      players: newPlayers, 
      newDataHashes: newHashes
    };
  }
};

/**
 * Create a hash of player data for tracking processed entries
 * @param {Object} player - The player data
 * @returns {string} A hash of the player data
 */
function createPlayerHash(player) {
  // Create a string representation of the player data
  const playerString = `${player.firstName || ''}|${player.lastName || ''}|${player.email || ''}|${player.chessRating || ''}|${player.chesscomUsername || ''}`.toLowerCase();
  
  // Create an MD5 hash
  return crypto.createHash('md5').update(playerString).digest('hex');
}

/**
 * Extract players from a PLAYER REGISTRATION section
 * @param {string} text - The document text
 * @returns {Array<Object>} The extracted player data
 */
function extractPlayersFromRegistrationSection(text) {
  try {
    // Find the player registration section
    const playerSectionIndex = text.indexOf('PLAYER REGISTRATION');
    if (playerSectionIndex === -1) {
      console.log('No PLAYER REGISTRATION section found');
      return [];
    }
    
    console.log('Found PLAYER REGISTRATION section at index', playerSectionIndex);
    
    // Try different formats for the player data
    const formats = [
      'First Name, Last Name, Email, Chess Rating, Username, Phone, City, State, Country',
      'First Name, Last Name, Email, Rating',
      'Name, Email, Rating',
      'First Name, Last Name',
      'Name'
    ];
    
    for (const format of formats) {
      const instructionsEndIndex = text.indexOf(format, playerSectionIndex);
      if (instructionsEndIndex !== -1) {
        console.log(`Found format "${format}" at index ${instructionsEndIndex}`);
        
        const playerDataText = text.substring(instructionsEndIndex + format.length);
        console.log('Player data text length:', playerDataText.length);
        
        // Split by lines and parse each line as a player
        const playerLines = playerDataText.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        console.log(`Found ${playerLines.length} player lines`);
        
        if (playerLines.length === 0) {
          continue; // Try next format
        }
        
        const players = [];
        
        for (const line of playerLines) {
          try {
            // Skip lines that look like headers or instructions
            if (line.toUpperCase() === line || 
                line.includes('FIRST NAME') || 
                line.includes('LAST NAME') || 
                line.includes('EMAIL') || 
                line.includes('RATING')) {
              continue;
            }
            
            // Split the line by commas
            const parts = line.split(',').map(part => part.trim());
            
            let player = null;
            
            if (format.includes('First Name, Last Name')) {
              if (parts.length >= 1) {
                const firstName = parts[0] || '';
                const lastName = parts.length >= 2 ? parts[1] || '' : '';
                const email = parts.length >= 3 ? parts[2] || '' : '';
                const rating = parts.length >= 4 && parts[3] ? 
                  (parseInt(parts[3]) || parts[3]) : null;
                const username = parts.length >= 5 ? parts[4] || '' : '';
                
                player = {
                  firstName,
                  lastName,
                  email,
                  chessRating: rating,
                  chesscomUsername: username
                };
              }
            } else if (format.includes('Name, Email')) {
              if (parts.length >= 1) {
                // Split name into first and last
                const name = parts[0] || '';
                let firstName = '';
                let lastName = '';
                
                if (name && name.includes(' ')) {
                  const nameParts = name.split(' ');
                  firstName = nameParts[0] || '';
                  lastName = nameParts.slice(1).join(' ') || '';
                } else {
                  firstName = name;
                }
                
                const email = parts.length >= 2 ? parts[1] || '' : '';
                const rating = parts.length >= 3 && parts[2] ? 
                  (parseInt(parts[2]) || parts[2]) : null;
                const username = parts.length >= 4 ? parts[3] || '' : '';
                
                player = {
                  firstName,
                  lastName,
                  email,
                  chessRating: rating,
                  chesscomUsername: username
                };
              }
            } else if (format.includes('Name')) {
              if (parts.length >= 1) {
                // Split name into first and last
                const name = parts[0] || '';
                let firstName = '';
                let lastName = '';
                
                if (name && name.includes(' ')) {
                  const nameParts = name.split(' ');
                  firstName = nameParts[0] || '';
                  lastName = nameParts.slice(1).join(' ') || '';
                } else {
                  firstName = name;
                }
                
                player = {
                  firstName,
                  lastName,
                  email: '',
                  chessRating: null,
                  chesscomUsername: ''
                };
              }
            }
            
            if (player && (player.firstName || player.lastName)) {
              console.log('Created player:', player);
              players.push(player);
            }
          } catch (lineError) {
            console.error('Error processing line:', line, lineError);
            // Continue with next line
          }
        }
        
        console.log(`Extracted ${players.length} players using format "${format}"`);
        return players;
      }
    }
    
    // If no recognized format found, try to extract players from the text after PLAYER REGISTRATION
    console.log('No recognized format found after PLAYER REGISTRATION section, trying to extract players directly');
    
    // Get text after PLAYER REGISTRATION
    const textAfterSection = text.substring(playerSectionIndex + 'PLAYER REGISTRATION'.length);
    
    // Extract players from lines
    const players = [];
    const lines = textAfterSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && 
              !line.toUpperCase().includes('INSTRUCTION') && 
              !line.includes('FORMAT') &&
              !line.toUpperCase().includes('FIRST NAME') &&
              !line.toUpperCase().includes('LAST NAME') &&
              !line.toUpperCase().includes('EMAIL') &&
              !line.toUpperCase().includes('RATING'));
    
    for (const line of lines) {
      try {
        // Split by commas if present
        const parts = line.includes(',') ? line.split(',').map(part => part.trim()) : [line.trim()];
        
        if (parts.length === 0 || !parts[0]) continue;
        
        let firstName = '';
        let lastName = '';
        
        // If multiple parts, assume first part is first name, second part is last name
        if (parts.length >= 2) {
          firstName = parts[0] || '';
          lastName = parts[1] || '';
        } else {
          // If only one part, try to split by space
          const name = parts[0];
          if (name && name.includes(' ')) {
            const nameParts = name.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          } else {
            firstName = name || '';
          }
        }
        
        if (firstName || lastName) {
          const player = {
            firstName,
            lastName,
            email: parts.length >= 3 ? parts[2] || '' : '',
            chessRating: parts.length >= 4 && parts[3] ? (parseInt(parts[3]) || parts[3]) : null,
            chesscomUsername: parts.length >= 5 ? parts[4] || '' : ''
          };
          
          console.log('Created player from line:', player);
          players.push(player);
        }
      } catch (lineError) {
        console.error('Error processing line:', line, lineError);
        // Continue with next line
      }
    }
    
    if (players.length > 0) {
      console.log(`Extracted ${players.length} players directly from text after PLAYER REGISTRATION`);
      return players;
    }
    
    return [];
      } catch (error) {
    console.error('Error in extractPlayersFromRegistrationSection:', error);
    // Return an empty array instead of letting the error propagate
    return [];
  }
}

/**
 * Extract players from table-like data
 * @param {string} text - The document text
 * @returns {Array<Object>} The extracted player data
 */
function extractPlayersFromTableData(text) {
  try {
    // Look for lines that might be table rows (contain commas or tabs)
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.includes(',') || line.includes('\t')));
    
    console.log(`Found ${lines.length} potential table lines`);
    
    if (lines.length < 2) {
      return []; // Need at least a header and one data row
    }
    
    // Try to determine if we have a header row
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('name') || 
                     firstLine.includes('email') || 
                     firstLine.includes('rating');
    
    console.log('Table appears to have a header:', hasHeader);
    
    // Start from index 1 if we have a header, otherwise from 0
    const startIndex = hasHeader ? 1 : 0;
    
    // Process each line as a player
    const players = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines
      if (!line || line.trim() === '') {
        continue;
      }
      
      // Split by comma or tab, whichever is more prevalent
      const parts = line.includes(',') ? 
        line.split(',').map(part => part.trim()) : 
        line.split('\t').map(part => part.trim());
      
      if (parts.length < 1) continue;
      
      // Try to determine which columns contain what data
      let nameIndex = -1;
      let emailIndex = -1;
      let ratingIndex = -1;
      let usernameIndex = -1;
      
      if (hasHeader) {
        // Use header to determine column indices
        const headerParts = lines[0].toLowerCase().split(line.includes(',') ? ',' : '\t')
          .map(part => part.trim());
        
        headerParts.forEach((part, index) => {
          if (!part) return; // Skip empty parts
          
          if (part.includes('first') || (part.includes('name') && !part.includes('last'))) {
            nameIndex = index;
          } else if (part.includes('email')) {
            emailIndex = index;
          } else if (part.includes('rating') || part.includes('elo')) {
            ratingIndex = index;
          } else if (part.includes('username') || part.includes('chess.com')) {
            usernameIndex = index;
          }
        });
      } else {
        // Make educated guesses based on content
        parts.forEach((part, index) => {
          if (!part) return; // Skip empty parts
          
          if (part.includes('@')) {
            emailIndex = index;
          } else if (!isNaN(parseInt(part)) && parseInt(part) > 0 && parseInt(part) < 3000) {
            ratingIndex = index;
          } else if (part.match(/^[a-zA-Z0-9_]+$/)) {
            usernameIndex = index;
          } else if (nameIndex === -1 && part.length > 0) {
            nameIndex = index;
          }
        });
      }
      
      // If we couldn't determine a name column, use the first non-email, non-rating column
      if (nameIndex === -1) {
        for (let j = 0; j < parts.length; j++) {
          if (j !== emailIndex && j !== ratingIndex && j !== usernameIndex && parts[j] && parts[j].trim().length > 0) {
            nameIndex = j;
            break;
          }
        }
      }
      
      // If we still don't have a name column, skip this line
      if (nameIndex === -1 || nameIndex >= parts.length || !parts[nameIndex]) {
        console.log(`Skipping line ${i} - no valid name found`);
        continue;
      }
      
      // Extract name and split into first and last
      const name = parts[nameIndex];
      let firstName = '';
      let lastName = '';
      
      if (name && name.includes(' ')) {
        const nameParts = name.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      } else {
        // If only one word or no spaces, use it as first name
        firstName = name || '';
      }
      
      // Create player object
      const player = {
        firstName,
        lastName,
        email: emailIndex !== -1 && emailIndex < parts.length ? parts[emailIndex] || '' : '',
        chessRating: ratingIndex !== -1 && ratingIndex < parts.length && parts[ratingIndex] ? 
          (parseInt(parts[ratingIndex]) || parts[ratingIndex]) : null,
        chesscomUsername: usernameIndex !== -1 && usernameIndex < parts.length ? 
          parts[usernameIndex] || '' : ''
      };
      
      console.log(`Extracted player from line ${i}:`, player);
      players.push(player);
    }
    
    return players;
  } catch (error) {
    console.error('Error in extractPlayersFromTableData:', error);
    // Return an empty array instead of letting the error propagate
    return [];
  }
}

/**
 * Extract players from plain text
 * @param {string} text - The document text
 * @returns {Array<Object>} The extracted player data
 */
function extractPlayersFromText(text) {
  try {
    console.log('Extracting players from plain text');
    
    // Split the text into lines
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log(`Found ${lines.length} lines of text`);
    
    // Filter out lines that look like headers or instructions
    const potentialPlayerLines = lines.filter(line => {
      // Skip lines that are all uppercase (likely headers)
      if (line.toUpperCase() === line && line.length > 10) {
        return false;
      }
      
      // Skip lines that contain common header terms
      if (line.toUpperCase().includes('INSTRUCTION') || 
          line.toUpperCase().includes('FORMAT') ||
          line.toUpperCase().includes('EXAMPLE') ||
          line.toUpperCase().includes('TEMPLATE')) {
        return false;
      }
      
      // Skip lines that are too short to be a name
      if (line.length < 2) {
        return false;
      }
      
      return true;
    });
    
    console.log(`Found ${potentialPlayerLines.length} potential player lines after filtering`);
    
    // Process each line to extract player data
    const players = [];
    
    for (const line of potentialPlayerLines) {
      try {
        // Try different formats for extracting player data
        
        // Format 1: First Name: John, Last Name: Smith
        if (line.includes('First Name:') || line.includes('Last Name:')) {
          const firstName = extractValue(line, 'First Name:') || '';
          const lastName = extractValue(line, 'Last Name:') || '';
          const email = extractValue(line, 'Email:') || '';
          const rating = extractValue(line, 'Rating:') || extractValue(line, 'Chess Rating:') || null;
          const username = extractValue(line, 'Username:') || extractValue(line, 'Chess.com Username:') || '';
          
          if (firstName || lastName) {
            players.push({
              firstName,
              lastName,
              email,
              chessRating: rating ? (parseInt(rating) || rating) : null,
              chesscomUsername: username
            });
            continue;
          }
        }
        
        // Format 2: Comma-separated values
        if (line.includes(',')) {
          const parts = line.split(',').map(part => part.trim());
          
          if (parts.length >= 1) {
            // If first part contains a space, assume it's a full name
            const firstPart = parts[0];
            let firstName = '';
            let lastName = '';
            
            if (firstPart.includes(' ')) {
              const nameParts = firstPart.split(' ');
              firstName = nameParts[0] || '';
              lastName = nameParts.slice(1).join(' ') || '';
            } else {
              // If only one word, assume it's a first name
              firstName = firstPart;
            }
            
            // If we have more parts, check if the second part might be a last name
            if (parts.length >= 2 && !parts[1].includes('@') && isNaN(parts[1])) {
              // If second part doesn't look like an email or number, it might be a last name
              if (!lastName) {
                lastName = parts[1];
              }
              
              // Look for email in the third part
              const email = parts.length >= 3 ? parts[2] : '';
              // Look for rating in the fourth part
              const rating = parts.length >= 4 ? parts[3] : null;
              // Look for username in the fifth part
              const username = parts.length >= 5 ? parts[4] : '';
              
              players.push({
                firstName,
                lastName,
                email,
                chessRating: rating ? (parseInt(rating) || rating) : null,
                chesscomUsername: username
              });
              continue;
            } else {
              // If second part looks like an email or number, use the original format
              const email = parts.length >= 2 ? parts[1] : '';
              const rating = parts.length >= 3 ? parts[2] : null;
              const username = parts.length >= 4 ? parts[3] : '';
              
              players.push({
                firstName,
                lastName,
                email,
                chessRating: rating ? (parseInt(rating) || rating) : null,
                chesscomUsername: username
              });
              continue;
            }
          }
        }
        
        // Format 3: Just a name (with or without spaces)
        if (line.length > 0) {
          let firstName = '';
          let lastName = '';
          
          if (line.includes(' ')) {
            const nameParts = line.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          } else {
            firstName = line;
          }
          
          if (firstName || lastName) {
            players.push({
              firstName,
              lastName,
              email: '',
              chessRating: null,
              chesscomUsername: ''
            });
          }
        }
      } catch (lineError) {
        console.error('Error processing line:', line, lineError);
        // Continue with next line
      }
    }
    
    console.log(`Extracted ${players.length} players from text`);
    return players;
  } catch (error) {
    console.error('Error in extractPlayersFromText:', error);
    return [];
  }
}

/**
 * Helper function to extract a value from a line using a label
 * @param {string} line - The line of text
 * @param {string} label - The label to look for
 * @returns {string|null} The extracted value or null if not found
 */
function extractValue(line, label) {
  if (!line.includes(label)) {
    return null;
  }
  
  const startIndex = line.indexOf(label) + label.length;
  let endIndex = line.indexOf(',', startIndex);
  
  if (endIndex === -1) {
    endIndex = line.length;
  }
  
  return line.substring(startIndex, endIndex).trim();
}

/**
 * Store Google OAuth tokens for a user
 * @param {string} userId - The user ID
 * @param {Object} tokens - The OAuth tokens
 * @returns {Promise<void>}
 */
const storeTokensForUser = async (userId, tokens) => {
  try {
    const User = require('../../models/User');
    await User.findByIdAndUpdate(userId, {
      googleTokens: tokens
    });
    
    if (!useRealApi) {
      console.log('Mock: Storing tokens for user:', userId);
      mockStorage.tokens[userId] = tokens;
    }
  } catch (error) {
    console.error('Error storing tokens in User model:', error);
    throw new Error('Failed to store tokens for user: ' + error.message);
  }
};

/**
 * Get tokens for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} The tokens
 */
const getTokensForUser = async (userId) => {
  if (useRealApi) {
  try {
      console.log('Getting tokens for user:', userId);
      
      // Get the user from the database
    const User = require('../../models/User');
    const user = await User.findById(userId);
    
      if (!user) {
        console.error('User not found:', userId);
        throw new Error('User not found');
      }
      
      // Check if user has Google tokens
      if (!user.googleTokens || !user.googleTokens.access_token || !user.googleTokens.refresh_token) {
        console.error('User does not have Google tokens:', userId);
        throw new Error('User does not have Google tokens. Please authenticate with Google first.');
      }
      
      // Add userId to tokens for reference
      const tokens = {
        ...user.googleTokens,
        userId
      };
      
      console.log('Got tokens for user:', userId);
      
      return tokens;
  } catch (error) {
    console.error('Error getting tokens for user:', error);
    throw new Error('Failed to get tokens for user: ' + error.message);
    }
  } else {
    console.log('Mock: Getting tokens for user:', userId);
    
    // Return mock tokens
    return {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expiry_date: Date.now() + 3600000, // 1 hour from now
      userId
    };
  }
};

/**
 * Refresh tokens if they are expired
 * @param {Object} tokens - The OAuth tokens
 * @returns {Promise<Object>} The refreshed tokens
 */
const refreshTokensIfNeeded = async (tokens) => {
  if (useRealApi) {
    try {
      // Check if tokens are expired or will expire soon (within 5 minutes)
      const expiryDate = tokens.expiry_date;
      const now = Date.now();
      const expiresInMs = expiryDate - now;
      const fiveMinutesInMs = 5 * 60 * 1000;
      
      if (expiresInMs <= fiveMinutesInMs) {
        console.log(`Tokens expired or will expire soon (${Math.floor(expiresInMs / 1000)} seconds left), refreshing...`);
        
        // Tokens are expired or will expire soon, refresh them
        oauth2Client.setCredentials(tokens);
        
        try {
          // Try to refresh the token
          const { tokens: newTokens } = await oauth2Client.refreshToken(tokens.refresh_token);
          console.log('Tokens refreshed successfully');
          
          // Update the tokens in the database
          try {
            if (tokens.userId) {
              await storeTokensForUser(tokens.userId, {
                ...tokens,
                ...newTokens
              });
              console.log('Updated tokens in database for user:', tokens.userId);
            }
          } catch (dbError) {
            console.error('Error updating tokens in database:', dbError);
            // Continue even if database update fails
          }
          
          return {
            ...tokens,
            ...newTokens
          };
        } catch (refreshError) {
          console.error('Error refreshing tokens:', refreshError);
          
          // Check if the refresh token is invalid or expired
          if (refreshError.message.includes('invalid_grant') || 
              refreshError.message.includes('Token has been expired or revoked')) {
            console.error('Refresh token is invalid or expired');
            throw new Error('Your Google authorization has expired. Please reconnect with Google.');
          }
          
          // If refresh fails for other reasons, fall back to using the existing tokens
          console.log('Using existing tokens despite expiry');
          return tokens;
        }
      }
      
      // Tokens are still valid
      console.log('Tokens are still valid, not refreshing');
      return tokens;
    } catch (error) {
      console.error('Error in refreshTokensIfNeeded:', error);
      
      // If there's a specific error about token expiry, rethrow it
      if (error.message.includes('expired') || error.message.includes('revoked')) {
        throw error;
      }
      
      // For other errors, just return the original tokens
      return tokens;
    }
  } else {
    console.log('Mock: Refreshing tokens if needed');
    
    // Check if tokens are expired
    const expiryDate = tokens.expiry_date;
    const now = Date.now();
    
    if (now >= expiryDate) {
      console.log('Mock: Tokens expired, refreshing...');
      
      // Simulate refreshed tokens
      return {
        ...tokens,
        access_token: 'mock-refreshed-access-token',
        expiry_date: now + 3600 * 1000 // 1 hour from now
      };
    }
    
    // Tokens are still valid
    return tokens;
  }
};

/**
 * Get user information from Google tokens
 * @param {Object} tokens - The OAuth tokens
 * @returns {Promise<Object>} User information
 */
const getUserInfo = async (tokens) => {
  if (useRealApi) {
    try {
      // Set credentials
      oauth2Client.setCredentials(tokens);
      
      // Use OAuth2 API to get user info
      const oauth2 = googleApi.oauth2({
        auth: oauth2Client,
        version: 'v2'
      });
      
      // Get user profile
      const response = await oauth2.userinfo.get();
      
      // Extract user info
      const userInfo = {
        name: response.data.name || '',
        email: response.data.email || '',
      };
      
      return userInfo;
    } catch (error) {
      console.error('Error getting user info from Google:', error);
      return { name: '', email: '' };
    }
  } else {
    // Mock implementation
    console.log('Mock: Getting user info from Google');
    return {
      name: 'Mock User',
      email: 'mock.user@example.com',
    };
  }
};

/**
 * Create a Google Form for tournament registration
 * @param {Object} tokens - The OAuth tokens
 * @param {Object} tournament - The tournament object
 * @returns {Promise<Object>} The created form details
 */
const createTournamentForm = async (tokens, tournament) => {
  if (useRealApi) {
    try {
      // Set credentials
      oauth2Client.setCredentials(tokens);
      
      // Initialize Google Forms and Drive APIs
      const { google } = require('googleapis');
      const forms = google.forms({ version: 'v1', auth: oauth2Client });
      
      // Create a new form - only set the title in the initial creation
      const formTitle = `${tournament.name} - Player Registration`;
      
      console.log('Creating form with title:', formTitle);
      
      // Step 1: Create the form with just a title
      const createResponse = await forms.forms.create({
        requestBody: {
          info: {
            title: formTitle,
            documentTitle: formTitle
          }
        }
      });
      
      const formId = createResponse.data.formId;
      const formUrl = `https://docs.google.com/forms/d/${formId}/edit`;
      
      console.log('Form created with ID:', formId);
      
      // Step 2: Update the form with description, questions, and settings
      // First, add the description
      const descriptionRequest = {
        requests: [
          {
            updateFormInfo: {
              info: {
                description: `Registration form for ${tournament.name}. Please fill out the required information to register for this tournament.`
              },
              updateMask: 'description'
            }
          }
        ]
      };
      
      console.log('Adding description to form');
      await forms.forms.batchUpdate({
        formId: formId,
        requestBody: descriptionRequest
      });
      
      // Step 3: Add form items (questions)
      const itemsRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: 'First Name',
                description: 'Your first name',
                questionItem: {
                  question: {
                    required: true,
                    textQuestion: {}
                  }
                }
              },
              location: { index: 0 }
            }
          },
          {
            createItem: {
              item: {
                title: 'Last Name',
                description: 'Your last name',
                questionItem: {
                  question: {
                    required: true,
                    textQuestion: {}
                  }
                }
              },
              location: { index: 1 }
            }
          },
          {
            createItem: {
              item: {
                title: 'Email',
                description: 'Your email address',
                questionItem: {
                  question: {
                    required: false,
                    textQuestion: {}
                  }
                }
              },
              location: { index: 2 }
            }
          },
          {
            createItem: {
              item: {
                title: 'Chess Rating',
                description: 'Your current chess rating (if applicable)',
                questionItem: {
                  question: {
                    required: false,
                    textQuestion: {}
                  }
                }
              },
              location: { index: 3 }
            }
          }
        ]
      };
      
      console.log('Adding questions to form');
      await forms.forms.batchUpdate({
        formId: formId,
        requestBody: itemsRequest
      });
      
      // Step 4: Configure form settings
      const settingsRequest = {
        requests: [
          {
            updateSettings: {
              settings: {
                quizSettings: {
                  isQuiz: false
                }
              },
              updateMask: 'quizSettings'
            }
          }
        ]
      };
      
      console.log('Updating form settings');
      await forms.forms.batchUpdate({
        formId: formId,
        requestBody: settingsRequest
      });
      
      // Get the form's response destination URL
      const responseUrl = `https://docs.google.com/forms/d/${formId}/viewform`;
      
      return {
        formId,
        formUrl,
        responseUrl,
        title: formTitle,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Error creating Google Form:', error);
      throw new Error('Failed to create Google Form: ' + error.message);
    }
  } else {
    // Mock implementation
    console.log('Mock: Creating Google Form for tournament:', tournament.name);
    
    const mockFormId = 'mock_form_' + Date.now();
    const mockFormUrl = `https://docs.google.com/forms/d/mock_form_id/edit`;
    const mockResponseUrl = `https://docs.google.com/forms/d/mock_form_id/viewform`;
    
    return {
      formId: mockFormId,
      formUrl: mockFormUrl,
      responseUrl: mockResponseUrl,
      title: `${tournament.name} - Player Registration`,
      createdAt: new Date()
    };
  }
};

/**
 * Get player data from Google Form
 * 
 * @param {Object} tokens - Google API tokens
 * @param {string} formId - ID of the Google Form
 * @param {Array<string>} processedResponses - Array of already processed response IDs
 * @param {boolean} forceSync - Whether to force sync all responses
 * @returns {Promise<Object>} - Player data and new response IDs
 */
const getPlayerDataFromForm = async (tokens, formId, processedResponses = [], forceSync = false) => {
  if (useRealApi) {
    try {
      console.log('Getting player data from Google Form:', formId);
      console.log('Already processed responses:', processedResponses.length);
      console.log('FORCE SYNC MODE:', forceSync ? 'ENABLED' : 'DISABLED');
      
      // Set credentials
      oauth2Client.setCredentials(tokens);
      
      // Initialize Google Forms API
      const { google } = require('googleapis');
      const forms = google.forms({ version: 'v1', auth: oauth2Client });
      
      // First, get the form structure to understand the questions
      console.log('Fetching form structure...');
      let formStructure;
      try {
        const formResponse = await forms.forms.get({
          formId: formId
        });
        formStructure = formResponse.data;
        console.log('Form title:', formStructure.info.title);
        console.log('Form items:', formStructure.items ? formStructure.items.length : 0);
      } catch (error) {
        console.error('Error fetching form structure:', error);
        console.log('Proceeding without form structure');
        formStructure = null;
      }
      
      // Get form responses
      console.log('Fetching form responses...');
      let responsesResponse;
      try {
        responsesResponse = await forms.forms.responses.list({
        formId: formId
      });
        console.log('Response data:', JSON.stringify(responsesResponse.data, null, 2));
      } catch (error) {
        console.error('Error fetching form responses:', error);
        
        // Check if the error is due to the form not having any responses yet
        if (error.message.includes('Form has no responses')) {
          console.log('Form has no responses yet');
          return { players: [], newResponseIds: [] };
        }
        
        // Check if the error is due to the form not being found
        if (error.message.includes('Form not found')) {
          console.log('Form not found');
          throw new Error('Form not found. Please check the form ID and try again.');
        }
        
        // Check if the error is due to insufficient permissions
        if (error.message.includes('insufficient permission')) {
          console.log('Insufficient permissions to access form responses');
          throw new Error('Insufficient permissions to access form responses. Please make sure you have access to the form.');
        }
        
        // For other errors, rethrow
        throw error;
      }
      
      const responses = responsesResponse.data.responses || [];
      console.log(`Found ${responses.length} total responses in the form`);
      
      // Determine which responses to process
      let responsesToProcess;
      if (forceSync) {
        // When force sync is enabled, process ALL responses
        console.log('FORCE SYNC ENABLED - Processing ALL responses regardless of previous processing');
        responsesToProcess = responses;
      } else {
        // Filter out already processed responses
        console.log('Normal sync - Filtering out already processed responses');
        responsesToProcess = responses.filter(response => !processedResponses.includes(response.responseId));
      }
      
      console.log(`Will process ${responsesToProcess.length} out of ${responses.length} total responses`);
      if (responsesToProcess.length > 0) {
        console.log('First few response IDs to process:', responsesToProcess.slice(0, 5).map(r => r.responseId));
      }
      
      if (responsesToProcess.length === 0) {
        if (forceSync) {
          console.log('FORCE SYNC ENABLED but no responses found in the form');
        } else {
          console.log('No new responses found in the form');
        }
        return { players: [], newResponseIds: [] };
      }
      
      // Create a mapping of question IDs to field names
      let questionMapping = {};
      
      if (formStructure && formStructure.items) {
        formStructure.items.forEach(item => {
          if (!item.questionItem || !item.questionItem.question) return;
          
          const questionId = item.questionItem.question.questionId;
          const title = item.title || '';
          
          // Map question titles to field names
          if (title.toLowerCase().includes('first name')) {
            questionMapping[questionId] = 'firstName';
          } else if (title.toLowerCase().includes('last name')) {
            questionMapping[questionId] = 'lastName';
          } else if (title.toLowerCase().includes('email')) {
            questionMapping[questionId] = 'email';
          } else if (title.toLowerCase().includes('rating') || title.toLowerCase().includes('chess rating')) {
            questionMapping[questionId] = 'chessRating';
          }
        });
      }
      
      console.log('Question mapping:', questionMapping);
      
      // Process responses to extract player data
      const players = [];
      const newResponseIds = [];
      
      for (const response of responsesToProcess) {
        try {
          console.log('Processing response:', response.responseId);
          
          // Add to new response IDs
          newResponseIds.push(response.responseId);
          
          // Extract player data from response
          const playerData = {
            firstName: '',
            lastName: '',
            email: '',
            chessRating: null
          };
          
          // Process answers
          if (response.answers) {
            Object.entries(response.answers).forEach(([questionId, answer]) => {
              const fieldName = questionMapping[questionId];
              
              if (fieldName) {
                let value = '';
                
                // Extract value based on answer type
                if (answer.textAnswers && answer.textAnswers.answers) {
                  value = answer.textAnswers.answers[0].value || '';
                }
                
                // Store value in player data
                playerData[fieldName] = value;
                
                // Convert chess rating to number if present
                if (fieldName === 'chessRating' && value) {
                  const ratingValue = parseInt(value, 10);
                  playerData.chessRating = isNaN(ratingValue) ? null : ratingValue;
                }
              }
            });
          }
          
          // Check if we have enough data to create a player
          if (playerData.firstName || playerData.lastName) {
            console.log('Extracted player data:', playerData);
            players.push(playerData);
          } else {
            console.log('Skipping response due to insufficient player data');
          }
        } catch (error) {
          console.error('Error processing response:', error);
        }
      }
      
      console.log(`Extracted ${players.length} players from ${responsesToProcess.length} responses`);
      
      return {
        players,
        newResponseIds
      };
    } catch (error) {
      console.error('Error getting player data from Google Form:', error);
      throw error;
    }
  } else {
    // Mock implementation for development
    console.log('Using mock implementation for getPlayerDataFromForm');
    
    // Return mock data
    return {
      players: [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        chessRating: 1500
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
          chessRating: 1800
        }
      ],
      newResponseIds: ['mock-response-1', 'mock-response-2']
    };
  }
};

/**
 * Extract table data from a Google Doc
 * @param {Object} doc - The Google Doc object
 * @returns {Array<Array<string>>} The extracted table data
 */
function extractTableData(doc) {
  try {
    console.log('Extracting table data from Google Doc');
    
    if (!doc || !doc.body || !doc.body.content) {
      console.error('Invalid document structure');
      return [];
    }
    
    const tableData = [];
    
    // Iterate through the document content
    for (const element of doc.body.content) {
      // Check if the element is a table
      if (element.table) {
        console.log('Found a table in the document');
        
        // Process each row in the table
        for (const tableRow of element.table.tableRows) {
          const row = [];
          
          // Process each cell in the row
          for (const tableCell of tableRow.tableCells) {
            let cellText = '';
            
            // Extract text from the cell
            if (tableCell.content) {
              for (const content of tableCell.content) {
                if (content.paragraph && content.paragraph.elements) {
                  for (const element of content.paragraph.elements) {
                    if (element.textRun && element.textRun.content) {
                      cellText += element.textRun.content;
                    }
                  }
                }
              }
            }
            
            // Add the cell text to the row
            row.push(cellText.trim());
          }
          
          // Add the row to the table data
          tableData.push(row);
        }
      }
    }
    
    console.log(`Extracted ${tableData.length} rows of table data`);
    return tableData;
  } catch (error) {
    console.error('Error extracting table data:', error);
    return [];
  }
}

/**
 * Extract text from a Google Doc
 * @param {Object} doc - The Google Doc object
 * @returns {string} The extracted text
 */
function extractTextFromDoc(doc) {
  try {
    console.log('Extracting text from Google Doc');
    
    if (!doc || !doc.body || !doc.body.content) {
      console.error('Invalid document structure');
      return '';
    }
    
    let text = '';
    
    // Iterate through the document content
    for (const element of doc.body.content) {
      // Check if the element is a paragraph
      if (element.paragraph) {
        for (const paragraphElement of element.paragraph.elements) {
          if (paragraphElement.textRun && paragraphElement.textRun.content) {
            text += paragraphElement.textRun.content;
          }
        }
      }
      // Check if the element is a table
      else if (element.table) {
        for (const tableRow of element.table.tableRows) {
          for (const tableCell of tableRow.tableCells) {
            if (tableCell.content) {
              for (const content of tableCell.content) {
                if (content.paragraph && content.paragraph.elements) {
                  for (const paragraphElement of content.paragraph.elements) {
                    if (paragraphElement.textRun && paragraphElement.textRun.content) {
                      text += paragraphElement.textRun.content;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`Extracted ${text.length} characters of text from the document`);
    return text;
  } catch (error) {
    console.error('Error extracting text from Google Doc:', error);
    return '';
  }
}

/**
 * Extract players from a Google Doc
 * @param {string} docId - The Google Doc ID
 * @returns {Promise<Array<Object>>} The extracted player data
 */
async function extractPlayersFromGoogleDoc(docId) {
  try {
    console.log(`Extracting players from Google Doc: ${docId}`);
    
    // Get the document content
    const doc = await getGoogleDoc(docId);
    if (!doc) {
      console.error('Failed to get Google Doc content');
      return { error: 'Failed to get Google Doc content. Please check the document ID and try again.' };
    }
    
    console.log('Successfully retrieved Google Doc content');
    
    // Extract the text content from the document
    const text = extractTextFromDoc(doc);
    if (!text || text.trim().length === 0) {
      console.error('Google Doc is empty');
      return { 
        error: 'The Google Doc appears to be empty. Please add player information to the document and try again.' 
      };
    }
    
    console.log(`Extracted ${text.length} characters of text from the document`);
    
    // Try different extraction methods
    let players = [];
    
    // First try to extract from a PLAYER REGISTRATION section
    console.log('Attempting to extract players from PLAYER REGISTRATION section...');
    players = extractPlayersFromRegistrationSection(text);
    
    // If that didn't work, try to extract from a table
    if (players.length === 0) {
      console.log('No players found in PLAYER REGISTRATION section, trying table extraction...');
      const tableData = extractTableData(doc);
      if (tableData && tableData.length > 0) {
        console.log(`Found ${tableData.length} rows of table data`);
        players = extractPlayersFromTableData(tableData);
      } else {
        console.log('No table data found in the document');
      }
    }
    
    // If still no players, try to extract from the document text directly
    if (players.length === 0) {
      console.log('No players found in tables, trying to extract from document text directly...');
      players = extractPlayersFromText(text);
    }
    
    // Log the results
    if (players.length === 0) {
      console.error('No players found in the document');
      return { 
        error: `No players found in the document. Please ensure the document contains player information in one of the supported formats:
        
1. A section titled "PLAYER REGISTRATION" followed by player names (one per line)
2. A table with player information (with columns for name, email, etc.)
3. A list of player names in the document text

Remember that only first name and last name are required. Other fields like email and chess rating are optional.

Example formats:
- John Smith
- Jane Doe, jane@example.com, 1500
- First Name: John, Last Name: Smith
        `
      };
    }
    
    console.log(`Successfully extracted ${players.length} players from the document`);
    
    // Validate the players
    const validPlayers = players.filter(player => {
      // A player is valid if they have at least a first name or last name
      return player && (player.firstName || player.lastName);
    });
    
    if (validPlayers.length === 0) {
      console.error('No valid players found in the document');
      return { 
        error: 'No valid players found in the document. Please ensure each player has at least a first name or last name.' 
      };
    }
    
    if (validPlayers.length < players.length) {
      console.warn(`Filtered out ${players.length - validPlayers.length} invalid players`);
    }
    
    console.log(`Returning ${validPlayers.length} valid players`);
    return validPlayers;
  } catch (error) {
    console.error('Error extracting players from Google Doc:', error);
    return { 
      error: `An error occurred while extracting players from the Google Doc: ${error.message}. Please try again or check the document format.` 
    };
  }
}

/**
 * Sync players from a Google Doc
 * @param {string} docId - The Google Doc ID
 * @param {string} tournamentId - The tournament ID
 * @param {boolean} forceSync - Whether to force sync all players, ignoring processed data
 * @returns {Promise<Object>} The result of the sync operation
 */
async function syncPlayersFromGoogleDoc(docId, tournamentId, forceSync = false) {
  try {
    console.log(`Syncing players from Google Doc ${docId} to tournament ${tournamentId} (Force sync: ${forceSync})`);
    
    // Get the tournament
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      console.error(`Tournament ${tournamentId} not found`);
      return { 
        success: false, 
        message: 'Tournament not found' 
      };
    }
    
    // Get the processed data for this tournament
    let processedData = tournament.processedData || [];
    
    // If force sync is enabled, clear the processed data
    if (forceSync) {
      console.log('Force sync enabled, clearing processed data');
      processedData = [];
    }
    
    // Extract players from the Google Doc
    const result = await extractPlayersFromGoogleDoc(docId);
    
    // Check if there was an error
    if (result && result.error) {
      console.error('Error extracting players from Google Doc:', result.error);
      return { 
        success: false, 
        message: result.error 
      };
    }
    
    // Get the players
    const players = Array.isArray(result) ? result : [];
    
    if (!players || players.length === 0) {
      console.log('No players found in the Google Doc');
      return { 
        success: false, 
        message: 'No players found in the Google Doc. Please check the document format and try again.' 
      };
    }
    
    console.log(`Found ${players.length} players in the Google Doc`);
    
    // Generate hashes for each player to track what's been processed
    const playerHashes = [];
    const newPlayers = [];
    
    for (const player of players) {
      // Create a hash of the player data
      const hash = createPlayerHash(player);
      playerHashes.push(hash);
      
      // Check if this player has already been processed
      if (!processedData.includes(hash) || forceSync) {
        newPlayers.push(player);
      }
    }
    
    console.log(`Found ${newPlayers.length} new players that haven't been processed before`);
    
    if (newPlayers.length === 0) {
      return { 
        success: true, 
        message: 'No new players found in Google Doc. All data has already been synced. Use the "Force Sync" option to re-sync all players.',
        playersAdded: 0
      };
    }
    
    // Add the new players to the tournament
    let playersAdded = 0;
    
    for (const playerData of newPlayers) {
      try {
        // Create a new player
        const player = new Player({
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          email: playerData.email,
          chessRating: playerData.chessRating,
          chesscomUsername: playerData.chesscomUsername,
          tournaments: [tournamentId]
        });
        
        // Save the player
        await player.save();
        
        // Add the player to the tournament
        tournament.players.push(player._id);
        
        // Add the hash to the processed data
        const hash = createPlayerHash(playerData);
        processedData.push(hash);
        
        playersAdded++;
        console.log(`Added player ${player.firstName} ${player.lastName} to tournament ${tournamentId}`);
      } catch (playerError) {
        console.error('Error adding player:', playerError);
        // Continue with next player
      }
    }
    
    // Update the tournament with the new processed data
    tournament.processedData = processedData;
    await tournament.save();
    
    console.log(`Successfully added ${playersAdded} players to tournament ${tournamentId}`);
    
    return { 
      success: true, 
      message: `Successfully added ${playersAdded} players to the tournament.`,
      playersAdded
    };
  } catch (error) {
    console.error('Error syncing players from Google Doc:', error);
    return { 
      success: false, 
      message: `An error occurred while syncing players from the Google Doc: ${error.message}. Please try again.` 
    };
  }
}

// Get a Google Doc
async function getGoogleDoc(docId) {
  if (useRealApi) {
    try {
      // Create a docs client
      const docs = googleApi.docs({
        version: 'v1',
        auth: oauth2Client
      });
      
      // Get the document
      const response = await docs.documents.get({
        documentId: docId
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting Google Doc:', error);
      return null;
    }
  } else {
    // Mock implementation
    console.log('Using mock implementation for getGoogleDoc');
    return getMockDocument();
  }
}

module.exports = {
  // Auth functions
  generateAuthUrl,
  getTokensFromCode,
  storeTokensForUser,
  getTokensForUser,
  refreshTokensIfNeeded,
  
  // Google Docs functions
  createTournamentDoc,
  getPlayerDataFromDoc,
  extractPlayersFromGoogleDoc,
  syncPlayersFromGoogleDoc,
  getGoogleDoc,
  
  // Google Forms functions
  createTournamentForm,
  getPlayerDataFromForm,
  
  // User info
  getUserInfo
}; 