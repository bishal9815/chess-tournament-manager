const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
const protect = async (req, res, next) => {
  try {
    console.log('Protect middleware called');
    console.log('Headers:', req.headers);
    
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Token extracted from Authorization header');
    }
    
    // Check if token exists
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified:', decoded);
      
      // Get user from token
      const user = await User.findById(decoded.id).select('+role');
      
      if (!user) {
        console.log('User not found');
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Set user in request
      req.user = user;
      console.log('User authenticated:', { id: user._id, role: user.role });
      next();
    } catch (error) {
      console.log('Token verification error:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Admin only middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

module.exports = { protect, admin }; 