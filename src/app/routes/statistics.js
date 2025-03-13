const express = require('express');
const router = express.Router();
const Tournament = require('../../models/Tournament');
const jwt = require('jsonwebtoken');

// Get tournament statistics for the current user
router.get('/', async (req, res) => {
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
    const tournaments = await Tournament.find({ organizer: userId });
    console.log(`Found ${tournaments.length} tournaments for user ${userId}`);
    
    // Log each tournament's status
    tournaments.forEach(tournament => {
      console.log(`Tournament: ${tournament.name}, Status: ${tournament.status}`);
    });
    
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
      } else if (tournament.status === 'active' || tournament.status === 'in_progress' || tournament.status === 'ongoing') {
        statistics.ongoing++;
      } else if (tournament.status === 'registration' || tournament.status === 'not_started') {
        statistics.notStarted++;
      } else {
        // Log any unexpected status values
        console.log(`Unrecognized tournament status: ${tournament.status} for tournament ${tournament.name}`);
        // Default to notStarted for any other status
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