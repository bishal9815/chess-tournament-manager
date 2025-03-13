/**
 * Player Data Service Test Script
 * 
 * This script tests the player data processing system with various scenarios.
 * Run with: node src/tests/playerDataService.test.js
 */

// Mock the database connection and models
const mockUser = {
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn()
};

// Mock the Chess.com API
const mockChessComApi = {
  batchGetPlayerInfo: jest.fn()
};

// Set up mocks
jest.mock('../../models/User', () => mockUser);
jest.mock('../lib/chessComApi', () => mockChessComApi);

// Import the services to test
const { validatePlayer, validatePlayers } = require('../lib/validation/playerValidation');
const { normalizePlayer, normalizePlayers } = require('../lib/normalization/playerNormalization');
const { deduplicatePlayers } = require('../lib/deduplication/playerDeduplication');
const { processManualPlayerData } = require('../lib/services/playerDataService');

// Test data
const validPlayers = [
  {
    name: 'John Smith',
    email: 'john.smith@example.com',
    rating: 1850,
    chesscomUsername: 'JSmith123'
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    rating: 1720,
    chesscomUsername: 'SarahChess'
  }
];

const invalidPlayers = [
  {
    // Missing name
    email: 'invalid@example.com',
    rating: 1500
  },
  {
    name: 'Invalid Rating',
    email: 'invalid.rating@example.com',
    rating: 'not a number'
  },
  {
    name: 'Invalid Email',
    email: 'not-an-email',
    rating: 1600
  }
];

const duplicatePlayers = [
  {
    name: 'John Smith',
    email: 'john.smith@example.com',
    rating: 1850
  },
  {
    name: 'Johnny Smith',
    email: 'john.smith@example.com', // Same email
    rating: 1900
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    rating: 1720
  }
];

const mixedCasePlayers = [
  {
    name: 'john smith',
    email: 'JOHN.SMITH@example.com',
    rating: 1850
  },
  {
    name: 'SARAH JOHNSON',
    email: 'sarah.j@example.com',
    rating: 1720
  }
];

// Mock Chess.com API response
mockChessComApi.batchGetPlayerInfo.mockResolvedValue([
  {
    username: 'JSmith123',
    name: 'John Smith',
    rating: 1900,
    country: 'US'
  },
  {
    username: 'SarahChess',
    name: 'Sarah Johnson',
    rating: 1750,
    country: 'UK'
  }
]);

// Mock User model responses
mockUser.findOne.mockImplementation((query) => {
  if (query.email === 'john.smith@example.com') {
    return Promise.resolve({
      _id: '123',
      username: 'johnsmith',
      email: 'john.smith@example.com',
      firstName: 'John',
      lastName: 'Smith',
      chessRating: 1850
    });
  }
  return Promise.resolve(null);
});

mockUser.create.mockImplementation((data) => {
  return Promise.resolve({
    _id: `new_${Date.now()}`,
    ...data
  });
});

mockUser.findByIdAndUpdate.mockImplementation((id, updates) => {
  return Promise.resolve({
    _id: id,
    ...updates
  });
});

// Test functions
async function runTests() {
  console.log('🧪 Running Player Data Service Tests\n');
  
  // Test 1: Validation
  console.log('Test 1: Player Validation');
  const validationResult = validatePlayers([...validPlayers, ...invalidPlayers]);
  console.log(`✓ Valid players: ${validationResult.validPlayers.length}`);
  console.log(`✓ Invalid players: ${validationResult.invalidPlayers.length}`);
  console.log('');
  
  // Test 2: Normalization
  console.log('Test 2: Player Normalization');
  const normalizedPlayers = normalizePlayers(mixedCasePlayers);
  console.log(`✓ Original: ${mixedCasePlayers[0].name} -> Normalized: ${normalizedPlayers[0].name}`);
  console.log(`✓ Original: ${mixedCasePlayers[1].name} -> Normalized: ${normalizedPlayers[1].name}`);
  console.log('');
  
  // Test 3: Deduplication
  console.log('Test 3: Player Deduplication');
  const { deduplicatedPlayers, duplicateGroups } = deduplicatePlayers(duplicatePlayers);
  console.log(`✓ Original count: ${duplicatePlayers.length}`);
  console.log(`✓ Deduplicated count: ${deduplicatedPlayers.length}`);
  console.log(`✓ Duplicate groups: ${duplicateGroups.length}`);
  console.log('');
  
  // Test 4: Full processing pipeline
  console.log('Test 4: Full Processing Pipeline');
  const processResult = await processManualPlayerData([
    ...validPlayers,
    ...invalidPlayers,
    ...duplicatePlayers
  ]);
  
  console.log(`✓ Success: ${processResult.success}`);
  console.log(`✓ Processed players: ${processResult.processedPlayers.length}`);
  console.log(`✓ Invalid players: ${processResult.invalidPlayers.length}`);
  console.log(`✓ Duplicate groups: ${processResult.duplicates.length}`);
  
  // Print a sample processed player
  if (processResult.processedPlayers.length > 0) {
    console.log('\nSample processed player:');
    console.log(JSON.stringify(processResult.processedPlayers[0], null, 2));
  }
  
  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
}); 