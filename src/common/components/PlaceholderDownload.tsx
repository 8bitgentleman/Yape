import React from 'react';

/**
 * Placeholder component for download items when loading
 */
const PlaceholderDownload: React.FC = () => {
  return (
    <div className="download-item">
      <div className="placeholder-line" style={{ width: '70%', height: '16px', marginBottom: '8px' }}></div>
      <div className="placeholder-line" style={{ width: '100%', height: '6px', marginBottom: '8px' }}></div>
      <div className="d-flex justify-content-between">
        <div className="placeholder-line" style={{ width: '30%', height: '12px' }}></div>
        <div className="placeholder-line" style={{ width: '20%', height: '12px' }}></div>
      </div>
    </div>
  );
};

export default PlaceholderDownload;
