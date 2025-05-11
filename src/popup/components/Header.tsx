import React from 'react';

interface HeaderProps {
  limitSpeedEnabled: boolean;
  onToggleSpeedLimit: () => void;
  onOpenOptions: () => void;
  onOpenWebInterface: () => void;
  onAddUrl: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onClearFinished: () => void;
}

/**
 * Header component for the popup, styled like NAS Download Manager
 */
const Header: React.FC<HeaderProps> = ({
  limitSpeedEnabled,
  onToggleSpeedLimit,
  onOpenOptions,
  onOpenWebInterface,
  onAddUrl,
  isRefreshing,
  onRefresh,
  onClearFinished
}) => {
  return (
    <div className="app-header">
      <div className="app-title">
        <img 
          src="/images/icon_32.png" 
          alt="Yape" 
          className="app-logo" 
        />
        <span>YAPE</span>
      </div>
      
      <div className="app-actions">
        <button
          className="icon-button"
          onClick={onAddUrl}
          title="Add URL to download"
        >
          <i className="fas fa-plus"></i>
        </button>
        
        <button
          className="icon-button"
          onClick={onRefresh}
          title="Refresh downloads"
          disabled={isRefreshing}
        >
          <i className={`fas fa-sync-alt ${isRefreshing ? 'refresh-spinner' : ''}`}></i>
        </button>
        
        <button
          className="icon-button"
          onClick={onOpenWebInterface}
          title="Open PyLoad web interface"
        >
          <i className="fas fa-external-link-alt"></i>
        </button>
        
        <button
          className="icon-button"
          onClick={onClearFinished}
          title="Clear all finished downloads"
        >
          <i className="fas fa-trash-alt"></i>
        </button>
        
        <button
          className="icon-button"
          onClick={onOpenOptions}
          title="Settings"
        >
          <i className="fas fa-cog"></i>
        </button>
      </div>
    </div>
  );
};

export default Header;
