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

      // Get downloads
      const downloadsResponse = await client.getStatusDownloads();
      
      if (downloadsResponse.success && downloadsResponse.data) {
        // Separate active and completed tasks
        const active: DownloadTask[] = [];
        const completed: DownloadTask[] = [];
        let totalDownloadSpeed = 0;
        
        downloadsResponse.data.forEach((task: DownloadTask) => {
          if (task.status === TaskStatus.Finished || 
              task.status === TaskStatus.Complete || 
              task.percent === 100) {
            completed.push(task);
          } else {
            active.push(task);
            // Sum up all download speeds
            totalDownloadSpeed += task.speed || 0;
          }
        });
        
        console.log('Active tasks:', active);
        console.log('Completed tasks:', completed);
        
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
    }, 300), 
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
      const client = new PyloadClient(state.settings.connection);
      
      const response = await client.removeTask(taskId);
      
      if (response.success) {
        // Remove task from state
        setCompletedTasks(prev => prev.filter(task => task.id !== taskId));
      }
    } catch (err) {
      console.error('Failed to remove task:', err);
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
      
      // Remove tasks one by one
      for (const task of completedTasks) {
        await client.removeTask(task.id);
      }
      
      // Clear the completed tasks list
      setCompletedTasks([]);
    } catch (err) {
      console.error('Failed to clear completed tasks:', err);
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
      // Download added notification
      if (message.type === 'download_added') {
        console.log('Download added, refreshing data...');
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
    checkCurrentUrl
  };
}
