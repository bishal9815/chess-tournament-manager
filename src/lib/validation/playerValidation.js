/**
 * Player Data Validation Service
 * 
 * Provides comprehensive validation for player data from various sources
 * (manual input, file uploads, Chess.com API) with consistent rules.
 */

// Regular expressions for validation
const VALIDATION_REGEX = {
  // Allow letters, spaces, hyphens, apostrophes, and periods in names
  NAME: /^[A-Za-z\s\-'.]+$/,
  // Standard email validation
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // Chess.com usernames can contain letters, numbers, underscores, and hyphens
  CHESSCOM_USERNAME: /^[A-Za-z0-9_-]+$/
};

/**
 * Validate a player's name
 * @param {string} name - Player name to validate
 * @returns {Object} - Validation result with isValid flag and error message
 */
function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Name is required' };
  }

  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters long' };
  }
  
  if (trimmedName.length > 100) {
    return { isValid: false, error: 'Name cannot exceed 100 characters' };
  }
  
  if (!VALIDATION_REGEX.NAME.test(trimmedName)) {
    return { isValid: false, error: 'Name contains invalid characters' };
  }
  
  return { isValid: true, value: trimmedName };
}

/**
 * Validate a player's email
 * @param {string} email - Email to validate
 * @returns {Object} - Validation result with isValid flag and error message
 */
function validateEmail(email) {
  // Email is optional, so empty is valid
  if (!email || email.trim() === '') {
    return { isValid: true, value: '' };
  }
  
  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a string' };
  }

  const trimmedEmail = email.trim();
  
  if (trimmedEmail.length > 255) {
    return { isValid: false, error: 'Email is too long' };
  }
  
  if (!VALIDATION_REGEX.EMAIL.test(trimmedEmail)) {
    return { isValid: false, error: 'Email format is invalid' };
  }
  
  return { isValid: true, value: trimmedEmail };
}

/**
 * Validate a player's rating
 * @param {number|string} rating - Rating to validate
 * @returns {Object} - Validation result with isValid flag and error message
 */
function validateRating(rating) {
  // Rating is optional, so empty/null is valid
  if (rating === null || rating === undefined || rating === '') {
    return { isValid: true, value: null };
  }
  
  // Convert to number if it's a string
  const numRating = typeof rating === 'string' ? parseInt(rating, 10) : rating;
  
  if (isNaN(numRating)) {
    return { isValid: false, error: 'Rating must be a number' };
  }
  
  if (numRating < 0) {
    return { isValid: false, error: 'Rating cannot be negative' };
  }
  
  if (numRating > 3500) {
    return { isValid: false, error: 'Rating is unrealistically high' };
  }
  
  return { isValid: true, value: numRating };
}

/**
 * Validate a Chess.com username
 * @param {string} username - Chess.com username to validate
 * @returns {Object} - Validation result with isValid flag and error message
 */
function validateChesscomUsername(username) {
  // Username is optional, so empty is valid
  if (!username || username.trim() === '') {
    return { isValid: true, value: '' };
  }
  
  if (typeof username !== 'string') {
    return { isValid: false, error: 'Chess.com username must be a string' };
  }

  const trimmedUsername = username.trim();
  
  if (trimmedUsername.length < 3) {
    return { isValid: false, error: 'Chess.com username must be at least 3 characters long' };
  }
  
  if (trimmedUsername.length > 50) {
    return { isValid: false, error: 'Chess.com username is too long' };
  }
  
  if (!VALIDATION_REGEX.CHESSCOM_USERNAME.test(trimmedUsername)) {
    return { isValid: false, error: 'Chess.com username contains invalid characters' };
  }
  
  return { isValid: true, value: trimmedUsername };
}

/**
 * Validate a complete player object
 * @param {Object} player - Player object to validate
 * @returns {Object} - Validation result with isValid flag, errors, and validated player data
 */
function validatePlayer(player) {
  if (!player || typeof player !== 'object') {
    return { 
      isValid: false, 
      errors: { general: 'Invalid player data' },
      player: null
    };
  }
  
  const nameValidation = validateName(player.name);
  const emailValidation = validateEmail(player.email);
  const ratingValidation = validateRating(player.rating);
  const usernameValidation = validateChesscomUsername(player.chesscomUsername);
  
  const isValid = nameValidation.isValid && 
                 emailValidation.isValid && 
                 ratingValidation.isValid &&
                 usernameValidation.isValid;
  
  const errors = {};
  
  if (!nameValidation.isValid) errors.name = nameValidation.error;
  if (!emailValidation.isValid) errors.email = emailValidation.error;
  if (!ratingValidation.isValid) errors.rating = ratingValidation.error;
  if (!usernameValidation.isValid) errors.chesscomUsername = usernameValidation.error;
  
  const validatedPlayer = isValid ? {
    name: nameValidation.value,
    email: emailValidation.value,
    rating: ratingValidation.value,
    chesscomUsername: usernameValidation.value
  } : null;
  
  return {
    isValid,
    errors: Object.keys(errors).length > 0 ? errors : null,
    player: validatedPlayer
  };
}

/**
 * Validate an array of player objects
 * @param {Array<Object>} players - Array of player objects to validate
 * @returns {Object} - Validation results with valid players and errors
 */
function validatePlayers(players) {
  if (!Array.isArray(players)) {
    return {
      validPlayers: [],
      invalidPlayers: [],
      errors: ['Input is not an array']
    };
  }
  
  const validPlayers = [];
  const invalidPlayers = [];
  const errors = [];
  
  players.forEach((player, index) => {
    const validation = validatePlayer(player);
    
    if (validation.isValid) {
      validPlayers.push(validation.player);
    } else {
      invalidPlayers.push({
        originalData: player,
        errors: validation.errors,
        index
      });
      errors.push(`Player at index ${index} has validation errors: ${JSON.stringify(validation.errors)}`);
    }
  });
  
  return {
    validPlayers,
    invalidPlayers,
    errors: errors.length > 0 ? errors : null
  };
}

module.exports = {
  validateName,
  validateEmail,
  validateRating,
  validateChesscomUsername,
  validatePlayer,
  validatePlayers
}; 