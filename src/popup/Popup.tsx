import React, { useEffect, useState, useCallback } from 'react';
import { configValueToBoolean } from '../common/utils/config';
import { debounce } from '../common/utils/debounce';
import { loadState } from '../common/state';
import { PyloadClient } from '../common/api/client';
import { DownloadTask, State, TaskStatus } from '../common/types';
import LoadingSpinner from '../common/components/LoadingSpinner';
import DownloadList from './components/DownloadList';
import Header from './components/Header';
import AddUrlForm from './components/AddUrlForm';
import StatusBar from './components/StatusBar';
import { useDownloadManager } from './hooks/useDownloadManager';

/**
 * Main popup component
 */
const Popup: React.FC = () => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddUrlForm, setShowAddUrlForm] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Use our custom hook for download management
  const {
    activeTasks,
    completedTasks,
    limitSpeedStatus,
    downloadSpeed,
    uploadSpeed,
    isConnected,
    canDownloadCurrentPage,
    dataLoading,
    error,
    refreshData,
    refreshDataImmediate,
    toggleSpeedLimit,
    removeTask,
    clearCompletedTasks,
    addUrl,
    addCurrentPage,
    setDataLoading
  } = useDownloadManager(state);

  /**
   * Clear all finished downloads from server
   */
  const clearFinishedDownloads = () => {
    console.log('[DEBUG] clearFinishedDownloads called from header button - delegating to clearCompletedTasks');
    // Delegate to the same function used by "Clear all completed" button
    clearCompletedTasks();
  };

  // Load initial state
  useEffect(() => {
    const initializePopup = async () => {
      try {
        // Get state from storage
        console.log('[DEBUG] Loading state from storage...');
        const loadedState = await loadState();
        console.log('[DEBUG] Loaded state:', JSON.stringify(loadedState, (key, value) => {
          // Hide password in logs
          if (key === 'password') return '*****';
          return value;
        }, 2));
        setState(loadedState);

        // Get current active tab URL immediately to improve perceived performance
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.url) {
            setCurrentUrl(tabs[0].url);
          }
        });

        // Check if there's a pending refresh with details (from background context menu)
        const storageData = await chrome.storage.local.get(['pendingRefresh', 'lastAddedPackage']);
        if (storageData.pendingRefresh) {
          console.log('Found pending refresh flag, retrieving last added package info...');
          
          // Clear the flags
          await chrome.storage.local.remove(['pendingRefresh', 'lastAddedPackage']);
          
          // If we have package details, log them for debugging
          if (storageData.lastAddedPackage) {
            console.log('Last added package details:', storageData.lastAddedPackage);
            
            // Check how old the package info is
            const now = Date.now();
            const packageTime = storageData.lastAddedPackage.timestamp || 0;
            const timeDiff = now - packageTime;
            
            // If package was added within the last 5 minutes, show a notification
            if (timeDiff < 5 * 60 * 1000) {
              chrome.notifications.create('', {
                type: 'basic',
                title: 'Download Added',
                message: `"${storageData.lastAddedPackage.name}" has been added to PyLoad.`,
                iconUrl: './images/icon_128.png',
              });
            }
          }
          
          // Will refresh when state is set and useEffect([state]) runs
        }

        // Show content early even if not logged in
        setLoading(false);

        // Set up auto-refresh if enabled and logged in
        if (loadedState.isLoggedIn && loadedState.settings.ui.autoRefresh) {
          const interval = setInterval(() => {
            refreshData();
          }, loadedState.settings.ui.refreshInterval);
          
          setRefreshInterval(interval);
          
          // Clear interval on unmount
          return () => {
            if (interval) clearInterval(interval);
          };
        }
      } catch (err) {
        console.error('Popup initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializePopup();
    
    // Clean up interval when component unmounts
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Effect to refresh data when state changes
  useEffect(() => {
    if (state && state.isLoggedIn) {
      console.log('[DEBUG] State changed and user is logged in, refreshing data...');
      refreshDataImmediate();
    } else if (state) {
      console.log('[DEBUG] State changed but user is not logged in');
    } else {
      console.log('[DEBUG] State is null, cannot refresh data');
    }
  }, [state, refreshDataImmediate]);

  /**
   * Open options page
   */
  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  /**
   * Open PyLoad web interface
   */
  const openWebInterface = () => {
    if (!state) return;
    
    const { protocol, hostname, port, path } = state.settings.connection;
    const url = `${protocol}://${hostname}:${port}${path}`;
    
    chrome.tabs.create({ url });
  };

  // Show loading spinner while initializing
  if (loading) {
    return <LoadingSpinner text="Loading PyLoad data..." />;
  }

  const handleAddCurrentPage = () => {
    if (currentUrl) {
      addCurrentPage(currentUrl);
    }
  };

  const handleAddUrl = (url: string, path?: string) => {
    addUrl(url, path);
    setShowAddUrlForm(false);
  };

  return (
    <div className="app-container">
      <Header 
        limitSpeedEnabled={limitSpeedStatus}
        onToggleSpeedLimit={toggleSpeedLimit}
        onOpenOptions={openOptions}
        onOpenWebInterface={openWebInterface}
        onAddUrl={() => setShowAddUrlForm(true)}
        isRefreshing={dataLoading}
        onRefresh={refreshDataImmediate}
        onClearFinished={clearFinishedDownloads}
      />
      
      <div className="app-content">
        {error && (
          <div className="alert alert-danger mt-2 mb-3">{error}</div>
        )}
        
        {showAddUrlForm ? (
          <AddUrlForm
            onAddDownload={handleAddUrl}
            onCancel={() => setShowAddUrlForm(false)}
          />
        ) : (
          <>
            {canDownloadCurrentPage && currentUrl && (
              <div className="add-current-page mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="ellipsis me-2" style={{ fontSize: '0.9rem' }}>
                    {currentUrl}
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleAddCurrentPage}
                  >
                    <i className="fas fa-download me-1"></i> Add
                  </button>
                </div>
              </div>
            )}
            
            <DownloadList
              activeTasks={activeTasks}
              completedTasks={completedTasks}
              onRemoveTask={removeTask}
              onClearCompleted={clearCompletedTasks}
              showCompleted={state?.settings.ui.showCompleted || false}
              isLoading={dataLoading}
            />
          </>
        )}
      </div>
      
      <StatusBar
        downloadSpeed={downloadSpeed}
        uploadSpeed={uploadSpeed}
        isConnected={isConnected}
      />
    </div>
  );
};

export default Popup;
