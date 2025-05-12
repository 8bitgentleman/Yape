import { useState, useEffect, useCallback } from 'react';
import { PyloadClient } from '../../common/api/client';
import { DownloadTask, State, TaskStatus } from '../../common/types';
import { configValueToBoolean } from '../../common/utils/config';
import { debounce } from '../../common/utils/debounce';

export function useDownloadManager(state: State | null) {
  // State
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTasks, setActiveTasks] = useState<DownloadTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<DownloadTask[]>([]);
  const [limitSpeedStatus, setLimitSpeedStatus] = useState<boolean>(false);
  const [canDownloadCurrentPage, setCanDownloadCurrentPage] = useState<boolean>(false);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  /**
   * Immediate data refresh (no debounce)
   */
  const refreshDataImmediate = useCallback(async () => {
    if (!state) {
      let errorMessage = 'No state available';
      // console.log('[DEBUG] No state available, aborting refresh');
      // console.trace('[DEBUG] Call stack of refreshDataImmediate');
      return;
    }
    
    try {
      setDataLoading(true);
      
      // Log connection settings (without password)
      const connectionSettings = { ...state.settings.connection };
      // Hide password for security
      connectionSettings.password = '*****';
      console.log('[DEBUG] Connection settings:', connectionSettings);
      
      const client = new PyloadClient(state.settings.connection);
      
      // Get server status to check connection
      const statusResponse = await client.getServerStatus();
      
      console.log('[DEBUG] Server status response:', statusResponse);
      setIsConnected(statusResponse.success);
      
      if (!statusResponse.success) {
        console.error('[DEBUG] Server connection failed');
        setError('Failed to connect to PyLoad server. Check your connection settings.');
        return;
      }
      

      // Get both data sources for the most complete view
      const downloadsResponse = await client.getStatusDownloads();
      
      // if (downloadsResponse.data) {
      //   console.log('[DEBUG] statusDownloads data type:', typeof downloadsResponse.data);
      //   console.log('[DEBUG] statusDownloads data is array:', Array.isArray(downloadsResponse.data));
      //   if (Array.isArray(downloadsResponse.data)) {
      //     console.log('[DEBUG] statusDownloads data length:', downloadsResponse.data.length);
      //   }
      // }
      
      const queueResponse = await client.getQueueData();
      
      
      
      // Combine data from both sources
      const allTasks: DownloadTask[] = [];
      let totalDownloadSpeed = 0;
      
      // First add tasks from statusDownloads
      if (downloadsResponse.success && downloadsResponse.data) {
        const tasksCount = Array.isArray(downloadsResponse.data) ? downloadsResponse.data.length : 'not an array';

        if (Array.isArray(downloadsResponse.data)) {
          allTasks.push(...downloadsResponse.data);
        } else {
          console.warn('[DEBUG] downloadsResponse.data is not an array!');
        }
      }
      
      // Then add tasks from queueData, avoiding duplicates
      if (queueResponse.success && queueResponse.data) {
        const tasksCount = Array.isArray(queueResponse.data) ? queueResponse.data.length : 'not an array';
        
        if (Array.isArray(queueResponse.data)) {
          queueResponse.data.forEach((queueTask, index) => {
            // Check if task with same ID already exists
            const existingTask = allTasks.find(task => task.id === queueTask.id);
            if (!existingTask) {
              allTasks.push(queueTask);
            } 
          });
        } else {
          console.warn('[DEBUG] queueResponse.data is not an array!');
        }
      }

      
      // Separate into active and completed
      const active: DownloadTask[] = [];
      const completed: DownloadTask[] = [];
        
      // Process all tasks to categorize them
      
      if (allTasks.length === 0) {
        console.log('[DEBUG] No tasks found in either API call');
        // Clear existing tasks since we didn't find any
        setActiveTasks([]);
        setCompletedTasks([]);
        setDownloadSpeed(0);
      } else {
        const active: DownloadTask[] = [];
        const completed: DownloadTask[] = [];
        
        allTasks.forEach((task: DownloadTask, index) => {
          if (!task) {
            console.warn(`[DEBUG] Skipping null/undefined task at index ${index}`);
            return;
          }
          
          console.log(`[DEBUG] Processing task ${index}:`, 
            `Name: ${task.name || 'unnamed'}`, 
            `Status: ${task.status || 'unknown'}`, 
            `Percent: ${task.percent || 0}`);
          
          // Improved status checking for PyLoad 0.4.9 format
          const isCompleted = 
            task.status === 'finished' || 
            task.status === 'complete' || 
            task.percent === 100;
          
          if (isCompleted) {
            console.log(`[DEBUG] Task categorized as COMPLETED: ${task.name}`);
            completed.push(task);
          } else {
            console.log(`[DEBUG] Task categorized as ACTIVE: ${task.name}`);
            active.push(task);
            // Sum up all download speeds
            const speed = task.speed || 0;
            totalDownloadSpeed += speed;
            console.log(`[DEBUG] Added speed: ${speed}, total speed now: ${totalDownloadSpeed}`);
          }
        });
        
        
        // Update state with processed tasks
        setActiveTasks(active);
        setCompletedTasks(completed);
        setDownloadSpeed(totalDownloadSpeed);
      }

      // Get limit speed status
      const limitSpeedResponse = await client.getLimitSpeedStatus();
      
      if (limitSpeedResponse.success && limitSpeedResponse.data !== undefined) {
        // Use utility function to convert config value to boolean
        const isLimitEnabled = configValueToBoolean(limitSpeedResponse.data);
        setLimitSpeedStatus(isLimitEnabled);
      }

      // Clear error if successful
      setError(null);
    } catch (err) {
      setError('Failed to refresh data. Check your connection.');
      console.error('Data refresh error:', err);
      setIsConnected(false);
    } finally {
      setDataLoading(false);
    }
  }, [state]);

  /**
   * Debounced refresh function to prevent UI flashing
   */
  const refreshData = useCallback(
    debounce(() => { 
      refreshDataImmediate();
    }, 150), // Reduced from 300ms for more responsive updates
    [refreshDataImmediate]
  );

  /**
   * Toggle speed limit
   */
  const toggleSpeedLimit = async () => {
    if (!state) return;
    
    try {
      const client = new PyloadClient(state.settings.connection);
      const newStatus = !limitSpeedStatus;
      
      const response = await client.setLimitSpeedStatus(newStatus);
      
      if (response.success) {
        setLimitSpeedStatus(newStatus);
      }
    } catch (err) {
      console.error('Failed to toggle speed limit:', err);
    }
  };

  /**
   * Remove a task with enhanced debugging
   */
  const removeTask = async (taskId: string) => {
    console.log(`[DEBUG] Removing task with ID: ${taskId}`);
    if (!state) {
      console.log('[DEBUG] No state available, cannot remove task');
      return;
    }
    
    try {
      const client = new PyloadClient(state.settings.connection);
      
      console.log(`[DEBUG] Calling API to remove task ${taskId}`);
      const response = await client.removeTask(taskId);
      console.log(`[DEBUG] Remove task response:`, response);
      
      if (response.success) {
        console.log(`[DEBUG] Successfully removed task ${taskId}, updating state`);
        // Remove task from state
        setCompletedTasks(prev => {
          const filtered = prev.filter(task => task.id !== taskId);
          console.log(`[DEBUG] Tasks after removal: ${filtered.length} (was ${prev.length})`);
          return filtered;
        });
      } else {
        console.error(`[DEBUG] Failed to remove task ${taskId}:`, response.message || 'Unknown error');
      }
    } catch (err) {
      console.error('[DEBUG] Exception while removing task:', err);
    }
  };

  /**
   * Clear all completed tasks
   */
  const clearCompletedTasks = async () => {
    if (!state || completedTasks.length === 0) return;
    
    try {
      setDataLoading(true);
      const client = new PyloadClient(state.settings.connection);
      
      // Use the efficient API call to clear all finished tasks at once
      const response = await client.clearFinishedTasks();
      
      if (response.success) {
        // Clear the completed tasks list locally
        setCompletedTasks([]);
        
        // Ensure the notification setting exists (for backward compatibility)
        if (state.settings.notifications && state.settings.notifications.onClearCompleted === undefined) {
          state.settings.notifications.onClearCompleted = true;
        }
        
        // Show notification of success if enabled in settings
        if (state.settings.notifications?.enabled && 
            state.settings.notifications?.onClearCompleted !== undefined && 
            state.settings.notifications?.onClearCompleted) {
          chrome.notifications.create('', {
            type: 'basic',
            title: 'PyLoad Downloads',
            message: `Successfully cleared ${completedTasks.length} completed download(s)`,
            iconUrl: './images/icon_128.png',
          });
        }
        
        // Refresh data to ensure UI is synced with server
        refreshDataImmediate();
      } else {
        console.error('[DEBUG] Failed to clear completed tasks:', response.message);
        
        // Ensure the notification setting exists (for backward compatibility)
        if (state.settings.notifications && state.settings.notifications.onClearCompleted === undefined) {
          state.settings.notifications.onClearCompleted = true;
        }
        
        // Show error notification if enabled
        if (state.settings.notifications?.enabled && 
            state.settings.notifications?.onClearCompleted !== undefined && 
            state.settings.notifications?.onClearCompleted) {
          chrome.notifications.create('', {
            type: 'basic',
            title: 'Error',
            message: 'Failed to clear completed downloads',
            iconUrl: './images/icon_128.png',
          });
        }
      }
    } catch (err) {
      console.error('[DEBUG] Exception in clearCompletedTasks:', err);
      
      // Ensure the notification setting exists (for backward compatibility)
      if (state.settings.notifications && state.settings.notifications.onClearCompleted === undefined) {
        state.settings.notifications.onClearCompleted = true;
      }
      
      // Show error notification if enabled
      if (state.settings.notifications?.enabled && 
          state.settings.notifications?.onClearCompleted !== undefined && 
          state.settings.notifications?.onClearCompleted) {
        chrome.notifications.create('', {
          type: 'basic',
          title: 'Error',
          message: 'Failed to clear completed downloads',
          iconUrl: './images/icon_128.png',
        });
      }
    } finally {
      setDataLoading(false);
    }
  };

  /**
   * Check if current URL can be downloaded
   */
  const checkCurrentUrl = useCallback(async (url: string) => {
    if (!state) return;
    
    try {
      const client = new PyloadClient(state.settings.connection);
      const checkUrlResponse = await client.checkURL(url);
      setCanDownloadCurrentPage(checkUrlResponse.success && !checkUrlResponse.error);
    } catch (err) {
      console.error('Failed to check URL:', err);
      setCanDownloadCurrentPage(false);
    }
  }, [state]);

  /**
   * Add URL for download
   */
  const addUrl = async (url: string, path?: string) => {
    if (!state) return;
    
    try {
      setDataLoading(true);
      
      // Get package name from URL
      const packageName = url.split('/').pop() || 'Download';
      
      const client = new PyloadClient(state.settings.connection);
      
      const response = await client.addPackage(packageName, url);
      
      if (response.success) {
        // Refresh data
        await refreshDataImmediate();
      }
    } catch (err) {
      console.error('Failed to add URL:', err);
    } finally {
      setDataLoading(false);
    }
  };

  /**
   * Add current page for download
   */
  const addCurrentPage = async (url: string) => {
    if (!state) return;
    
    try {
      // Get tab title to use as package name
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const title = tabs[0]?.title || 'Download';
      
      const client = new PyloadClient(state.settings.connection);
      
      const response = await client.addPackage(title, url);
      
      if (response.success) {
        // Disable download button
        setCanDownloadCurrentPage(false);
        
        // Refresh data
        await refreshDataImmediate();
      }
    } catch (err) {
      console.error('Failed to add current page:', err);
    }
  };

  // Add special interval for active downloads to update progress bars
  useEffect(() => {
    // If we have active downloads, set up a more frequent refresh interval for progress
    if (activeTasks.length > 0 && state) {
      
      // Log initial download status for debugging
      activeTasks.forEach((task, index) => {
        console.log(`[DEBUG] Active task ${index}: ${task.name}, Status: ${task.status}, Progress: ${task.percent}%, Speed: ${task.speed}`);
      });
      
      // Create an interval that refreshes more frequently than the main refresh
      const progressInterval = setInterval(() => {
        // Only refresh if we're not already loading data
        if (!dataLoading) {
          
          // Use direct PyLoad API call for status updates rather than the full refresh
          if (state?.settings?.connection) {
            const client = new PyloadClient(state.settings.connection);
            
            // Use getStatusDownloads as it's specifically for active downloads and lighter
            client.getStatusDownloads().then(response => {
              if (response.success && response.data && Array.isArray(response.data)) {
                
                // Extract just the necessary data for progress updates
                const updatedTasks = response.data.map(task => {
                  return {
                    id: task.id,
                    percent: task.percent || 0,
                    status: task.status,
                    speed: task.speed || 0
                  };
                });
                
                // Update only specific properties of active tasks
                setActiveTasks(prevTasks => {
                  return prevTasks.map(prevTask => {
                    const update = updatedTasks.find(t => t.id === prevTask.id);
                    if (update) {
                      
                      return {
                        ...prevTask,
                        percent: update.percent,
                        status: update.status,
                        speed: update.speed
                      };
                    }
                    return prevTask;
                  });
                });
                
                // Update total download speed
                const totalSpeed = response.data.reduce((total, task) => total + (task.speed || 0), 0);
                setDownloadSpeed(totalSpeed);
              }
            }).catch(err => {
              console.error('[DEBUG] Error in progress update:', err);
            });
          }
        }
      }, 1000); // Refresh every second for active downloads
      
      // Clean up interval when component unmounts or dependencies change
      return () => {
        clearInterval(progressInterval);
      };
    }
  }, [activeTasks.length, state, dataLoading]);

  // Check current URL when state changes
  useEffect(() => {
    // Check if we need to request the URL from the active tab when state changes
    if (state && state.isLoggedIn) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          checkCurrentUrl(tabs[0].url);
        }
      });
    }
  }, [state, checkCurrentUrl]);

  // Listen for messages from background script
  useEffect(() => {
    const handleMessage = (message: any) => {
      // Download added notification with package details
      if (message.type === 'download_added') {
        
        // If message includes package ID and name, show a notification
        if (message.packageId && message.packageName) {
          
          // Show a notification
          chrome.notifications.create('', {
            type: 'basic',
            title: 'Download Added',
            message: `"${message.packageName}" has been added to PyLoad.`,
            iconUrl: './images/icon_128.png',
          });
        }
        
        // Refresh data to show the new download
        refreshDataImmediate();
        return true;
      }
      
      // URL change notification
      if (message.type === 'url_change' && message.url && state && state.isLoggedIn) {
        checkCurrentUrl(message.url);
        return true;
      }
      
      return false;
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [refreshDataImmediate, state, checkCurrentUrl]);

  return {
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
    checkCurrentUrl,
    setDataLoading
  };
}
