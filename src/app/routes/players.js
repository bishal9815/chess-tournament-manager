const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { protect, admin } = require('../../lib/auth');
const { batchGetPlayerInfo, getPlayerInfo } = require('../../lib/chessComApi');
const { processFile } = require('../../lib/fileProcessor');
const { processAndStorePlayerData } = require('../../lib/services/playerDataService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Player = require('../../models/Player');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only Excel and Word files
  const filetypes = /xlsx|xls|doc|docx/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only Excel and Word files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

/**
 * @route   POST /api/players/chesscom-lookup
 * @desc    Lookup player information from Chess.com API
 * @access  Private
 */
router.post('/chesscom-lookup', protect, async (req, res) => {
  try {
    const { usernames } = req.body;
    
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of Chess.com usernames'
      });
    }
    
    // Limit the number of usernames to prevent abuse
    const limitedUsernames = usernames.slice(0, 20);
    
    // Fetch player information from Chess.com
    const playerInfo = await batchGetPlayerInfo(limitedUsernames);
    
    res.status(200).json({
      success: true,
      count: playerInfo.length,
      data: playerInfo
    });
  } catch (error) {
    console.error('Chess.com lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

/**
 * @route   GET /api/players/search
 * @desc    Search for players by name, email, or username
 * @access  Private
 */
router.get('/search', protect, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    // Search for players in the database
    const players = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { chesscomUsername: { $regex: query, $options: 'i' } }
      ]
    }).select('-password').limit(20);
    
    res.status(200).json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    console.error('Player search error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

/**
 * @route   POST /api/players/process
 * @desc    Process and validate player data without storing
 * @access  Private
 */
router.post('/process', protect, async (req, res) => {
  try {
    const { players } = req.body;
    
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of player data'
      });
    }
    
    // Process the player data without storing in database
    const result = await processAndStorePlayerData({
      manualData: players,
      storeInDatabase: false
    });
    
    res.status(200).json({
      success: result.success,
      count: result.processedPlayers.length,
      invalidCount: result.invalidPlayers.length,
      duplicateCount: result.duplicates.length,
      data: {
        processedPlayers: result.processedPlayers,
        invalidPlayers: result.invalidPlayers,
        duplicates: result.duplicates
      }
    });
  } catch (error) {
    console.error('Player processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

/**
 * @route   POST /api/players/upload
 * @desc    Upload and process player data from a file
 * @access  Private
 */
router.post('/upload', protect, upload.single('playersFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file'
      });
    }
    
    const filePath = req.file.path;
    
    // Process the file to extract player data
    const fileData = await processFile(filePath);
    
    // Clean up the file after processing
    fs.unlinkSync(filePath);
    
    if (fileData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid players found in the file'
      });
    }
    
    // Process the player data without storing in database
    const result = await processAndStorePlayerData({
      fileData,
      storeInDatabase: false
    });
    
    res.status(200).json({
      success: result.success,
      count: result.processedPlayers.length,
      invalidCount: result.invalidPlayers.length,
      duplicateCount: result.duplicates.length,
      data: {
        processedPlayers: result.processedPlayers,
        invalidPlayers: result.invalidPlayers,
        duplicates: result.duplicates
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

/**
 * @route   POST /api/players/store
 * @desc    Process and store player data in the database
 * @access  Private
 */
router.post('/store', protect, async (req, res) => {
  try {
    const { players } = req.body;
    
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of player data'
      });
    }
    
    // Process and store the player data
    const result = await processAndStorePlayerData({
      manualData: players,
      storeInDatabase: true
    });
    
    res.status(200).json({
      success: result.success,
      count: result.processedPlayers.length,
      storedCount: result.storedPlayers.length,
      invalidCount: result.invalidPlayers.length,
      duplicateCount: result.duplicates.length,
      data: {
        storedPlayers: result.storedPlayers,
        invalidPlayers: result.invalidPlayers,
        duplicates: result.duplicates
      }
    });
  } catch (error) {
    console.error('Player storage error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

/**
 * @route   POST /api/players/upload-and-store
 * @desc    Upload, process, and store player data from a file
 * @access  Private
 */
router.post('/upload-and-store', protect, upload.single('playersFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file'
      });
    }
    
    const filePath = req.file.path;
    
    // Process the file to extract player data
    const fileData = await processFile(filePath);
    
    // Clean up the file after processing
    fs.unlinkSync(filePath);
    
    if (fileData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid players found in the file'
      });
    }
    
    // Process and store the player data
    const result = await processAndStorePlayerData({
      fileData,
      storeInDatabase: true
    });
    
    res.status(200).json({
      success: result.success,
      count: result.processedPlayers.length,
      storedCount: result.storedPlayers.length,
      invalidCount: result.invalidPlayers.length,
      duplicateCount: result.duplicates.length,
      data: {
        storedPlayers: result.storedPlayers,
        invalidPlayers: result.invalidPlayers,
        duplicates: result.duplicates
      }
    });
  } catch (error) {
    console.error('File upload and storage error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Get all players
router.get('/', protect, async (req, res) => {
  try {
    const players = await Player.find();
    
    res.status(200).json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Get player by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: player
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Create new player
router.post('/', protect, async (req, res) => {
  try {
    const player = await Player.create(req.body);
    
    res.status(201).json({
      success: true,
      data: player
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        error: messages
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }
});

// Update player
router.put('/:id', protect, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: player
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        error: messages
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }
});

// Delete player
router.delete('/:id', protect, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }
    
    await player.remove();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Get player info from Chess.com
router.get('/chesscom/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a username'
      });
    }
    
    const playerInfo = await getPlayerInfo(username);
    
    res.status(200).json({
      success: true,
      data: playerInfo
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 