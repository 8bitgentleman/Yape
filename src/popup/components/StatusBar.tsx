import React from 'react';

interface StatusBarProps {
  downloadSpeed: number;
  uploadSpeed: number;
  isConnected: boolean;
}

/**
 * Component for the status bar displayed at the bottom of the popup
 */
const StatusBar: React.FC<StatusBarProps> = ({
  downloadSpeed,
  uploadSpeed,
  isConnected
}) => {
  // Format speed (B/s, KB/s, MB/s)
  const formatSpeed = (speed: number): string => {
    if (speed === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(Math.max(1, speed)) / Math.log(1024));
    return `${(speed / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  return (
    <div className="status-bar">
      <div className="status-item">
        <i className="fas fa-arrow-down status-icon"></i>
        <span>{formatSpeed(downloadSpeed)}</span>
      </div>
      
      <div className="status-item">
        <i className="fas fa-arrow-up status-icon"></i>
        <span>{formatSpeed(uploadSpeed)}</span>
      </div>
      
      <div className="status-item">
        <i className={`fas fa-circle status-icon ${isConnected ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.6rem' }}></i>
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  );
};

export default StatusBar;
