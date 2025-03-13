/**
 * File Processor Utility
 * 
 * Functions for processing uploaded Excel and Word files to extract player information.
 */

const xlsx = require('xlsx');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');

/**
 * Extract player data from an Excel file
 * @param {string} filePath - Path to the Excel file
 * @returns {Array<Object>} - Array of player objects with name, email, rating, and chesscomUsername
 */
function processExcelFile(filePath) {
  try {
    console.log('Processing Excel file:', filePath);
    
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = xlsx.utils.sheet_to_json(worksheet);
    console.log('Raw Excel data:', JSON.stringify(rawData).substring(0, 200) + '...');
    
    if (!rawData || rawData.length === 0) {
      console.log('No data found in Excel file');
      return [];
    }
    
    // Log the column names to help with debugging
    const sampleRow = rawData[0];
    console.log('Excel columns:', Object.keys(sampleRow));
    
    // Process and normalize the data
    const players = rawData.map(row => {
      // Handle different possible column names
      const firstName = row['First Name'] || row['FirstName'] || row['First_Name'] || row['firstname'] || row['FIRST NAME'] || '';
      const lastName = row['Last Name'] || row['LastName'] || row['Last_Name'] || row['lastname'] || row['LAST NAME'] || '';
      const fullName = row['Name'] || row['FullName'] || row['Full Name'] || row['FULL NAME'] || row['Player'] || row['player'] || row['PLAYER'] || '';
      const email = row['Email'] || row['email'] || row['EMAIL'] || '';
      const rating = row['Rating'] || row['rating'] || row['RATING'] || row['Chess Rating'] || row['ChessRating'] || row['ELO'] || row['elo'] || '';
      
      // If we have a full name but not first/last name, split it
      let finalFirstName = firstName;
      let finalLastName = lastName;
      
      if ((!firstName && !lastName && fullName) || (fullName && !firstName && !lastName)) {
        const nameParts = fullName.split(' ');
        finalFirstName = nameParts[0] || '';
        finalLastName = nameParts.slice(1).join(' ') || '';
      }
      
      // If we still don't have a name, try to use any string field as a name
      if (!finalFirstName && !finalLastName) {
        for (const key in row) {
          if (typeof row[key] === 'string' && row[key].trim() !== '') {
            const nameParts = row[key].trim().split(' ');
            finalFirstName = nameParts[0] || '';
            finalLastName = nameParts.slice(1).join(' ') || '';
            break;
          }
        }
      }
      
      return {
        firstName: finalFirstName,
        lastName: finalLastName,
        email: email,
        chessRating: rating ? parseInt(rating) : undefined
      };
    }).filter(player => player.firstName || player.lastName); // Filter out empty rows
    
    console.log(`Extracted ${players.length} players from Excel file`);
    
    if (players.length === 0) {
      console.log('No valid players found in Excel file. Check column names.');
    }
    
    return players;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw new Error(`Failed to process Excel file: ${error.message}`);
  }
}

/**
 * Extract player data from a Word document
 * @param {string} filePath - Path to the Word document
 * @returns {Array<Object>} - Array of player objects with name, email, rating, and chesscomUsername
 */
async function processWordFile(filePath) {
  try {
    console.log('Processing Word file:', filePath);
    
    // Extract text from the Word document
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    console.log('Extracted text from Word file:', text.substring(0, 200) + '...');
    
    if (!text || text.trim() === '') {
      console.log('No text found in Word file');
      return [];
    }
    
    // Split text by lines and process each line
    const lines = text.split('\n').filter(line => line.trim() !== '');
    console.log(`Found ${lines.length} lines in Word file`);
    
    // Try to detect if the file has headers
    const firstLine = lines[0].toLowerCase();
    const hasHeaders = firstLine.includes('name') || 
                      firstLine.includes('first') || 
                      firstLine.includes('last') || 
                      firstLine.includes('email') || 
                      firstLine.includes('rating');
    
    const startIndex = hasHeaders ? 1 : 0;
    
    const players = lines.slice(startIndex).map(line => {
      // Try comma-separated values first
      if (line.includes(',')) {
        const parts = line.split(',').map(part => part.trim());
        
        if (parts.length >= 2) {
          return {
            firstName: parts[0] || '',
            lastName: parts[1] || '',
            email: parts.length > 2 ? parts[2] || '' : '',
            chessRating: parts.length > 3 && parts[3] ? parseInt(parts[3]) : undefined
          };
        }
      }
      
      // If not comma-separated, try space-separated (assuming it's a full name)
      const nameParts = line.trim().split(/\s+/);
      return {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: '',
        chessRating: undefined
      };
    }).filter(player => player && (player.firstName || player.lastName)); // Filter out null values and empty names
    
    console.log(`Extracted ${players.length} players from Word file`);
    
    if (players.length === 0) {
      console.log('No valid players found in Word file. Check format.');
    }
    
    return players;
  } catch (error) {
    console.error('Error processing Word file:', error);
    throw new Error(`Failed to process Word file: ${error.message}`);
  }
}

/**
 * Process CSV file
 * @param {string} filePath - Path to the CSV file
 * @returns {Array} - Array of player objects
 */
function processCsvFile(filePath) {
  try {
    console.log('Processing CSV file:', filePath);
    
    const content = fs.readFileSync(filePath, 'utf8');
    console.log('CSV content:', content.substring(0, 200) + '...');
    
    if (!content || content.trim() === '') {
      console.log('No content found in CSV file');
      return [];
    }
    
    const lines = content.split('\n').filter(line => line.trim() !== '');
    console.log(`Found ${lines.length} lines in CSV file`);
    
    if (lines.length === 0) {
      return [];
    }
    
    // Get headers from the first line
    const headers = lines[0].split(',').map(header => header.trim());
    console.log('CSV headers:', headers);
    
    // Map header indices
    const firstNameIndex = headers.findIndex(h => 
      h.toLowerCase().includes('first') || 
      h.toLowerCase() === 'firstname' || 
      h.toLowerCase() === 'first_name'
    );
    
    const lastNameIndex = headers.findIndex(h => 
      h.toLowerCase().includes('last') || 
      h.toLowerCase() === 'lastname' || 
      h.toLowerCase() === 'last_name'
    );
    
    const nameIndex = headers.findIndex(h => 
      h.toLowerCase() === 'name' || 
      h.toLowerCase() === 'fullname' || 
      h.toLowerCase() === 'full name' ||
      h.toLowerCase() === 'player'
    );
    
    const emailIndex = headers.findIndex(h => 
      h.toLowerCase().includes('email')
    );
    
    const ratingIndex = headers.findIndex(h => 
      h.toLowerCase().includes('rating') || 
      h.toLowerCase().includes('elo')
    );
    
    console.log('Column indices:', {
      firstName: firstNameIndex,
      lastName: lastNameIndex,
      name: nameIndex,
      email: emailIndex,
      rating: ratingIndex
    });
    
    // If we can't find any name columns, try to use the first column as name
    const useFirstColumnAsName = firstNameIndex === -1 && lastNameIndex === -1 && nameIndex === -1;
    
    // Process data rows
    const players = lines.slice(1).map(line => {
      const values = line.split(',').map(value => value.trim());
      
      let firstName = '';
      let lastName = '';
      
      if (firstNameIndex !== -1 && values[firstNameIndex]) {
        firstName = values[firstNameIndex];
      }
      
      if (lastNameIndex !== -1 && values[lastNameIndex]) {
        lastName = values[lastNameIndex];
      }
      
      if ((!firstName || !lastName) && nameIndex !== -1 && values[nameIndex]) {
        const nameParts = values[nameIndex].split(' ');
        if (!firstName) firstName = nameParts[0] || '';
        if (!lastName) lastName = nameParts.slice(1).join(' ') || '';
      }
      
      // If we still don't have a name, use the first column
      if ((!firstName && !lastName) && useFirstColumnAsName && values[0]) {
        const nameParts = values[0].split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
      const email = emailIndex !== -1 && values[emailIndex] ? values[emailIndex] : '';
      const rating = ratingIndex !== -1 && values[ratingIndex] ? values[ratingIndex] : '';
      
      return {
        firstName,
        lastName,
        email,
        chessRating: rating ? parseInt(rating) : undefined
      };
    }).filter(player => player.firstName || player.lastName); // Filter out empty rows
    
    console.log(`Extracted ${players.length} players from CSV file`);
    
    if (players.length === 0) {
      console.log('No valid players found in CSV file. Check format and column names.');
    }
    
    return players;
  } catch (error) {
    console.error('Error processing CSV file:', error);
    throw new Error(`Failed to process CSV file: ${error.message}`);
  }
}

/**
 * Process uploaded file and extract player data
 * @param {string} filePath - Path to the uploaded file
 * @returns {Promise<Array>} - Array of player objects
 */
async function processFile(filePath) {
  console.log('Processing file:', filePath);
  
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    let players = [];
    
    if (fileExt === '.xlsx' || fileExt === '.xls') {
      // Process Excel file
      console.log('Processing as Excel file');
      players = await processExcelFile(filePath);
    } else if (fileExt === '.doc' || fileExt === '.docx') {
      // Process Word file
      console.log('Processing as Word file');
      players = await processWordFile(filePath);
    } else if (fileExt === '.csv') {
      // Process CSV file
      console.log('Processing as CSV file');
      players = await processCsvFile(filePath);
    } else {
      throw new Error('Unsupported file format');
    }
    
    console.log(`Extracted ${players.length} players from file`);
    return players;
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
}

/**
 * Try a more generic approach to extract player data from a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<Array>} - Array of player objects
 */
async function tryGenericFileProcessing(filePath) {
  try {
    console.log('Trying generic file processing for:', filePath);
    
    // Read the file as text
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/[\r\n]+/).filter(line => line.trim() !== '');
    
    console.log(`Found ${lines.length} lines in file using generic processing`);
    
    if (lines.length === 0) {
      return [];
    }
    
    // Process each line as a player
    const players = lines.map(line => {
      // Try to extract a name from the line
      const words = line.trim().split(/\s+/);
      
      if (words.length === 0) {
        return null;
      }
      
      // Assume the first word is the first name and the rest is the last name
      const firstName = words[0] || '';
      const lastName = words.length > 1 ? words.slice(1).join(' ') : '';
      
      return {
        firstName,
        lastName,
        email: '',
        chessRating: undefined
      };
    }).filter(player => player && (player.firstName || player.lastName));
    
    console.log(`Extracted ${players.length} players using generic processing`);
    
    return players;
  } catch (error) {
    console.error('Error in generic file processing:', error);
    return [];
  }
}

/**
 * Clean up a file after processing
 * @param {string} filePath - Path to the file to clean up
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
    // Don't throw, just log the error
  }
}

/**
 * Remove duplicate players from the array
 * @param {Array<Object>} players - Array of player objects
 * @returns {Array<Object>} - Array of unique player objects
 */
function removeDuplicatePlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  console.log('Removing duplicates from player list');
  
  // Create a map to track unique players by name
  const uniquePlayers = new Map();
  
  for (const player of players) {
    // Create a key based on first and last name
    const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase();
    
    if (fullName === '') {
      continue; // Skip players with no name
    }
    
    // If this name is not in the map yet, or the current player has more info, use this player
    if (!uniquePlayers.has(fullName) || 
        (player.email && !uniquePlayers.get(fullName).email) ||
        (player.chessRating && !uniquePlayers.get(fullName).chessRating)) {
      uniquePlayers.set(fullName, player);
    }
  }
  
  // Convert map values back to array
  return Array.from(uniquePlayers.values());
}

module.exports = {
  processExcelFile,
  processWordFile,
  processCsvFile,
  processFile,
  tryGenericFileProcessing,
  removeDuplicatePlayers,
  cleanupFile
}; 