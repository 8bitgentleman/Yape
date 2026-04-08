import React, { useState } from 'react';
import { ConnectionSettings } from '../../common/types';

interface ConnectionFormProps {
  connectionSettings: ConnectionSettings;
  onSave: (settings: ConnectionSettings) => void;
  onTest: (settings: ConnectionSettings) => void;
}

/**
 * Form for PyLoad connection settings
 */
const ConnectionForm: React.FC<ConnectionFormProps> = ({
  connectionSettings,
  onSave,
  onTest
}) => {
  // Form state
  const [settings, setSettings] = useState<ConnectionSettings>(connectionSettings);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Handle port number conversion
    if (name === 'port') {
      const portValue = parseInt(value, 10);
      setSettings(prev => ({
        ...prev,
        [name]: isNaN(portValue) ? 0 : portValue
      }));
      return;
    }

    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(settings);
  };

  // Handle test connection
  const handleTestConnection = () => {
    onTest(settings);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Protocol and Hostname */}
      <div className="mb-3">
        <div className="d-flex gap-3">
          <div className="flex-fill">
            <label htmlFor="protocol" className="form-label">Protocol</label>
            <select
              id="protocol"
              name="protocol"
              className="form-select"
              value={settings.protocol}
              onChange={handleChange}
              required
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
          </div>
          <div className="flex-fill">
            <label htmlFor="hostname" className="form-label">Hostname</label>
            <input
              type="text"
              id="hostname"
              name="hostname"
              className="form-control"
              value={settings.hostname}
              onChange={handleChange}
              placeholder="e.g., 192.168.1.100 or pyload.example.com"
              required
            />
          </div>
        </div>
      </div>

      {/* Port and Path */}
      <div className="mb-3">
        <div className="d-flex gap-3">
          <div className="flex-fill">
            <label htmlFor="port" className="form-label">Port</label>
            <input
              type="number"
              id="port"
              name="port"
              className="form-control"
              value={settings.port}
              onChange={handleChange}
              min="1"
              max="65535"
              placeholder="e.g., 8000"
              required
            />
          </div>
          <div className="flex-fill">
            <label htmlFor="path" className="form-label">Path</label>
            <input
              type="text"
              id="path"
              name="path"
              className="form-control"
              value={settings.path}
              onChange={handleChange}
              placeholder="e.g., / or /pyload"
            />
            <div className="form-text">
              The base path of the PyLoad instance. Default is /.
            </div>
          </div>
        </div>
      </div>



      {/* API Key */}
      <div className="mb-3">
        <label htmlFor="apiKey" className="form-label">API Key</label>
        <div className="input-group">
          <input
            type={showApiKey ? 'text' : 'password'}
            id="apiKey"
            name="apiKey"
            className="form-control"
            value={settings.apiKey}
            onChange={handleChange}
            placeholder="PyLoad API key (e.g. pl_...)"
            required
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            <i className={`fas ${showApiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
        </div>
        <div className="form-text">
          Generate an API key in PyLoad under Settings &rarr; User &rarr; API Keys.
        </div>
      </div>

      {/* Buttons */}
      <div className="d-flex justify-content-between">
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={handleTestConnection}
        >
          Test Connection
        </button>

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

export default ConnectionForm;
