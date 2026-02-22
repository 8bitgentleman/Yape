import { useState, useEffect, useCallback, useRef } from 'react';
import { PyloadClient } from '../../common/api/client';
import { DownloadTask, State, TaskStatus } from '../../common/types';
import { configValueToBoolean } from '../../common/utils/config';
import { debounce } from '../../common/utils/debounce';

export function useDownloadManager(state: State | null) {
  // State - start as true so placeholders show immediately instead of empty-state flash
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTasks, setActiveTasks] = useState<DownloadTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<DownloadTask[]>([]);
  const [limitSpeedStatus, setLimitSpeedStatus] = useState<boolean>(false);
  const [canDownloadCurrentPage, setCanDownloadCurrentPage] = useState<boolean>(false);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Refs to track previous state and prevent unnecessary updates
  const prevActiveTasksRef = useRef<DownloadTask[]>([]);
  const prevCompletedTasksRef = useRef<DownloadTask[]>([]);
  const isRefreshingRef = useRef<boolean>(false);

  // Load cached tasks from storage on mount for instant display while network fetch is in flight
  useEffect(() => {
    chrome.storage.local.get(['cachedTasks']).then((result) => {
      if (result.cachedTasks) {
        const { active, completed } = result.cachedTasks as { active: DownloadTask[], completed: DownloadTask[] };
        if ((active?.length ?? 0) > 0 || (completed?.length ?? 0) > 0) {
          setActiveTasks(active ?? []);
          setCompletedTasks(completed ?? []);
          prevActiveTasksRef.current = active ?? [];
          prevCompletedTasksRef.current = completed ?? [];
          setDataLoading(false);
        }
      }
    });
  }, []);

  // Helper function to compare task arrays by IDs and relevant properties
  const tasksEqual = (tasks1: DownloadTask[], tasks2: DownloadTask[]): boolean => {
    if (tasks1.length !== tasks2.length) return false;
    
    for (let i = 0; i < tasks1.length; i++) {
      const task1 = tasks1[i];
      const task2 = tasks2[i];
      
      // Compare essential properties that would cause visual changes
      if (task1.id !== task2.id || 
          task1.name !== task2.name ||
          task1.percent !== task2.percent ||
          task1.status !== task2.status ||
          task1.speed !== task2.speed ||
          task1.size !== task2.size) {
        return false;
      }
    }
    return true;
  };

  /**
   * Immediate data refresh (no debounce)
   */
  const refreshDataImmediate = useCallback(async () => {
    if (!state || isRefreshingRef.current) return;
    
    try {
      isRefreshingRef.current = true;
      setDataLoading(true);
      
      const client = new PyloadClient(state.settings.connection);
      
      // Get server status to check connection
      const statusResponse = await client.getServerStatus();
      setIsConnected(statusResponse.success);
      
      if (!statusResponse.success) {
        setError('Failed to connect to PyLoad server. Check your connection settings.');
        return;
      }
      
      // Get both data sources for the most complete view
      const downloadsResponse = await client.getStatusDownloads();
      const queueResponse = await client.getQueueData();
      
      // Combine data from both sources
      const allTasks: DownloadTask[] = [];
      let totalDownloadSpeed = 0;
      
      // Add tasks from statusDownloads
      if (downloadsResponse.success && downloadsResponse.data && Array.isArray(downloadsResponse.data)) {
        allTasks.push(...downloadsResponse.data);
      }
      
      // Add tasks from queueData, avoiding duplicates
      if (queueResponse.success && queueResponse.data && Array.isArray(queueResponse.data)) {
        queueResponse.data.forEach((queueTask) => {
          if (!allTasks.find(task => task.id === queueTask.id)) {
            allTasks.push(queueTask);
          } 
        });
      }
      
      if (allTasks.length === 0) {
        // Only clear if we previously had tasks - prevents unnecessary empty state flashing
        if (prevActiveTasksRef.current.length > 0) {
          setActiveTasks([]);
          prevActiveTasksRef.current = [];
        }
        if (prevCompletedTasksRef.current.length > 0) {
          setCompletedTasks([]);
          prevCompletedTasksRef.current = [];
        }
        setDownloadSpeed(0);
      } else {
        const active: DownloadTask[] = [];
        const completed: DownloadTask[] = [];
        
        allTasks.forEach((task: DownloadTask) => {
          if (!task) return;
          
          // Check if task is completed
          const isCompleted = 
            task.status === TaskStatus.Finished || 
            task.status === TaskStatus.Complete || 
            task.percent === 100;
          
          if (isCompleted) {
            completed.push(task);
          } else {
            active.push(task);
            // Sum up all download speeds
            totalDownloadSpeed += (task.speed || 0);
          }
        });
        
        // Only update state if tasks have actually changed
        if (!tasksEqual(active, prevActiveTasksRef.current)) {
          setActiveTasks(active);
          prevActiveTasksRef.current = active;
        }
        
        if (!tasksEqual(completed, prevCompletedTasksRef.current)) {
          setCompletedTasks(completed);
          prevCompletedTasksRef.current = completed;
        }

        setDownloadSpeed(totalDownloadSpeed);

        // Cache tasks for instant display on next popup open
        chrome.storage.local.set({ cachedTasks: { active, completed } });
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
      isRefreshingRef.current = false;
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
   * Remove a task
   */
  const removeTask = async (taskId: string) => {
    if (!state) return;
    
    try {
      // Immediately remove from UI for responsiveness
      setActiveTasks(prev => prev.filter(task => task.id !== taskId));
      setCompletedTasks(prev => prev.filter(task => task.id !== taskId));
      
      // Now call the API to actually remove it
      const client = new PyloadClient(state.settings.connection);
      await client.removeTask(taskId);
      
      // Refresh after a delay to ensure the server has processed the removal
      setTimeout(() => {
        refreshDataImmediate();
      }, 1000);
    } catch (err) {
      console.error('Failed to remove task:', err);
      // Refresh to restore the task if the API call failed
      refreshDataImmediate();
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
      
      // Get current count of completed tasks for badge update
      const completedCount = completedTasks.length;
      
      // Clear the completed tasks list locally first for immediate UI feedback
      setCompletedTasks([]);
      
      // Then try to clear them on the server
      const response = await client.clearFinishedTasks();
      
      if (response.success) {
        console.log('[YAPE-DEBUG] Successfully cleared finished tasks on server');
        
        // Route notification through background so settings check is centralized
        chrome.runtime.sendMessage({
          type: 'notification',
          notificationType: 'cleared',
          title: 'PyLoad Downloads',
          message: `Successfully cleared ${completedCount} completed download(s)`,
        }).catch(() => {});
        
        // Update badge through multiple methods to ensure it's properly updated
        console.log('[YAPE-DEBUG] Updating badge after clearing downloads');
        
        // Method 1: Send message to background script
        try {
          console.log('[YAPE-DEBUG] Sending badge update to background script');
          await chrome.runtime.sendMessage({ 
            type: 'update_badge', 
            count: 0, // Set to 0 since we're clearing all completed downloads
            action: 'clear_completed'
          }).catch(error => {
            console.log('[YAPE-DEBUG] Error sending badge update message:', error);
          });
        } catch (error) {
          console.error('[YAPE-DEBUG] Error sending badge update message:', error);
        }
        
        // Method 2: Update badge count in storage
        try {
          await chrome.storage.local.set({ badgeCount: 0 });
          console.log('[YAPE-DEBUG] Updated badge count in storage to 0');
        } catch (error) {
          console.error('[YAPE-DEBUG] Error updating badge count in storage:', error);
        }
        
        // Method 3: Try to update the badge directly
        try {
          chrome.action.setBadgeText({ text: '' });
          console.log('[YAPE-DEBUG] Cleared badge text directly');
        } catch (error) {
          console.error('[YAPE-DEBUG] Error clearing badge text directly:', error);
        }
        
        // Refresh data to ensure UI is synced with server
        setTimeout(() => {
          console.log('[YAPE-DEBUG] Refreshing data after clearing completed tasks');
          refreshDataImmediate();
        }, 500);
      } else {
        console.error('[YAPE-DEBUG] Failed to clear finished tasks on server:', response);
        // Refresh data to restore completed tasks if the server operation failed
        refreshDataImmediate();
      }
    } catch (err) {
      console.error('[YAPE-DEBUG] Failed to clear completed tasks:', err);
      // Refresh data to restore completed tasks if there was an error
      refreshDataImmediate();
    } finally {
      setDataLoading(false);
    }
  };
  
  // Modify the main refresh effect to trigger badge updates
  useEffect(() => {
    // Trigger immediate refresh on state change
    if (state && state.isLoggedIn) {
      refreshDataImmediate();
      
      // Send message to background script to check for finished downloads
      // This ensures badge is updated even if popup is closed
      try {
        console.log('[YAPE-DEBUG] Notifying background script to check for finished downloads');
        chrome.runtime.sendMessage({ type: 'check_for_finished_downloads' });
      } catch (error) {
        console.error('[YAPE-DEBUG] Error sending message to check downloads:', error);
      }
      
    }
  }, [state, refreshData, refreshDataImmediate]);

  // Set up refresh interval only when there are active downloads
  useEffect(() => {
    if (!state || !state.isLoggedIn) return;
    
    // Only set up refresh intervals if there are active downloads
    if (activeTasks.length > 0) {
      console.log(`[DEBUG] Setting up refresh interval for ${activeTasks.length} active downloads`);
      
      // Use either the configured refresh interval or 3 seconds, whichever is shorter
      const refreshRate = Math.min(state.settings.ui.refreshInterval, 3000);
      
      const interval = setInterval(() => {
        console.log('[DEBUG] Running active downloads refresh interval');
        if (!dataLoading) {
          refreshDataImmediate();
        }
      }, refreshRate);
      
      return () => {
        console.log('[DEBUG] Clearing active downloads refresh interval');
        clearInterval(interval);
      };
    } else {
      console.log('[DEBUG] No active downloads, not setting up refresh interval');
    }
  }, [activeTasks.length, state, refreshDataImmediate, dataLoading]);

  // Return the full API
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
    addUrl: async (url: string, path?: string) => {
      if (!state) return;
      
      try {
        setDataLoading(true);
        
        // Get package name from URL
        const packageName = url.split('/').pop() || 'Download';
        
        const client = new PyloadClient(state.settings.connection);
        
        // Use path if provided, otherwise use default
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
    },
    addCurrentPage: async (url: string) => {
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
    },
    checkCurrentUrl: async (url: string) => {
      if (!state) return;
      
      try {
        const client = new PyloadClient(state.settings.connection);
        const checkUrlResponse = await client.checkURL(url);
        setCanDownloadCurrentPage(checkUrlResponse.success && !checkUrlResponse.error);
      } catch (err) {
        console.error('Failed to check URL:', err);
        setCanDownloadCurrentPage(false);
      }
    },
    setDataLoading,
    pauseDownload: async () => {}, // Dummy function to not break the interface
    resumeDownload: async () => {} // Dummy function to not break the interface
  };
}