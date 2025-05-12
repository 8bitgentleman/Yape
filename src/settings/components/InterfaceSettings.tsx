import React, { useState } from 'react';

interface InterfaceSettingsProps {
  settings: {
    showCompleted: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    backgroundCheckInterval: number;
  };
  onSave: (settings: {
    showCompleted: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    backgroundCheckInterval: number;
  }) => void;
}

/**
 * Form for interface settings
 */
const InterfaceSettings: React.FC<InterfaceSettingsProps> = ({
  settings,
  onSave
}) => {
  // Form state
  const [formState, setFormState] = useState(settings);

  // Handle checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Handle number input change
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numberValue = parseInt(value, 10);
    
    setFormState(prev => ({
      ...prev,
      [name]: isNaN(numberValue) ? 0 : numberValue
    }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formState);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Show completed downloads */}
      <div className="form-check mb-3">
        <input
          type="checkbox"
          id="showCompleted"
          name="showCompleted"
          className="form-check-input"
          checked={formState.showCompleted}
          onChange={handleCheckboxChange}
        />
        <label className="form-check-label" htmlFor="showCompleted">
          Show completed downloads
        </label>
        <div className="form-text">
          Display completed downloads in the popup
        </div>
      </div>
      
      {/* Auto refresh */}
      <div className="form-check mb-3">
        <input
          type="checkbox"
          id="autoRefresh"
          name="autoRefresh"
          className="form-check-input"
          checked={formState.autoRefresh}
          onChange={handleCheckboxChange}
        />
        <label className="form-check-label" htmlFor="autoRefresh">
          Auto refresh
        </label>
        <div className="form-text">
          Automatically refresh download status
        </div>
      </div>
      
      {/* Refresh interval */}
      <div className="mb-3">
        <label htmlFor="refreshInterval" className="form-label">
          Refresh interval (ms)
        </label>
        <input
          type="number"
          id="refreshInterval"
          name="refreshInterval"
          className="form-control"
          value={formState.refreshInterval}
          onChange={handleNumberChange}
          min={1000}
          max={60000}
          step={1000}
          disabled={!formState.autoRefresh}
        />
        <div className="form-text">
          Interval between refreshes in milliseconds (1000 ms = 1 second)
        </div>
      </div>
      
      {/* Background check interval */}
      <div className="mb-3">
        <label htmlFor="backgroundCheckInterval" className="form-label">
          Background check interval (seconds)
        </label>
        <input
          type="number"
          id="backgroundCheckInterval"
          name="backgroundCheckInterval"
          className="form-control"
          value={formState.backgroundCheckInterval / 1000} // Convert ms to seconds for UI
          onChange={(e) => {
            const seconds = parseInt(e.target.value, 10);
            const ms = isNaN(seconds) ? 60000 : seconds * 1000; // Convert to ms
            setFormState(prev => ({
              ...prev,
              backgroundCheckInterval: ms
            }));
          }}
          min={30}
          max={3600}
          step={10}
        />
        <div className="form-text">
          Interval between background checks for finished downloads (in seconds)
        </div>
      </div>
      
      {/* Submit button */}
      <div className="d-flex justify-content-end">
        <button
          type="submit"
          className="btn btn-primary"
        >
          Save Settings
        </button>
      </div>
    </form>
  );
};

export default InterfaceSettings;
