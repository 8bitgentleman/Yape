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
  
  // Sample folder paths from your screenshot
  const availablePaths = [
    { name: 'default location', path: '' },
    { name: 'docker', path: '/docker' },
    { name: 'Downloads', path: '/Downloads' },
    { name: 'home', path: '/home' }
  ];
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAddDownload(url.trim(), selectedPath === 'default location' ? '' : selectedPath);
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
          
          <div className="form-row">
            <input 
              type="text" 
              placeholder="FTP username..." 
              className="form-control mb-2"
            />
          </div>
          
          <div className="form-row">
            <input 
              type="password" 
              placeholder="FTP password..." 
              className="form-control mb-2"
            />
          </div>
          
          <div className="form-row">
            <input 
              type="password" 
              placeholder="Unzip password..." 
              className="form-control"
            />
          </div>
        </div>
        
        <div className="download-location">
          <div 
            className="selected-path d-flex justify-content-between align-items-center"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              border: '1px solid #dee2e6',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              borderRadius: '0.25rem'
            }}
          >
            <div>Download to {selectedPath}</div>
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
