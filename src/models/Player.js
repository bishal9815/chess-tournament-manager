const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PlayerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: false,
    trim: true
  },
  lastName: {
    type: String,
    required: false,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ],
    validate: {
      validator: function(v) {
        // Allow empty email
        return v === '' || v === null || v === undefined || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  chessRating: {
    type: Number,
    min: 0,
    max: 3000
  },
  location: {
    type: String,
    trim: true
  },
  chesscomUsername: {
    type: String,
    trim: true
  },
  lichessUsername: {
    type: String,
    trim: true
  },
  fideId: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  birthYear: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear()
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', '']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
PlayerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full name
PlayerSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

module.exports = mongoose.model('Player', PlayerSchema); 