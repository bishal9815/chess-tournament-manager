const express = require('express');
const router = express.Router();
const Tournament = require('../../models/Tournament');
const Match = require('../../models/Match');
const User = require('../../models/User');
const { 
  generateSwissPairings, 
  generateDoubleSwissPairings, 
  generateRoundRobinPairings,
  generateKnockoutPairings,
  generateScheveningenPairings,
  generateMonradPairings,
  generateRandomPairings,
  generateAcceleratedPairings
} = require('../../lib/allPairingAlgorithms');
const { calculateTiebreaks } = require('../../lib/tournamentUtils');
const { protect } = require('../../lib/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const mammoth = require('mammoth');
const jwt = require('jsonwebtoken');

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

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    // Check if the request includes an authorization token
    const authHeader = req.headers.authorization;
    let query = {};
    let userRole = null;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // User is logged in, get their user ID from the token
      const token = authHeader.split(' ')[1];
      
      try {
        // Verify the token and get the user ID
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        
        // Get the user from the database to check their role
        const user = await User.findById(userId).select('+role');
        
        if (user) {
          userRole = user.role;
          console.log(`User is logged in, ID: ${userId}, Role: ${userRole}`);
          
          // Check if user wants to see only their tournaments
          const showOnlyMine = req.headers['x-show-only-mine'] === 'true';
          
          if (showOnlyMine) {
            console.log('User requesting only their tournaments');
            query = { organizer: userId };
          } else {
            console.log('User requesting all visible tournaments');
            // Show public tournaments and private tournaments created by this user
            query = {
              $or: [
                { isPublic: true },
                { organizer: userId, isPublic: false }
              ]
            };
          }
        } else {
          console.log('User not found in database, showing public tournaments');
          query = { isPublic: true };
        }
      } catch (tokenError) {
        console.error('Invalid token, showing public tournaments:', tokenError.message);
        // Token is invalid, show only public tournaments
        query = { isPublic: true };
      }
    } else {
      console.log('User is not logged in, showing public tournaments');
      // User is not logged in, show only public tournaments
      query = { isPublic: true };
    }
    
    console.log('Final query:', JSON.stringify(query));
    
    const tournaments = await Tournament.find(query)
      .populate('organizer', 'username email role')
      .sort({ startDate: -1 });
    
    // Log tournament ownership information for debugging
    tournaments.forEach(tournament => {
      console.log(`Tournament: ${tournament.name}, organizer: ${tournament.organizer ? tournament.organizer.username : 'Unknown'}, role: ${tournament.organizer ? tournament.organizer.role : 'Unknown'}, isPublic: ${tournament.isPublic}`);
    });
    
    res.status(200).json({
      success: true,
      count: tournaments.length,
      data: tournaments
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Get single tournament
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching tournament details for ID:', req.params.id);
    
    const tournament = await Tournament.findById(req.params.id)
      .populate('organizer', 'username email role')
      .populate({
        path: 'participants.player',
        select: 'firstName lastName email chessRating'
      });
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Check if tournament is private and user is authorized to view it
    if (tournament.isPublic === false) {
      // Check if the request includes an authorization token
      const authHeader = req.headers.authorization;
      let userId = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          // Verify the token and get the user ID
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.id;
          
          // Check if user is the organizer of this tournament
          if (!tournament.organizer || tournament.organizer._id.toString() !== userId) {
            console.log('User is not authorized to view this private tournament');
            return res.status(403).json({
              success: false,
              error: 'Not authorized to view this tournament'
            });
          }
        } catch (tokenError) {
          console.error('Invalid token, access denied:', tokenError.message);
          return res.status(403).json({
            success: false,
            error: 'Not authorized to view this tournament'
          });
        }
      } else {
        console.log('User is not logged in, access denied to private tournament');
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view this tournament'
        });
      }
    }
    
    // Get matches for this tournament
    const matches = await Match.find({ tournament: req.params.id })
      .populate('whitePlayer', 'firstName lastName')
      .populate('blackPlayer', 'firstName lastName')
      .sort({ round: 1, board: 1 });
    
    console.log(`Found tournament: ${tournament.name}, organizer: ${tournament.organizer ? tournament.organizer.username : 'Unknown'}, role: ${tournament.organizer ? tournament.organizer.role : 'Unknown'}, createdByOwner: ${tournament.createdByOwner}`);
    
    res.status(200).json({
      success: true,
      data: {
        tournament,
        matches
      }
    });
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Create new tournament
router.post('/', protect, async (req, res) => {
  try {
    console.log('Creating new tournament with data:', req.body);
    
    // Get the authentication token
    const authHeader = req.headers.authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract the token
      const token = authHeader.split(' ')[1];
      
      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get the user from the database
        user = await User.findById(decoded.id);
        console.log('User found:', user ? { id: user._id, role: user.role } : 'No user found');
      } catch (tokenError) {
        console.error('Invalid token:', tokenError.message);
      }
    }
    
    // Validate required fields
    const { name, location, startDate, endDate, rounds } = req.body;
    
    if (!name || !location || !startDate || !endDate || !rounds) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, location, startDate, endDate, and rounds'
      });
    }
    
    // Find a default user to use as organizer if no authenticated user
    let organizerId;
    let isOwner = false;
    
    if (user) {
      organizerId = user._id;
      isOwner = user.role === 'owner';
      console.log('Using authenticated user as organizer:', { id: organizerId, isOwner });
    } else {
      // Try to find an admin user
      const adminUser = await User.findOne({ role: 'admin' });
      
      if (adminUser) {
        organizerId = adminUser._id;
        console.log('Using admin user as organizer:', { id: organizerId });
      } else {
        // Try to find any user
        const anyUser = await User.findOne({});
        
        if (anyUser) {
          organizerId = anyUser._id;
          console.log('Using any user as organizer:', { id: organizerId });
        } else {
          // Create a default user if none exists
          const defaultUser = await User.create({
            username: 'defaultadmin',
            email: 'admin@example.com',
            password: 'password123',
            firstName: 'Default',
            lastName: 'Admin',
            role: 'admin'
          });
          
          organizerId = defaultUser._id;
          console.log('Created default user as organizer:', { id: organizerId });
        }
      }
    }
    
    // Create tournament with user as organizer
    const tournament = await Tournament.create({
      ...req.body,
      organizer: organizerId,
      createdByOwner: isOwner
    });
    
    console.log('Tournament created successfully:', { 
      id: tournament._id, 
      organizer: tournament.organizer,
      createdByOwner: tournament.createdByOwner
    });
    
    res.status(201).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        error: messages
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server Error: ' + error.message
      });
    }
  }
});

// Update tournament
router.put('/:id', protect, async (req, res) => {
  try {
    console.log('Updating tournament:', req.params.id);
    console.log('Update data:', JSON.stringify(req.body));
    console.log('User:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');
    
    let tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      console.log('Tournament not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('Tournament found:', {
      id: tournament._id,
      name: tournament.name,
      organizer: tournament.organizer,
      createdByOwner: tournament.createdByOwner
    });
    
    // Check if user is authorized to update this tournament
    const isOrganizer = tournament.organizer && 
      (tournament.organizer.toString() === req.user.id || 
       (tournament.organizer._id && tournament.organizer._id.toString() === req.user.id));
    const isOwner = req.user.role === 'owner';
    const isTournamentCreatedByOwner = tournament.createdByOwner === true;
    
    console.log('Authorization check:', {
      isOrganizer,
      isOwner,
      isTournamentCreatedByOwner,
      organizerId: tournament.organizer ? (tournament.organizer._id ? tournament.organizer._id.toString() : tournament.organizer.toString()) : 'No organizer',
      userId: req.user.id,
      userRole: req.user.role
    });
    
    if (!isOrganizer && !isOwner && !isTournamentCreatedByOwner) {
      console.log('Unauthorized update attempt:');
      console.log('Tournament organizer:', tournament.organizer);
      console.log('User ID:', req.user.id);
      console.log('User role:', req.user.role);
      console.log('Tournament createdByOwner:', tournament.createdByOwner);
      
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this tournament'
      });
    }
    
    console.log('User is authorized to update this tournament');
    
    // Check if we're completing the tournament
    if (req.body.status === 'completed' && tournament.status !== 'completed') {
      console.log('Completing tournament:', tournament.name);
      
      // Check if all matches are completed
      const matches = await Match.find({ tournament: req.params.id });
      const unfinishedMatches = matches.filter(match => !match.result || match.result === '*');
      
      if (unfinishedMatches.length > 0) {
        console.log('Cannot complete tournament - unfinished matches:', unfinishedMatches.length);
        console.log('First unfinished match:', unfinishedMatches[0]);
        
        // For now, we'll allow completion even with unfinished matches
        console.log('WARNING: Completing tournament with unfinished matches');
      }
    }
    
    tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    console.log('Tournament updated successfully:', JSON.stringify(tournament));
    
    res.status(200).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error('Error updating tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Delete tournament
router.delete('/:id', protect, async (req, res) => {
  try {
    console.log('Deleting tournament:', req.params.id);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Check if user is authorized to delete this tournament
    // If user is not logged in or not the organizer, return error
    if (!req.user) {
      console.log('Unauthorized delete attempt: No user authenticated');
      return res.status(403).json({
        success: false,
        error: 'You must be logged in to delete a tournament'
      });
    }
    
    // Check if the user is the tournament organizer or has owner role
    const isOrganizer = tournament.organizer && 
      (tournament.organizer.toString() === req.user.id || 
       (tournament.organizer._id && tournament.organizer._id.toString() === req.user.id));
    const isOwner = req.user.role === 'owner';
    const isTournamentCreatedByOwner = tournament.createdByOwner === true;
    
    console.log('Authorization check for tournament deletion:', {
      isOrganizer,
      isOwner,
      isTournamentCreatedByOwner,
      organizerId: tournament.organizer ? (tournament.organizer._id ? tournament.organizer._id.toString() : tournament.organizer.toString()) : 'No organizer',
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Allow the deletion if the user is the organizer, has owner role, or the tournament was created by an owner
    if (!isOrganizer && !isOwner && !isTournamentCreatedByOwner) {
      console.log('Authorization check failed: User is not authorized to delete this tournament');
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this tournament'
      });
    }
    
    console.log('Authorization check passed: User is authorized to delete this tournament');
    
    // Delete all matches associated with this tournament
    await Match.deleteMany({ tournament: req.params.id });
    
    // Delete the tournament
    // Using findByIdAndDelete instead of remove() which is deprecated
    await Tournament.findByIdAndDelete(req.params.id);
    
    console.log('Tournament deleted successfully');
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Register player for tournament
router.post('/:id/register', protect, async (req, res) => {
  try {
    console.log('Registering player for tournament:', req.params.id);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Check if registration is open
    if (tournament.status !== 'registration') {
      return res.status(400).json({
        success: false,
        error: 'Registration is not open for this tournament'
      });
    }
    
    // Get player ID from request or use current user
    let playerId = req.body.playerId;
    
    if (!playerId && req.user) {
      playerId = req.user.id;
    }
    
    if (!playerId) {
      // If no player ID provided and no user logged in, try to find a default player
      const Player = require('../../models/Player');
      const defaultPlayer = await Player.findOne({});
      
      if (defaultPlayer) {
        playerId = defaultPlayer._id;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No player ID provided and no default player found'
        });
      }
    }
    
    // Check if player is already registered
    const isRegistered = tournament.participants.some(
      p => p.player && p.player.toString() === playerId.toString()
    );
    
    if (isRegistered) {
      return res.status(400).json({
        success: false,
        error: 'Player is already registered for this tournament'
      });
    }
    
    // Add player to participants
    tournament.participants.push({
      player: playerId,
      confirmed: true,
      paid: false,
      score: 0,
      tieBreak: 0
    });
    
    await tournament.save();
    
    console.log('Player registered successfully');
    
    res.status(200).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error('Error registering player:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Add multiple players to tournament (manual entry)
router.post('/:id/players', protect, async (req, res) => {
  try {
    console.log('Adding players to tournament:', req.params.id);
    console.log('Request body:', JSON.stringify(req.body));
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const { players } = req.body;
    
    console.log('Players from request:', JSON.stringify(players));
    
    if (!players || !Array.isArray(players) || players.length === 0) {
      console.error('Invalid players data:', players);
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of players'
      });
    }
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      console.error('Tournament not found:', req.params.id);
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('Found tournament:', tournament.name);
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing any user to add players to any tournament
    
    // Check if user is authorized to add players to this tournament
    // If user is not logged in or not the organizer, return error
    if (!req.user) {
      console.log('Unauthorized player addition attempt: No user authenticated');
      return res.status(403).json({
        success: false,
        error: 'You must be logged in to add players'
      });
    }
    
    // Check if the user is the tournament organizer or has owner role
    const isOrganizer = tournament.organizer && 
      (tournament.organizer.toString() === req.user.id || 
       (tournament.organizer._id && tournament.organizer._id.toString() === req.user.id));
    const isOwner = req.user.role === 'owner';
    const isTournamentCreatedByOwner = tournament.createdByOwner === true;
    
    console.log('Authorization check for player addition:', {
      isOrganizer,
      isOwner,
      isTournamentCreatedByOwner,
      organizerId: tournament.organizer ? (tournament.organizer._id ? tournament.organizer._id.toString() : tournament.organizer.toString()) : 'No organizer',
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Allow the addition if the user is the organizer, has owner role, or the tournament was created by an owner
    if (!isOrganizer && !isOwner && !isTournamentCreatedByOwner) {
      console.log('Authorization check failed: User is not authorized to add players to this tournament');
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add players to this tournament'
      });
    }
    
    console.log('Authorization check passed: User is authorized to add players');
    
    // Import our player data service
    const { processAndStorePlayerData } = require('../../lib/services/playerDataService');
    
    console.log('Calling processAndStorePlayerData with:', req.params.id, JSON.stringify(players));
    
    // Process and store the player data
    const result = await processAndStorePlayerData(req.params.id, players);
    
    console.log('processAndStorePlayerData result:', JSON.stringify(result));
    
    if (!result.success) {
      console.error('Failed to process player data:', result.error);
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process player data'
      });
    }
    
    console.log('Successfully added players:', result.addedCount, 'updated:', result.updatedCount);
    
    res.status(200).json({
      success: true,
      count: result.addedCount + result.updatedCount,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Error adding players to tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Upload players from file
router.post('/:id/players/upload', protect, upload.single('playersFile'), async (req, res) => {
  try {
    console.log('Uploading players file for tournament:', req.params.id);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file'
      });
    }
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing any user to upload players to any tournament
    
    // Check if user is authorized to upload players to this tournament
    // If user is not logged in or not the organizer, return error
    if (!req.user) {
      console.log('Unauthorized player upload attempt: No user authenticated');
      return res.status(403).json({
        success: false,
        error: 'You must be logged in to upload players'
      });
    }
    
    console.log('Player upload authorization check:');
    console.log('Tournament ID:', tournament._id);
    console.log('Tournament organizer:', tournament.organizer);
    console.log('User ID:', req.user.id);
    console.log('User role:', req.user.role);
    console.log('Tournament createdByOwner:', tournament.createdByOwner);
    
    // Check if the user is the tournament organizer or has owner role
    const isOrganizer = tournament.organizer && 
      (tournament.organizer.toString() === req.user.id || 
       (tournament.organizer._id && tournament.organizer._id.toString() === req.user.id));
    const isOwner = req.user.role === 'owner';
    const isTournamentCreatedByOwner = tournament.createdByOwner === true;
    
    console.log('Is organizer:', isOrganizer);
    console.log('Is owner:', isOwner);
    console.log('Is tournament created by owner:', isTournamentCreatedByOwner);
    
    // Allow the upload if the user is the organizer, has owner role, or the tournament was created by an owner
    if (!isOrganizer && !isOwner && !isTournamentCreatedByOwner) {
      console.log('Authorization check failed: User is not authorized to upload players to this tournament');
      return res.status(403).json({
        success: false,
        error: 'Not authorized to upload players to this tournament'
      });
    }
    
    console.log('Authorization check passed: User is authorized to upload players');
    
    const filePath = req.file.path;
    console.log('File uploaded to:', filePath);
    
    // Import our file processor and player data service
    const { processFile, cleanupFile } = require('../../lib/fileProcessor');
    const { processAndStorePlayerData } = require('../../lib/services/playerDataService');
    
    // Process the file to extract player data
    const fileData = await processFile(filePath);
    console.log('Extracted player data:', fileData);
    
    // Clean up the file after processing
    cleanupFile(filePath);
    
    if (fileData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid players found in the file'
      });
    }
    
    // Process and store the player data
    const result = await processAndStorePlayerData(req.params.id, fileData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process player data'
      });
    }
    
    res.status(200).json({
      success: true,
      count: result.addedCount + result.updatedCount,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      data: {
        tournament
      }
    });
  } catch (error) {
    console.error('Error uploading players to tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Generate pairings for next round
router.post('/:id/pairings', protect, async (req, res) => {
  try {
    console.log('Generating pairings for tournament:', req.params.id);
    console.log('User:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');
    
    const tournament = await Tournament.findById(req.params.id)
      .populate('participants.player');
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('Tournament found:', {
      id: tournament._id,
      name: tournament.name,
      organizer: tournament.organizer,
      createdByOwner: tournament.createdByOwner
    });
    
    // Check if user is authorized to generate pairings for this tournament
    const isOrganizer = tournament.organizer && 
      (tournament.organizer.toString() === req.user.id || 
       (tournament.organizer._id && tournament.organizer._id.toString() === req.user.id));
    const isOwner = req.user.role === 'owner';
    const isTournamentCreatedByOwner = tournament.createdByOwner === true;
    
    console.log('Authorization check:', {
      isOrganizer,
      isOwner,
      isTournamentCreatedByOwner,
      organizerId: tournament.organizer ? (tournament.organizer._id ? tournament.organizer._id.toString() : tournament.organizer.toString()) : 'No organizer',
      userId: req.user.id,
      userRole: req.user.role
    });
    
    if (!isOrganizer && !isOwner && !isTournamentCreatedByOwner) {
      console.log('Unauthorized pairings generation attempt:');
      console.log('Tournament organizer:', tournament.organizer);
      console.log('User ID:', req.user.id);
      console.log('User role:', req.user.role);
      console.log('Tournament createdByOwner:', tournament.createdByOwner);
      
      return res.status(403).json({
        success: false,
        error: 'Not authorized to generate pairings for this tournament'
      });
    }
    
    console.log('User is authorized to generate pairings for this tournament');
    
    // Check if tournament is active
    if (tournament.status !== 'active') {
      console.log('Tournament is not active, updating status to active');
      tournament.status = 'active';
      await tournament.save();
    }
    
    // Check if all matches from previous round are completed
    if (tournament.currentRound > 0) {
      const previousMatches = await Match.find({
        tournament: req.params.id,
        round: tournament.currentRound
      });
      
      const allCompleted = previousMatches.every(match => match.result !== '*');
      
      if (!allCompleted) {
        return res.status(400).json({
          success: false,
          error: 'All matches from the previous round must be completed'
        });
      }
    }
    
    // Check if we have enough participants
    if (!tournament.participants || tournament.participants.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Tournament needs at least 2 participants to generate pairings'
      });
    }
    
    // Filter out participants without player references
    const validParticipants = tournament.participants.filter(p => p.player && p.player._id);
    
    if (validParticipants.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Tournament needs at least 2 valid participants to generate pairings'
      });
    }
    
    // Increment current round
    tournament.currentRound += 1;
    
    // Check if tournament is complete
    if (tournament.currentRound > tournament.rounds) {
      tournament.status = 'completed';
      await tournament.save();
      
      return res.status(400).json({
        success: false,
        error: 'Tournament has reached the maximum number of rounds'
      });
    }
    
    console.log(`Generating pairings for round ${tournament.currentRound}`);
    
    // Create a map of player IDs to player objects for quick lookup
    const playerMap = new Map();
    validParticipants.forEach(p => {
      if (p.player && p.player._id) {
        playerMap.set(p.player._id.toString(), p.player);
      }
    });
    
    // Prepare players for pairing algorithm
    const players = validParticipants.map(p => ({
      id: p.player._id,
      name: `${p.player.firstName || ''} ${p.player.lastName || ''}`.trim(),
      score: p.score || 0,
      previousOpponents: [], // We'll populate this from previous matches
      colorHistory: [] // We'll populate this from previous matches
    }));
    
    console.log(`Prepared ${players.length} players for pairing`);
    
    // Get previous matches to determine previous opponents and color history
    const previousMatches = await Match.find({
      tournament: req.params.id,
      round: { $lt: tournament.currentRound }
    });
    
    console.log(`Found ${previousMatches.length} previous matches`);
    
    // Populate previous opponents and color history
    for (const match of previousMatches) {
      if (!match.whitePlayer || !match.blackPlayer) {
        console.log('Skipping match with missing players:', match);
        continue;
      }
      
      const whitePlayerIndex = players.findIndex(p => 
        p.id && match.whitePlayer && p.id.toString() === match.whitePlayer.toString()
      );
      
      const blackPlayerIndex = players.findIndex(p => 
        p.id && match.blackPlayer && p.id.toString() === match.blackPlayer.toString()
      );
      
      if (whitePlayerIndex !== -1 && blackPlayerIndex !== -1) {
        players[whitePlayerIndex].previousOpponents = players[whitePlayerIndex].previousOpponents || [];
        players[whitePlayerIndex].previousOpponents.push(match.blackPlayer);
        players[whitePlayerIndex].colorHistory = players[whitePlayerIndex].colorHistory || [];
        players[whitePlayerIndex].colorHistory.push('white');
        
        players[blackPlayerIndex].previousOpponents = players[blackPlayerIndex].previousOpponents || [];
        players[blackPlayerIndex].previousOpponents.push(match.whitePlayer);
        players[blackPlayerIndex].colorHistory = players[blackPlayerIndex].colorHistory || [];
        players[blackPlayerIndex].colorHistory.push('black');
      }
    }
    
    // Generate pairings
    let pairingResult;
    if (tournament.pairingAlgorithm === 'swiss') {
      pairingResult = generateSwissPairings(players, tournament.currentRound);
    } else if (tournament.pairingAlgorithm === 'doubleSwiss') {
      pairingResult = generateDoubleSwissPairings(players, tournament.currentRound);
    } else if (tournament.pairingAlgorithm === 'roundRobin') {
      // Check if this is a double round robin
      const isDoubleRoundRobin = tournament.roundRobinType === 'double';
      pairingResult = generateRoundRobinPairings(players, tournament.currentRound, isDoubleRoundRobin);
    } else if (tournament.pairingAlgorithm === 'knockout') {
      pairingResult = generateKnockoutPairings(players, tournament.currentRound);
    } else if (tournament.pairingAlgorithm === 'scheveningen') {
      // For Scheveningen, we need to designate teams
      if (!tournament.teamDesignation) {
        return res.status(400).json({
          success: false,
          error: 'Scheveningen system requires team designation to be enabled'
        });
      }
      // Split players into two teams (by default, use the first half as team A)
      const teamSize = Math.floor(players.length / 2);
      const teamA = players.slice(0, teamSize);
      const teamB = players.slice(teamSize);
      
      pairingResult = generateScheveningenPairings(teamA, teamB, tournament.currentRound);
    } else if (tournament.pairingAlgorithm === 'monrad') {
      pairingResult = generateMonradPairings(players, tournament.currentRound);
    } else if (tournament.pairingAlgorithm === 'random') {
      pairingResult = generateRandomPairings(players, tournament.currentRound);
    } else if (tournament.pairingAlgorithm === 'accelerated') {
      // Add player ratings for accelerated pairings if available
      const playersWithRatings = players.map(p => {
        const participant = validParticipants.find(vp => 
          vp.player._id.toString() === p.id.toString()
        );
        return {
          ...p,
          rating: participant && participant.player.rating ? participant.player.rating : 1500
        };
      });
      pairingResult = generateAcceleratedPairings(playersWithRatings, tournament.currentRound);
    } else {
      // Default to Swiss if no algorithm is specified
      console.log('No pairing algorithm specified, defaulting to Swiss');
      pairingResult = generateSwissPairings(players, tournament.currentRound);
    }
    
    // Check if there was an error in pairing
    if (pairingResult.error) {
      console.error('Pairing error:', pairingResult.error.message);
      return res.status(400).json({
        success: false,
        error: pairingResult.error.message
      });
    }
    
    const pairings = pairingResult.pairings;
    
    if (!pairings || pairings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Failed to generate pairings. Please check that you have enough players.'
      });
    }
    
    console.log(`Generated ${pairings.length} pairings`);
    
    // Create match documents
    const matches = [];
    
    for (const pairing of pairings) {
      if (!pairing.whitePlayer) {
        console.log('Skipping invalid pairing:', pairing);
        continue;
      }
      
      // Handle bye
      if (pairing.isBye) {
        console.log('Creating bye match for player:', pairing.whitePlayer);
        
        // Create a match with only one player (the one who gets the bye)
        const match = await Match.create({
          tournament: tournament._id,
          round: tournament.currentRound,
          board: pairing.board,
          whitePlayer: pairing.whitePlayer,
          blackPlayer: null, // null indicates a bye
          result: 'BYE', // Special result for byes
          isBye: true
        });
        
        matches.push(match);
        
        // Award a point to the player who gets the bye
        const participant = tournament.participants.find(p => 
          p.player && p.player._id && p.player._id.toString() === pairing.whitePlayer.toString()
        );
        
        if (participant) {
          participant.score = (participant.score || 0) + 1;
          console.log(`Awarded bye point to player ${pairing.whitePlayer}, new score: ${participant.score}`);
        }
        
        continue;
      }
      
      // Regular match
      if (!pairing.blackPlayer) {
        console.log('Skipping invalid pairing:', pairing);
        continue;
      }
      
      const match = await Match.create({
        tournament: tournament._id,
        round: tournament.currentRound,
        board: pairing.board,
        whitePlayer: pairing.whitePlayer,
        blackPlayer: pairing.blackPlayer,
        result: '*'
      });
      
      matches.push(match);
    }
    
    // Save tournament with updated current round
    await tournament.save();
    
    console.log('Pairings generated successfully:', matches.length);
    
    // Populate player data in the matches
    const populatedMatches = await Match.find({ tournament: tournament._id, round: tournament.currentRound })
      .populate('whitePlayer', 'firstName lastName chessRating')
      .populate('blackPlayer', 'firstName lastName chessRating');
    
    res.status(200).json({
      success: true,
      data: {
        tournament,
        matches: populatedMatches
      }
    });
  } catch (error) {
    console.error('Error generating pairings:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Record match result
router.put('/matches/:id', protect, async (req, res) => {
  try {
    console.log('Recording match result for match:', req.params.id);
    console.log('Result:', req.body.result);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const { result } = req.body;
    
    // Convert frontend result format to database format
    let dbResult;
    switch (result) {
      case 'white':
        dbResult = '1-0';
        break;
      case 'black':
        dbResult = '0-1';
        break;
      case 'draw':
        dbResult = '1/2-1/2';
        break;
      default:
        dbResult = '*';
    }
    
    if (!['1-0', '0-1', '1/2-1/2', '*'].includes(dbResult)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid result'
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }
    
    // Get tournament with populated player data
    const tournament = await Tournament.findById(match.tournament)
      .populate('participants.player', 'firstName lastName chessRating');
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing anyone to record match results
    
    // Check if user is authorized to record match results for this tournament
    // If user is not logged in or not the organizer, return error
    if (!req.user) {
      console.log('Unauthorized match result recording attempt: No user authenticated');
      return res.status(403).json({
        success: false,
        error: 'You must be logged in to record match results'
      });
    }
    
    // Check if the user is the tournament organizer or has owner role
    const isOrganizer = tournament.organizer && 
      (tournament.organizer.toString() === req.user.id || 
       (tournament.organizer._id && tournament.organizer._id.toString() === req.user.id));
    const isOwner = req.user.role === 'owner';
    const isTournamentCreatedByOwner = tournament.createdByOwner === true;
    
    console.log('Authorization check for match result:', {
      isOrganizer,
      isOwner,
      isTournamentCreatedByOwner,
      organizerId: tournament.organizer ? (tournament.organizer._id ? tournament.organizer._id.toString() : tournament.organizer.toString()) : 'No organizer',
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Allow the update if the user is the organizer, has owner role, or the tournament was created by an owner
    if (!isOrganizer && !isOwner && !isTournamentCreatedByOwner) {
      console.log('Authorization check failed: User is not authorized to record match results for this tournament');
      return res.status(403).json({
        success: false,
        error: 'Not authorized to record match results for this tournament'
      });
    }
    
    console.log('Authorization check passed: User is authorized to record match results');
    
    // Check if the result is already set and is the same
    if (match.result === dbResult) {
      console.log('Match result already set to', dbResult);
      
      // Return the updated match with populated player data
      const updatedMatch = await Match.findById(req.params.id)
        .populate('whitePlayer', 'firstName lastName chessRating')
        .populate('blackPlayer', 'firstName lastName chessRating');
      
      return res.status(200).json({
        success: true,
        data: {
          match: updatedMatch,
          tournament: tournament
        }
      });
    }
    
    // Find player indices
    const whitePlayerIndex = tournament.participants.findIndex(
      p => p.player && p.player._id.toString() === match.whitePlayer.toString()
    );
    
    const blackPlayerIndex = tournament.participants.findIndex(
      p => p.player && p.player._id.toString() === match.blackPlayer.toString()
    );
    
    console.log('White player index:', whitePlayerIndex);
    console.log('Black player index:', blackPlayerIndex);
    
    // If the match already had a result, we need to revert the previous score changes
    if (match.result !== '*' && whitePlayerIndex !== -1 && blackPlayerIndex !== -1) {
      console.log('Reverting previous result:', match.result);
      
      // Revert previous result
      if (match.result === '1-0') {
        tournament.participants[whitePlayerIndex].score -= 1;
        tournament.participants[whitePlayerIndex].wins -= 1;
        // Revert other tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak -= 0.5;
        tournament.participants[blackPlayerIndex].tieBreak -= 0.5;
      } else if (match.result === '0-1') {
        tournament.participants[blackPlayerIndex].score -= 1;
        tournament.participants[blackPlayerIndex].wins -= 1;
        if (match.blackPlayer) {
          tournament.participants[blackPlayerIndex].blackWins -= 1;
        }
        // Revert other tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak -= 0.5;
        tournament.participants[blackPlayerIndex].tieBreak -= 0.5;
      } else if (match.result === '1/2-1/2') {
        tournament.participants[whitePlayerIndex].score -= 0.5;
        tournament.participants[blackPlayerIndex].score -= 0.5;
        // Revert other tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak -= 0.5;
        tournament.participants[blackPlayerIndex].tieBreak -= 0.5;
      }
    }
    
    // Update match result
    match.result = dbResult;
    await match.save();
    
    // Update player scores and tiebreaks
    if (dbResult !== '*' && whitePlayerIndex !== -1 && blackPlayerIndex !== -1) {
      console.log('Updating scores for white player index:', whitePlayerIndex, 'and black player index:', blackPlayerIndex);
      console.log('Before update - White player score:', tournament.participants[whitePlayerIndex].score, 
                 'Black player score:', tournament.participants[blackPlayerIndex].score);
      
      if (dbResult === '1-0') {
        // Main score
        tournament.participants[whitePlayerIndex].score += 1;
        // Wins count
        tournament.participants[whitePlayerIndex].wins += 1;
        // Tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak += 0.5;
        tournament.participants[blackPlayerIndex].tieBreak += 0.5;
      } else if (dbResult === '0-1') {
        // Main score
        tournament.participants[blackPlayerIndex].score += 1;
        // Wins count
        tournament.participants[blackPlayerIndex].wins += 1;
        // Black wins
        tournament.participants[blackPlayerIndex].blackWins += 1;
        // Tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak += 0.5;
        tournament.participants[blackPlayerIndex].tieBreak += 0.5;
      } else if (dbResult === '1/2-1/2') {
        // Main score
        tournament.participants[whitePlayerIndex].score += 0.5;
        tournament.participants[blackPlayerIndex].score += 0.5;
        // Tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak += 0.5;
        tournament.participants[blackPlayerIndex].tieBreak += 0.5;
      }
      
      console.log('After update - White player score:', tournament.participants[whitePlayerIndex].score, 
                 'Black player score:', tournament.participants[blackPlayerIndex].score);
    } else {
      console.log('Could not find players in tournament participants. White player index:', whitePlayerIndex, 
                 'Black player index:', blackPlayerIndex);
    }
    
    // Update tournament with match results and calculate tiebreaks
    const previousMatches = await Match.find({
      tournament: tournament._id,
      round: { $lte: match.round }
    });
    await calculateTiebreaks(tournament, previousMatches);
    
    // Save the tournament with updated scores
    await tournament.save();
    
    // Get the updated tournament with populated participants
    const updatedTournament = await Tournament.findById(tournament._id)
      .populate('participants.player', 'firstName lastName chessRating');
    
    console.log('Tournament saved with updated scores');
    console.log('Updated tournament participants:', updatedTournament.participants.map(p => ({ 
      name: p.player ? `${p.player.firstName} ${p.player.lastName}` : 'null', 
      score: p.score,
      buchholz: p.buchholz,
      buchholzCut1: p.buchholzCut1,
      sonnebornBerger: p.sonnebornBerger,
      progressiveScore: p.progressiveScore,
      wins: p.wins,
      blackWins: p.blackWins
    })));
    
    // Return the updated match with populated player data
    const updatedMatch = await Match.findById(req.params.id)
      .populate('whitePlayer', 'firstName lastName chessRating')
      .populate('blackPlayer', 'firstName lastName chessRating');
    
    console.log('Match result recorded successfully');
    
    res.status(200).json({
      success: true,
      data: {
        match: updatedMatch,
        tournament: updatedTournament
      }
    });
  } catch (error) {
    console.error('Error recording match result:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Remove player from tournament
router.delete('/:id/players/:playerId', protect, async (req, res) => {
  try {
    console.log('Removing player from tournament:', req.params.id);
    console.log('Player ID:', req.params.playerId);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing any user to remove players from any tournament
    
    // Check if user is authorized to remove players from this tournament
    if (!req.user) {
      console.log('Unauthorized player removal attempt: No user authenticated');
      return res.status(403).json({
        success: false,
        error: 'You must be logged in to remove players'
      });
    }
    
    // Check if the user is the tournament organizer or has owner role
    const isOrganizer = tournament.organizer && 
      (tournament.organizer.toString() === req.user.id || 
       (tournament.organizer._id && tournament.organizer._id.toString() === req.user.id));
    const isOwner = req.user.role === 'owner';
    const isTournamentCreatedByOwner = tournament.createdByOwner === true;
    
    console.log('Authorization check for player removal:', {
      isOrganizer,
      isOwner,
      isTournamentCreatedByOwner,
      organizerId: tournament.organizer ? (tournament.organizer._id ? tournament.organizer._id.toString() : tournament.organizer.toString()) : 'No organizer',
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Allow the removal if the user is the organizer, has owner role, or the tournament was created by an owner
    if (!isOrganizer && !isOwner && !isTournamentCreatedByOwner) {
      console.log('Authorization check failed: User is not authorized to remove players from this tournament');
      return res.status(403).json({
        success: false,
        error: 'Not authorized to remove players from this tournament'
      });
    }
    
    console.log('Authorization check passed: User is authorized to remove players');
    
    // Check if tournament is in registration phase
    if (tournament.status !== 'registration') {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove players after tournament has started'
      });
    }
    
    // Find player in participants
    const playerIndex = tournament.participants.findIndex(
      p => p.player && p.player.toString() === req.params.playerId
    );
    
    if (playerIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Player not found in tournament'
      });
    }
    
    // Remove player from participants
    tournament.participants.splice(playerIndex, 1);
    
    await tournament.save();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error removing player from tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Get tournament statistics
router.get('/statistics', async (req, res) => {
  try {
    console.log('Getting tournament statistics');
    
    // Get all tournaments with organizer information
    const tournaments = await Tournament.find().populate('organizer', 'username role');
    
    // Count tournaments by status
    const totalTournaments = tournaments.length;
    const registrationTournaments = tournaments.filter(t => t.status === 'registration').length;
    const ongoingTournaments = tournaments.filter(t => t.status === 'active').length;
    const completedTournaments = tournaments.filter(t => t.status === 'completed').length;
    
    // Count tournaments by owner
    const ownerTournaments = tournaments.filter(t => {
      // Check both the createdByOwner flag and the organizer's role
      return t.createdByOwner === true || (t.organizer && t.organizer.role === 'owner');
    }).length;
    
    const userTournaments = totalTournaments - ownerTournaments;
    
    console.log(`Tournament counts - Total: ${totalTournaments}, Owner: ${ownerTournaments}, User: ${userTournaments}`);
    
    // Count total participants
    const totalParticipants = tournaments.reduce((sum, tournament) => {
      return sum + (tournament.participants ? tournament.participants.length : 0);
    }, 0);
    
    // Count participants in owner tournaments
    const ownerTournamentParticipants = tournaments
      .filter(t => t.createdByOwner === true || (t.organizer && t.organizer.role === 'owner'))
      .reduce((sum, tournament) => {
        return sum + (tournament.participants ? tournament.participants.length : 0);
      }, 0);
    
    // Count participants in user tournaments
    const userTournamentParticipants = totalParticipants - ownerTournamentParticipants;
    
    console.log(`Participant counts - Total: ${totalParticipants}, Owner tournaments: ${ownerTournamentParticipants}, User tournaments: ${userTournamentParticipants}`);
    
    // Return statistics
    res.status(200).json({
      success: true,
      data: {
        totalTournaments,
        registrationTournaments,
        ongoingTournaments,
        completedTournaments,
        ownerTournaments,
        userTournaments,
        totalParticipants,
        ownerTournamentParticipants,
        userTournamentParticipants
      }
    });
  } catch (error) {
    console.error('Error getting tournament statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Get tournament statistics for the current user
router.get('/statistics', async (req, res) => {
  try {
    console.log('Statistics endpoint called');
    // Check if the request includes an authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token and get the user ID
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id || decoded.userId; // Handle both formats
      console.log('User ID from token:', userId);
    } catch (error) {
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
    
    // Find all tournaments created by the user
    const tournaments = await Tournament.find({ createdBy: userId });
    console.log(`Found ${tournaments.length} tournaments for user ${userId}`);
    
    // Count tournaments by status
    const statistics = {
      total: tournaments.length,
      ongoing: 0,
      notStarted: 0,
      finished: 0
    };
    
    // Categorize tournaments
    tournaments.forEach(tournament => {
      if (tournament.status === 'completed') {
        statistics.finished++;
      } else if (tournament.status === 'in_progress') {
        statistics.ongoing++;
      } else {
        statistics.notStarted++;
      }
    });
    
    console.log('Tournament statistics:', statistics);
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching tournament statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
