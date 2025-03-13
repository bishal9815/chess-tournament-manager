const React = require('react');
const { 
  validatePlayers, 
  uploadPlayerFile, 
  quickTournamentSetup 
} = require('../lib/services/tournamentSetupService');
const PlayerRegistration = require('./PlayerRegistration');

/**
 * QuickTournamentSetup Component
 * 
 * A component for quickly setting up tournaments with player import
 * and efficient player management.
 */
function QuickTournamentSetup({ onSetupComplete }) {
  // Tournament form state
  const [tournamentData, setTournamentData] = React.useState({
    name: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    rounds: 5,
    maxParticipants: 0,
    entryFee: 0,
    timeControl: 'Standard'
  });
  
  // Setup process state
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [setupResult, setSetupResult] = React.useState(null);
  
  // Player data state
  const [manualPlayers, setManualPlayers] = React.useState([]);
  const [playerFile, setPlayerFile] = React.useState(null);
  const [previewData, setPreviewData] = React.useState({
    processedPlayers: [],
    invalidPlayers: [],
    duplicates: []
  });
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  
  // Handle tournament form changes
  const handleTournamentChange = (e) => {
    const { name, value } = e.target;
    setTournamentData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle tournament form submission
  const handleTournamentSubmit = (e) => {
    e.preventDefault();
    
    // Validate tournament data
    if (!tournamentData.name) {
      setError('Tournament name is required');
      return;
    }
    
    if (!tournamentData.startDate || !tournamentData.endDate) {
      setError('Start and end dates are required');
      return;
    }
    
    if (new Date(tournamentData.startDate) > new Date(tournamentData.endDate)) {
      setError('Start date cannot be after end date');
      return;
    }
    
    if (!tournamentData.rounds || tournamentData.rounds < 1) {
      setError('Number of rounds must be at least 1');
      return;
    }
    
    // Clear errors and proceed to next step
    setError('');
    setCurrentStep(2);
  };
  
  // Handle players added from PlayerRegistration component
  const handlePlayersAdded = (players) => {
    setManualPlayers(players);
  };
  
  // Handle file selection
  const handleFileChange = (file) => {
    setPlayerFile(file);
  };
  
  // Generate preview of player data
  const generatePreview = async () => {
    setIsPreviewLoading(true);
    setError('');
    
    try {
      const previewResults = {
        processedPlayers: [],
        invalidPlayers: [],
        duplicates: []
      };
      
      // Process manual players if any
      if (manualPlayers.length > 0) {
        const manualResult = await validatePlayers(manualPlayers);
        previewResults.processedPlayers = [
          ...previewResults.processedPlayers,
          ...(manualResult.data.processedPlayers || [])
        ];
        previewResults.invalidPlayers = [
          ...previewResults.invalidPlayers,
          ...(manualResult.data.invalidPlayers || [])
        ];
        previewResults.duplicates = [
          ...previewResults.duplicates,
          ...(manualResult.data.duplicates || [])
        ];
      }
      
      // Process file if selected
      if (playerFile) {
        const fileResult = await uploadPlayerFile(playerFile);
        previewResults.processedPlayers = [
          ...previewResults.processedPlayers,
          ...(fileResult.data.processedPlayers || [])
        ];
        previewResults.invalidPlayers = [
          ...previewResults.invalidPlayers,
          ...(fileResult.data.invalidPlayers || [])
        ];
        previewResults.duplicates = [
          ...previewResults.duplicates,
          ...(fileResult.data.duplicates || [])
        ];
      }
      
      setPreviewData(previewResults);
      
      // Proceed to next step if there are valid players
      if (previewResults.processedPlayers.length > 0) {
        setCurrentStep(3);
      } else if (previewResults.invalidPlayers.length > 0) {
        setError('No valid players found. Please fix the errors and try again.');
      } else {
        setError('No players provided. Please add players manually or upload a file.');
      }
    } catch (err) {
      setError(`Error generating preview: ${err.message}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };
  
  // Handle player preview submission
  const handlePreviewSubmit = (e) => {
    e.preventDefault();
    setCurrentStep(4);
  };
  
  // Complete tournament setup
  const completeTournamentSetup = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Set tournament status to registration
      const tournamentWithStatus = {
        ...tournamentData,
        status: 'registration'
      };
      
      // Call the quick setup service
      const result = await quickTournamentSetup(
        tournamentWithStatus,
        manualPlayers,
        playerFile
      );
      
      setSetupResult(result);
      setSuccess('Tournament setup completed successfully!');
      setCurrentStep(5);
      
      // Notify parent component if provided
      if (onSetupComplete) {
        onSetupComplete(result);
      }
    } catch (err) {
      setError(`Error setting up tournament: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render step 1: Tournament details form
  const renderTournamentForm = () => (
    <div className="tournament-form-container">
      <h3>Step 1: Tournament Details</h3>
      <form onSubmit={handleTournamentSubmit}>
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Tournament Name *</label>
          <input
            type="text"
            className="form-control"
            id="name"
            name="name"
            value={tournamentData.name}
            onChange={handleTournamentChange}
            required
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="description" className="form-label">Description</label>
          <textarea
            className="form-control"
            id="description"
            name="description"
            value={tournamentData.description}
            onChange={handleTournamentChange}
            rows="3"
          ></textarea>
        </div>
        
        <div className="row mb-3">
          <div className="col-md-6">
            <label htmlFor="location" className="form-label">Location *</label>
            <input
              type="text"
              className="form-control"
              id="location"
              name="location"
              value={tournamentData.location}
              onChange={handleTournamentChange}
              required
            />
          </div>
          <div className="col-md-6">
            <label htmlFor="timeControl" className="form-label">Time Control</label>
            <select
              className="form-select"
              id="timeControl"
              name="timeControl"
              value={tournamentData.timeControl}
              onChange={handleTournamentChange}
            >
              <option value="Bullet">Bullet</option>
              <option value="Blitz">Blitz</option>
              <option value="Rapid">Rapid</option>
              <option value="Standard">Standard</option>
              <option value="Classical">Classical</option>
            </select>
          </div>
        </div>
        
        <div className="row mb-3">
          <div className="col-md-4">
            <label htmlFor="startDate" className="form-label">Start Date *</label>
            <input
              type="date"
              className="form-control"
              id="startDate"
              name="startDate"
              value={tournamentData.startDate}
              onChange={handleTournamentChange}
              required
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="endDate" className="form-label">End Date *</label>
            <input
              type="date"
              className="form-control"
              id="endDate"
              name="endDate"
              value={tournamentData.endDate}
              onChange={handleTournamentChange}
              required
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="registrationDeadline" className="form-label">Registration Deadline *</label>
            <input
              type="date"
              className="form-control"
              id="registrationDeadline"
              name="registrationDeadline"
              value={tournamentData.registrationDeadline}
              onChange={handleTournamentChange}
              required
            />
          </div>
        </div>
        
        <div className="row mb-3">
          <div className="col-md-4">
            <label htmlFor="rounds" className="form-label">Number of Rounds *</label>
            <input
              type="number"
              className="form-control"
              id="rounds"
              name="rounds"
              value={tournamentData.rounds}
              onChange={handleTournamentChange}
              min="1"
              required
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="maxParticipants" className="form-label">Max Participants</label>
            <input
              type="number"
              className="form-control"
              id="maxParticipants"
              name="maxParticipants"
              value={tournamentData.maxParticipants}
              onChange={handleTournamentChange}
              min="0"
              placeholder="0 for unlimited"
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="entryFee" className="form-label">Entry Fee</label>
            <input
              type="number"
              className="form-control"
              id="entryFee"
              name="entryFee"
              value={tournamentData.entryFee}
              onChange={handleTournamentChange}
              min="0"
              step="0.01"
            />
          </div>
        </div>
        
        <div className="d-flex justify-content-end">
          <button type="submit" className="btn btn-primary">
            Next: Add Players
          </button>
        </div>
      </form>
    </div>
  );
  
  // Render step 2: Player registration
  const renderPlayerRegistration = () => (
    <div className="player-registration-step">
      <h3>Step 2: Add Players</h3>
      <p className="text-muted">
        Add players manually or upload a file with player information.
        You can also include Chess.com usernames to automatically fetch ratings.
      </p>
      
      <PlayerRegistration
        onPlayersAdded={handlePlayersAdded}
        onFileSelected={handleFileChange}
      />
      
      <div className="d-flex justify-content-between mt-4">
        <button 
          className="btn btn-secondary" 
          onClick={() => setCurrentStep(1)}
        >
          Back
        </button>
        <button 
          className="btn btn-primary" 
          onClick={generatePreview}
          disabled={isPreviewLoading || (manualPlayers.length === 0 && !playerFile)}
        >
          {isPreviewLoading ? 'Processing...' : 'Next: Preview Players'}
        </button>
      </div>
    </div>
  );
  
  // Render step 3: Player preview
  const renderPlayerPreview = () => (
    <div className="player-preview-step">
      <h3>Step 3: Preview Players</h3>
      
      <div className="card mb-4">
        <div className="card-header bg-success text-white">
          <h4 className="card-title mb-0">Valid Players ({previewData.processedPlayers.length})</h4>
        </div>
        <div className="card-body">
          {previewData.processedPlayers.length === 0 ? (
            <p>No valid players found.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Rating</th>
                    <th>Chess.com Username</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.processedPlayers.map((player, index) => (
                    <tr key={index}>
                      <td>{player.name}</td>
                      <td>{player.email || '-'}</td>
                      <td>{player.rating || '-'}</td>
                      <td>{player.chesscomUsername || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {previewData.invalidPlayers.length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-danger text-white">
            <h4 className="card-title mb-0">Invalid Players ({previewData.invalidPlayers.length})</h4>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Original Data</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.invalidPlayers.map((invalid, index) => (
                    <tr key={index}>
                      <td>
                        <pre>{JSON.stringify(invalid.originalData, null, 2)}</pre>
                      </td>
                      <td>
                        <ul className="mb-0">
                          {Object.entries(invalid.errors || {}).map(([field, error]) => (
                            <li key={field}><strong>{field}:</strong> {error}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {previewData.duplicates.length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-warning text-dark">
            <h4 className="card-title mb-0">Potential Duplicates ({previewData.duplicates.length})</h4>
          </div>
          <div className="card-body">
            <p>
              The following players appear to be duplicates and will be merged automatically:
            </p>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Players</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.duplicates.map((group, groupIndex) => (
                    <tr key={groupIndex}>
                      <td>{groupIndex + 1}</td>
                      <td>
                        <ul className="mb-0">
                          {group.map((item, itemIndex) => (
                            <li key={itemIndex}>
                              {item.player.name} 
                              {item.player.email ? ` (${item.player.email})` : ''}
                              {item.player.chesscomUsername ? ` [${item.player.chesscomUsername}]` : ''}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      <div className="d-flex justify-content-between">
        <button 
          className="btn btn-secondary" 
          onClick={() => setCurrentStep(2)}
        >
          Back
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handlePreviewSubmit}
          disabled={previewData.processedPlayers.length === 0}
        >
          Next: Confirm Setup
        </button>
      </div>
    </div>
  );
  
  // Render step 4: Confirmation
  const renderConfirmation = () => (
    <div className="confirmation-step">
      <h3>Step 4: Confirm Tournament Setup</h3>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h4 className="card-title mb-0">Tournament Details</h4>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <p><strong>Name:</strong> {tournamentData.name}</p>
              <p><strong>Location:</strong> {tournamentData.location}</p>
              <p><strong>Time Control:</strong> {tournamentData.timeControl}</p>
              <p><strong>Rounds:</strong> {tournamentData.rounds}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Start Date:</strong> {new Date(tournamentData.startDate).toLocaleDateString()}</p>
              <p><strong>End Date:</strong> {new Date(tournamentData.endDate).toLocaleDateString()}</p>
              <p><strong>Registration Deadline:</strong> {new Date(tournamentData.registrationDeadline).toLocaleDateString()}</p>
              <p><strong>Players:</strong> {previewData.processedPlayers.length}</p>
            </div>
          </div>
          
          {tournamentData.description && (
            <div className="mt-3">
              <strong>Description:</strong>
              <p>{tournamentData.description}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="alert alert-info">
        <h5>Ready to complete setup?</h5>
        <p>
          This will create the tournament and add {previewData.processedPlayers.length} players.
          {previewData.invalidPlayers.length > 0 && ` ${previewData.invalidPlayers.length} invalid players will be skipped.`}
          {previewData.duplicates.length > 0 && ` ${previewData.duplicates.length} duplicate groups will be merged.`}
        </p>
      </div>
      
      <div className="d-flex justify-content-between">
        <button 
          className="btn btn-secondary" 
          onClick={() => setCurrentStep(3)}
        >
          Back
        </button>
        <button 
          className="btn btn-success" 
          onClick={completeTournamentSetup}
          disabled={isLoading}
        >
          {isLoading ? 'Setting Up Tournament...' : 'Complete Tournament Setup'}
        </button>
      </div>
    </div>
  );
  
  // Render step 5: Success
  const renderSuccess = () => (
    <div className="success-step">
      <div className="card border-success">
        <div className="card-header bg-success text-white">
          <h3 className="card-title mb-0">Tournament Setup Complete!</h3>
        </div>
        <div className="card-body">
          <h4>{setupResult.tournament.name}</h4>
          <p>Your tournament has been successfully created with {setupResult.tournament.participants.length} players.</p>
          
          <div className="alert alert-info">
            <h5>Summary:</h5>
            <ul>
              <li><strong>Players Added:</strong> {setupResult.manualPlayersAdded + setupResult.filePlayersAdded}</li>
              <li><strong>From Manual Entry:</strong> {setupResult.manualPlayersAdded}</li>
              <li><strong>From File Upload:</strong> {setupResult.filePlayersAdded}</li>
              <li><strong>Invalid Players Skipped:</strong> {setupResult.invalidPlayers.length}</li>
              <li><strong>Duplicate Groups Merged:</strong> {setupResult.duplicates.length}</li>
            </ul>
          </div>
          
          <div className="d-flex justify-content-between mt-4">
            <button 
              className="btn btn-primary" 
              onClick={() => window.location.href = `/tournaments/${setupResult.tournament._id}`}
            >
              View Tournament
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setCurrentStep(1);
                setTournamentData({
                  name: '',
                  description: '',
                  location: '',
                  startDate: '',
                  endDate: '',
                  registrationDeadline: '',
                  rounds: 5,
                  maxParticipants: 0,
                  entryFee: 0,
                  timeControl: 'Standard'
                });
                setManualPlayers([]);
                setPlayerFile(null);
                setPreviewData({
                  processedPlayers: [],
                  invalidPlayers: [],
                  duplicates: []
                });
                setSetupResult(null);
                setSuccess('');
                setError('');
              }}
            >
              Create Another Tournament
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="quick-tournament-setup">
      <h2 className="mb-4">Quick Tournament Setup</h2>
      
      {/* Progress indicator */}
      <div className="progress-indicator mb-4">
        <div className="progress" style={{ height: '2px' }}>
          <div 
            className="progress-bar" 
            role="progressbar" 
            style={{ width: `${(currentStep / 5) * 100}%` }}
            aria-valuenow={(currentStep / 5) * 100} 
            aria-valuemin="0" 
            aria-valuemax="100"
          ></div>
        </div>
        <div className="d-flex justify-content-between mt-2">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-circle">1</div>
            <div className="step-label">Details</div>
          </div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="step-circle">2</div>
            <div className="step-label">Players</div>
          </div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-circle">3</div>
            <div className="step-label">Preview</div>
          </div>
          <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>
            <div className="step-circle">4</div>
            <div className="step-label">Confirm</div>
          </div>
          <div className={`step ${currentStep >= 5 ? 'active' : ''}`}>
            <div className="step-circle">5</div>
            <div className="step-label">Complete</div>
          </div>
        </div>
      </div>
      
      {/* Error and success messages */}
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}
      
      {success && (
        <div className="alert alert-success">{success}</div>
      )}
      
      {/* Render current step */}
      <div className="setup-step-container">
        {currentStep === 1 && renderTournamentForm()}
        {currentStep === 2 && renderPlayerRegistration()}
        {currentStep === 3 && renderPlayerPreview()}
        {currentStep === 4 && renderConfirmation()}
        {currentStep === 5 && renderSuccess()}
      </div>
    </div>
  );
}

module.exports = QuickTournamentSetup; 