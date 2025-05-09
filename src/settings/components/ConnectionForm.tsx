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
  const [showPassword, setShowPassword] = useState<boolean>(false);

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
      {/* Protocol */}
      <div className="mb-3">
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
      
      {/* Hostname */}
      <div className="mb-3">
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
      
      {/* Port */}
      <div className="mb-3">
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
      
      {/* Path */}
      <div className="mb-3">
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
      
      {/* Username */}
      <div className="mb-3">
        <label htmlFor="username" className="form-label">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          className="form-control"
          value={settings.username}
          onChange={handleChange}
          placeholder="PyLoad username"
          required
        />
      </div>
      
      {/* Password */}
      <div className="mb-3">
        <label htmlFor="password" className="form-label">Password</label>
        <div className="input-group">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            className="form-control"
            value={settings.password}
            onChange={handleChange}
            placeholder="PyLoad password"
            required
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowPassword(!showPassword)}
          >
            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
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
