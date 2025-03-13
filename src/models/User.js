const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'owner'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  chessRating: {
    type: Number,
    default: 1200
  },
  chesscomUsername: {
    type: String,
    trim: true
  },
  lichessUsername: {
    type: String,
    trim: true
  },
  chesscomData: {
    type: Object,
    default: null
  },
  googleTokens: {
    type: Object,
    default: null
  },
  // New fields for social login
  googleId: {
    type: String,
    sparse: true
  },
  facebookId: {
    type: String,
    sparse: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema); 