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
    if (!state) return;
    
    try {
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
        // Clear existing tasks since we didn't find any
        setActiveTasks([]);
        setCompletedTasks([]);
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
      
      const response = await client.clearFinishedTasks();
      
      if (response.success) {
        // Clear the completed tasks list locally
        setCompletedTasks([]);
        
        // Ensure notification setting exists (for backward compatibility)
        if (state.settings.notifications && state.settings.notifications.onClearCompleted === undefined) {
          state.settings.notifications.onClearCompleted = true;
        }
        
        // Show notification if enabled in settings
        if (state.settings.notifications?.enabled && 
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
      }
    } catch (err) {
      console.error('Failed to clear completed tasks:', err);
    } finally {
      setDataLoading(false);
    }
  };
  
  // Add special interval for active downloads to update progress bars
  useEffect(() => {
    // If we have active downloads, set up a more frequent refresh interval for progress
    if (activeTasks.length > 0 && state) {
      console.log(`[DEBUG] Setting up progress refresh interval for ${activeTasks.length} active downloads`);
      
      // Create an interval that refreshes more frequently than the main refresh
      const progressInterval = setInterval(() => {
        console.log('[DEBUG] Running progress update interval');
        // Only refresh if we're not already loading data
        if (!dataLoading) {
          refreshDataImmediate();
        }
      }, 1000); // Refresh every second for active downloads
      
      // Clean up interval when component unmounts or dependencies change
      return () => {
        console.log('[DEBUG] Clearing progress refresh interval');
        clearInterval(progressInterval);
      };
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