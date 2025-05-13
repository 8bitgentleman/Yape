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
    pauseDownload,
    resumeDownload,
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

  // Effect to preserve badge count and restore it properly when popup closes
  useEffect(() => {
    // Create the beforeunload event handler function
    const handleBeforeUnload = async () => {
      console.log('[YAPE-DEBUG] Popup closing, ensuring badge visibility');
      
      try {
        // Mark popup as closed
        await chrome.storage.local.set({ popupOpen: false });
        
        // Get the latest badge count from storage before restoring
        const result = await chrome.storage.local.get(['badgeCount']);
        const badgeCount = result.badgeCount || 0;
        
        console.log(`[YAPE-DEBUG] Latest badge count on popup close: ${badgeCount}`);
        
        // Request the background script to show the badge if needed
        if (badgeCount > 0) {
          try {
            chrome.runtime.sendMessage({ 
              type: 'restore_badge', 
              count: badgeCount 
            }).catch(error => {
              console.log('[YAPE-DEBUG] Could not send restore_badge message:', error);
              
              // As a fallback, set the badge directly
              chrome.action.setBadgeText({ text: badgeCount.toString() });
              chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
            });
          } catch (error) {
            console.error('[YAPE-DEBUG] Error sending badge restore message:', error);
            
            // As a fallback, set the badge directly
            chrome.action.setBadgeText({ text: badgeCount.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
          }
        }
        
        // Also trigger a refresh check in the background
        chrome.runtime.sendMessage({ type: 'check_for_finished_downloads' }).catch(() => {});
      } catch (error) {
        console.error('[YAPE-DEBUG] Error in beforeunload handler:', error);
      }
    };
    
    try {
      console.log('[YAPE-DEBUG] Popup opened, recording popup state');
      
      // Mark the popup as open
      chrome.storage.local.set({ popupOpen: true });
      
      // When popup closes, handle badge visibility
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Also request an immediate check for finished downloads
      chrome.runtime.sendMessage({ type: 'check_for_finished_downloads' }).catch(error => {
        console.warn('[YAPE-DEBUG] Error requesting finished downloads check:', error);
      });
    } catch (error) {
      console.error('[YAPE-DEBUG] Error in badge effect:', error);
    }
    
    // Clean up the event listener when the component is unmounted
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      console.log('[YAPE-DEBUG] Cleaned up beforeunload event listener');
    };
  }, []);

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

  // Request a check for finished downloads when popup opens and closes
  useEffect(() => {
    try {
      console.log('[YAPE-DEBUG] Requesting check for finished downloads on popup open');
      chrome.runtime.sendMessage({ type: 'check_for_finished_downloads' }).catch(error => {
        console.warn('[YAPE-DEBUG] Error requesting finished downloads check:', error);
      });
      
      // Also request when popup closes
      const handleBeforeUnload = () => {
        console.log('[YAPE-DEBUG] Requesting check for finished downloads on popup close');
        chrome.runtime.sendMessage({ type: 'check_for_finished_downloads' }).catch(error => {
          console.warn('[YAPE-DEBUG] Error requesting finished downloads check on close:', error);
        });
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        console.log('[YAPE-DEBUG] Cleaned up beforeunload event listener for downloads check');
      };
    } catch (error) {
      console.error('[YAPE-DEBUG] Error setting up downloads check:', error);
    }
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
   * Open options page in a popup window instead of a new tab
   */
  const openOptions = () => {
    // Open settings in a popup window instead of a new tab
    chrome.windows.create({
      url: chrome.runtime.getURL('options.html'),
      type: 'popup',
      width: 480,
      height: 600
    });
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
          <DownloadList
            activeTasks={activeTasks}
            completedTasks={completedTasks}
            onRemoveTask={removeTask}
            onClearCompleted={clearCompletedTasks}
            showCompleted={state?.settings.ui.showCompleted || false}
            isLoading={dataLoading}
          />
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
