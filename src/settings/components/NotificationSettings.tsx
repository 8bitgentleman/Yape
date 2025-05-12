import React, { useState } from 'react';

interface NotificationSettingsProps {
  settings: {
    enabled: boolean;
    onDownloadAdded: boolean;
    onDownloadCompleted: boolean;
    onDownloadFailed: boolean;
    soundEnabled: boolean;
  };
  onSave: (settings: {
    enabled: boolean;
    onDownloadAdded: boolean;
    onDownloadCompleted: boolean;
    onDownloadFailed: boolean;
    soundEnabled: boolean;
  }) => void;
}

/**
 * Form for notification settings
 */
const NotificationSettings: React.FC<NotificationSettingsProps> = ({
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

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formState);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Master notification toggle */}
      <div className="form-check mb-3">
        <input
          type="checkbox"
          id="notificationsEnabled"
          name="enabled"
          className="form-check-input"
          checked={formState.enabled}
          onChange={handleCheckboxChange}
        />
        <label className="form-check-label" htmlFor="notificationsEnabled">
          Enable notifications
        </label>
        <div className="form-text">
          Control whether desktop notifications are shown for download events
        </div>
      </div>
      
      <div className="ps-4">
        {/* Download added notifications */}
        <div className="form-check mb-3">
          <input
            type="checkbox"
            id="onDownloadAdded"
            name="onDownloadAdded"
            className="form-check-input"
            checked={formState.onDownloadAdded}
            onChange={handleCheckboxChange}
            disabled={!formState.enabled}
          />
          <label className="form-check-label" htmlFor="onDownloadAdded">
            When downloads are added
          </label>
        </div>
        
        {/* Download completed notifications */}
        <div className="form-check mb-3">
          <input
            type="checkbox"
            id="onDownloadCompleted"
            name="onDownloadCompleted"
            className="form-check-input"
            checked={formState.onDownloadCompleted}
            onChange={handleCheckboxChange}
            disabled={!formState.enabled}
          />
          <label className="form-check-label" htmlFor="onDownloadCompleted">
            When downloads complete successfully
          </label>
        </div>
        
        {/* Download failed notifications */}
        <div className="form-check mb-3">
          <input
            type="checkbox"
            id="onDownloadFailed"
            name="onDownloadFailed"
            className="form-check-input"
            checked={formState.onDownloadFailed}
            onChange={handleCheckboxChange}
            disabled={!formState.enabled}
          />
          <label className="form-check-label" htmlFor="onDownloadFailed">
            When downloads fail
          </label>
        </div>
        
        {/* Sound notifications */}
        <div className="form-check mb-3">
          <input
            type="checkbox"
            id="soundEnabled"
            name="soundEnabled"
            className="form-check-input"
            checked={formState.soundEnabled}
            onChange={handleCheckboxChange}
            disabled={!formState.enabled}
          />
          <label className="form-check-label" htmlFor="soundEnabled">
            Play sound with notifications
          </label>
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

export default NotificationSettings;