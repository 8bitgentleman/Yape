import React, { useState } from 'react';

interface AddUrlFormProps {
  onAddDownload: (url: string, path?: string) => void;
  onCancel: () => void;
}

/**
 * Component for adding a URL to download
 */
const AddUrlForm: React.FC<AddUrlFormProps> = ({
  onAddDownload,
  onCancel
}) => {
  const [url, setUrl] = useState<string>('');
  const [selectedPath, setSelectedPath] = useState<string>('default location');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [ftpUsername, setFtpUsername] = useState<string>('');
  const [ftpPassword, setFtpPassword] = useState<string>('');
  const [unzipPassword, setUnzipPassword] = useState<string>('');
  
  // Sample folder paths from your screenshot
  const availablePaths = [
    { name: 'default location', path: '' },
    { name: 'docker', path: '/docker' },
    { name: 'Downloads', path: '/Downloads' },
    { name: 'home', path: '/home' }
  ];
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = url.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length > 0) {
      const path = selectedPath === 'default location' ? '' : selectedPath;
      urls.forEach(u => onAddDownload(u, path));
    }
  };
  
  return (
    <div className="add-url-form">
      <form onSubmit={handleSubmit}>
        <div className="url-input-area">
          <textarea
            placeholder="URL(s) to download (one per line)..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            rows={4}
            required
          />
        </div>

        {/* Advanced Options Toggle */}
        <div className="advanced-options-toggle mb-3">
          <div 
            className="selected-path d-flex justify-content-between align-items-center"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div>
              <i className="fas fa-cog me-2"></i>
              Advanced Options
            </div>
            <i className={`fas fa-chevron-${showAdvanced ? 'up' : 'down'}`}></i>
          </div>
        </div>

        {/* Advanced Options Section */}
        {showAdvanced && (
          <div className="advanced-options mb-3">
            <div className="form-row">
              <input 
                type="text" 
                placeholder="FTP username..." 
                className="form-control mb-2"
                value={ftpUsername}
                onChange={(e) => setFtpUsername(e.target.value)}
              />
            </div>
            
            <div className="form-row">
              <input 
                type="password" 
                placeholder="FTP password..." 
                className="form-control mb-2"
                value={ftpPassword}
                onChange={(e) => setFtpPassword(e.target.value)}
              />
            </div>
            
            <div className="form-row">
              <input 
                type="password" 
                placeholder="Unzip password..." 
                className="form-control"
                value={unzipPassword}
                onChange={(e) => setUnzipPassword(e.target.value)}
              />
            </div>
          </div>
        )}
        {/* 
        <div className="download-location mb-3">
          <div 
            className="selected-path d-flex justify-content-between align-items-center"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              border: '1px solid #dee2e6',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              borderRadius: '0.25rem',
              backgroundColor: selectedPath === 'default location' ? '#f8f9fa' : 'white'
            }}
          >
            <div>
              <i className="fas fa-folder me-2"></i>
              {selectedPath === 'default location' ? 'Download to default location' : `Download to ${selectedPath}`}
            </div>
            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
          </div>
          
          {isExpanded && (
            <div className="folder-selector">
              {availablePaths.map((path) => (
                <div 
                  key={path.name}
                  className="folder-item"
                  onClick={() => {
                    setSelectedPath(path.name);
                    setIsExpanded(false);
                  }}
                >
                  <i className="fas fa-folder folder-icon"></i>
                  <span>{path.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
         */}
        <div className="action-buttons mt-3">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!url.trim()}
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddUrlForm;
