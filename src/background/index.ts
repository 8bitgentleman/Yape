import { loadState, updateState } from '../common/state';
import { PyloadClient } from '../common/api/client';
import { ApiResponse, ConnectionSettings, DownloadTask, TaskStatus } from '../common/types';

/**
 * Request the notification to be shown by delegating to the background script
 * This function handles notification creation regardless of context
 * @param id Notification ID
 * @param options Notification options
 */
function safeCreateNotification(id: string, options: {
  type: 'basic' | 'image' | 'list' | 'progress';
  title: string;
  message: string;
  iconUrl: string;
  priority?: number;
}): void {
  // Log notification we're going to show
  console.log('[YAPE-DEBUG] Attempting to create notification:', {
    id,
    title: options.title,
    message: options.message
  });

  try {
    // We're in the background context, create notification directly
    if (chrome && chrome.notifications) {
      try {
        chrome.notifications.create(id, options, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('[YAPE-DEBUG] Error creating notification:', chrome.runtime.lastError);
          } else {
            console.log('[YAPE-DEBUG] Successfully created notification with ID:', notificationId || 'undefined');
          }
        });
      } catch (directError) {
        console.error('[YAPE-DEBUG] Direct notification creation failed:', directError);

        // Try an alternative approach - self-message passing
        try {
          // Send a message to ourselves to create the notification
          chrome.runtime.sendMessage({
            type: 'create_notification',
            id: id,
            options: options
          });
          console.log('[YAPE-DEBUG] Sent self-message to create notification');
        } catch (selfMessageError) {
          console.error('[YAPE-DEBUG] Self-message for notification failed:', selfMessageError);
        }
      }
    } else {
      // We're likely in a content script or detached context - log what we would show
      console.log('[YAPE-DEBUG] Notification would show:', options.title, '-', options.message);
      console.warn('[YAPE-DEBUG] Notifications API not available in this context');
      
      // Try to send a message to the background script
      try {
        chrome.runtime.sendMessage({
          type: 'create_notification',
          id: id,
          options: options
        });
        console.log('[YAPE-DEBUG] Requested background to create notification');
      } catch (messageError) {
        console.error('[YAPE-DEBUG] Failed to request notification via messaging:', messageError);
      }
    }
  } catch (error) {
    console.error('[YAPE-DEBUG] Error in notification system:', error);
  }
}

// Track the last notified downloads to avoid duplicate notifications
let lastNotifiedDownloadIds: Set<string> = new Set();

// Background check interval ID
let backgroundCheckIntervalId: number | null = null;

// Initialize the extension
async function initializeExtension() {
  console.log('[YAPE] Initializing extension...');
  
  // Setup context menus
  initializeContextMenus();
  
  // Set up message listeners
  initializeMessageHandlers();

  // Load previously stored notification IDs
  const storedData = await chrome.storage.local.get(['lastNotifiedDownloadIds', 'badgeCount']);
  
  if (storedData.lastNotifiedDownloadIds) {
    try {
      const savedIds = JSON.parse(storedData.lastNotifiedDownloadIds);
      if (Array.isArray(savedIds)) {
        lastNotifiedDownloadIds = new Set(savedIds);
        console.log(`[YAPE] Loaded ${lastNotifiedDownloadIds.size} previously notified download IDs`);
      }
    } catch (error) {
      console.error('[YAPE] Error parsing stored notification IDs:', error);
    }
  }
  
  // Restore badge if there was a previous count
  if (storedData.badgeCount && typeof storedData.badgeCount === 'number') {
    finishedDownloadCount = storedData.badgeCount;
    updateBadge(finishedDownloadCount);
    console.log(`[YAPE] Restored badge count to ${finishedDownloadCount}`);
  }

  // Set up periodic background checks
  await setupBackgroundChecks();

  console.log('[YAPE] Extension initialization completed');
}

// Set up periodic background checks for finished downloads
async function setupBackgroundChecks() {
  console.log('[YAPE-DEBUG] Setting up background checks...');
  
  // Clear any existing interval
  if (backgroundCheckIntervalId !== null) {
    console.log('[YAPE-DEBUG] Clearing existing interval:', backgroundCheckIntervalId);
    clearInterval(backgroundCheckIntervalId);
    backgroundCheckIntervalId = null;
  }

  // Get current state and settings
  const state = await loadState();
  
  // Default to 60 seconds if not configured
  const checkInterval = state.settings.ui.backgroundCheckInterval || 60000;
  
  console.log(`[YAPE-DEBUG] Setting up background checks every ${checkInterval / 1000} seconds`);
  
  // Set up the interval
  backgroundCheckIntervalId = setInterval(() => {
    console.log('[YAPE-DEBUG] Interval triggered, running check...');
    checkForFinishedDownloads();
  }, checkInterval) as unknown as number;
  
  console.log('[YAPE-DEBUG] Background check interval set:', backgroundCheckIntervalId);
  
  // Also run an immediate check
  console.log('[YAPE-DEBUG] Running immediate check...');
  checkForFinishedDownloads();
  
  // Set up a periodic check to ensure interval is still running
  setTimeout(() => {
    if (backgroundCheckIntervalId === null) {
      console.log('[YAPE-DEBUG] WARNING: Background check interval was lost, re-initializing...');
      setupBackgroundChecks();
    }
  }, 5 * 60 * 1000); // Check after 5 minutes
}

// Check for finished downloads and update badge/send notifications
async function checkForFinishedDownloads() {
  console.log('[YAPE-DEBUG] Background check: Checking for finished downloads...');
  
  const state = await loadState();
  
  // Skip if not logged in
  if (!state || !state.isLoggedIn) {
    console.log('[YAPE-DEBUG] Background check: Not logged in, skipping check');
    return;
  }
  
  try {
    const client = new PyloadClient(state.settings.connection);
    
    // Check server status first
    const statusResponse = await client.getServerStatus();
    
    if (!statusResponse.success) {
      console.error('[YAPE-DEBUG] Background check: Server status check failed:', statusResponse.message);
      return;
    }
    
    console.log('[YAPE-DEBUG] Server status check successful, fetching downloads...');
    
    // Get all downloads
    const downloadsResponse = await client.getStatusDownloads();
    const queueResponse = await client.getQueueData();
    
    console.log('[YAPE-DEBUG] Download API responses:', {
      statusDownloadsSuccess: downloadsResponse.success,
      queueDataSuccess: queueResponse.success,
      statusDownloadsCount: downloadsResponse.data ? Array.isArray(downloadsResponse.data) ? downloadsResponse.data.length : 'not an array' : 'no data',
      queueDataCount: queueResponse.data ? Array.isArray(queueResponse.data) ? queueResponse.data.length : 'not an array' : 'no data'
    });
    
    if (!downloadsResponse.success && !queueResponse.success) {
      console.error('[YAPE-DEBUG] Background check: Failed to get downloads');
      return;
    }
    
    // Process all downloads
    const allTasks: DownloadTask[] = [];
    
    // Add tasks from both responses
    if (downloadsResponse.success && Array.isArray(downloadsResponse.data)) {
      allTasks.push(...downloadsResponse.data);
    }
    
    if (queueResponse.success && Array.isArray(queueResponse.data)) {
      // Add only tasks that aren't already in the list
      queueResponse.data.forEach(task => {
        if (!allTasks.some(t => t.id === task.id)) {
          allTasks.push(task);
        }
      });
    }
    
    console.log(`[YAPE-DEBUG] Combined tasks: ${allTasks.length} tasks`);
    if (allTasks.length > 0) {
      // Log a sample task to see its structure
      console.log('[YAPE-DEBUG] Sample task:', allTasks[0]);
    }
    
    // Filter for finished downloads
    const finishedTasks = allTasks.filter(task => {
      const isFinished = 
        task.status === TaskStatus.Finished || 
        task.status === TaskStatus.Complete || 
        task.status === 'finished' || 
        task.status === 'complete' || 
        task.percent === 100;
      
      if (isFinished) {
        console.log(`[YAPE-DEBUG] Found finished task: ${task.name}, status: ${task.status}, percent: ${task.percent}`);
      }
      
      return isFinished;
    });
    
    console.log(`[YAPE-DEBUG] Background check: Found ${finishedTasks.length} finished downloads`);
    
    // Update badge with the number of finished tasks
    updateBadge(finishedTasks.length);
    
    // Load current known IDs before checking for new ones
    let storedIds: string[] = [];
    try {
      const storedData = await chrome.storage.local.get(['lastNotifiedDownloadIds']);
      if (storedData.lastNotifiedDownloadIds) {
        storedIds = JSON.parse(storedData.lastNotifiedDownloadIds);
        console.log(`[YAPE-DEBUG] Loaded ${storedIds.length} IDs from storage before checking for new downloads`);
      }
    } catch (error) {
      console.error('[YAPE-DEBUG] Error loading stored IDs:', error);
    }

    // Make sure we have the latest set of notified IDs
    if (storedIds.length > 0) {
      lastNotifiedDownloadIds = new Set(storedIds);
    }
    
    // Debugging current notification IDs
    console.log(`[YAPE-DEBUG] Current notified download IDs (${lastNotifiedDownloadIds.size}):`, Array.from(lastNotifiedDownloadIds));
    
    // Check for newly completed downloads (not in our lastNotifiedDownloadIds set)
    const newlyFinishedTasks = finishedTasks.filter(task => !lastNotifiedDownloadIds.has(task.id.toString()));
    
    console.log(`[YAPE-DEBUG] Found ${newlyFinishedTasks.length} newly finished downloads`);
    if (newlyFinishedTasks.length > 0) {
      console.log('[YAPE-DEBUG] Newly finished tasks:', newlyFinishedTasks.map(t => ({ id: t.id, name: t.name })));
    }
    
    // Send notifications for newly finished tasks
    if (newlyFinishedTasks.length > 0) {
      console.log(`[YAPE-DEBUG] Creating notifications for ${newlyFinishedTasks.length} newly finished downloads`);
      
      // If there's just one new download, show its name
      if (newlyFinishedTasks.length === 1) {
        const task = newlyFinishedTasks[0];
        
        // Show notification
        console.log(`[YAPE-DEBUG] Creating notification for task: ${task.name}`);
        safeCreateNotification('download-complete-' + Date.now(), {
          type: 'basic',
          title: 'Download Complete',
          message: `${task.name} has finished downloading`,
          iconUrl: './images/icon_128.png',
        });
        
        // Add to our set of notified downloads
        lastNotifiedDownloadIds.add(task.id.toString());
        console.log(`[YAPE-DEBUG] Added task ID ${task.id} to notified set`);
      } 
      // If there are multiple new downloads, show a count
      else if (newlyFinishedTasks.length > 1) {
        // Show notification
        console.log(`[YAPE-DEBUG] Creating group notification for ${newlyFinishedTasks.length} tasks`);
        safeCreateNotification('downloads-complete-' + Date.now(), {
          type: 'basic',
          title: 'Downloads Complete',
          message: `${newlyFinishedTasks.length} downloads have finished`,
          iconUrl: './images/icon_128.png',
        });
        
        // Add all to our set of notified downloads
        newlyFinishedTasks.forEach(task => {
          lastNotifiedDownloadIds.add(task.id.toString());
          console.log(`[YAPE-DEBUG] Added task ID ${task.id} to notified set`);
        });
      }
    }
    
    // Limit the size of our notification set (keep only the last 100 IDs)
    if (lastNotifiedDownloadIds.size > 100) {
      const idsArray = Array.from(lastNotifiedDownloadIds);
      lastNotifiedDownloadIds = new Set(idsArray.slice(idsArray.length - 100));
      console.log(`[YAPE-DEBUG] Trimmed notified IDs set to ${lastNotifiedDownloadIds.size} entries`);
    }
    
    // Persist the notification IDs to storage
    chrome.storage.local.set({
      lastNotifiedDownloadIds: JSON.stringify(Array.from(lastNotifiedDownloadIds))
    }, () => {
      console.log(`[YAPE-DEBUG] Persisted ${lastNotifiedDownloadIds.size} notification IDs to storage`);
    });
    
  } catch (error) {
    console.error('[YAPE-DEBUG] Background check: Error checking for finished downloads:', error);
  }
}

// Keep track of finished download count for badge
let finishedDownloadCount = 0;

// Update badge with the number of finished downloads
function updateBadge(count: number) {
  try {
    console.log(`[YAPE-DEBUG] Updating badge with count: ${count}`);
    
    // Update our stored count
    finishedDownloadCount = count;
    
    // Clear badge if count is 0
    if (count === 0) {
      chrome.action.setBadgeText({ text: '' });
      console.log('[YAPE-DEBUG] Cleared badge (count is 0)');
      
      // Also clear from storage
      chrome.storage.local.remove(['badgeCount'], () => {
        console.log('[YAPE-DEBUG] Removed badgeCount from storage');
      });
      return;
    }
    
    // Set badge text to the count
    chrome.action.setBadgeText({ text: count.toString() });
    console.log(`[YAPE-DEBUG] Set badge text to: ${count}`);
    
    // Set badge background color (green)
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    console.log('[YAPE-DEBUG] Set badge background color to green');
    
    // Store badge count in local storage to persist it
    chrome.storage.local.set({ badgeCount: count }, () => {
      console.log(`[YAPE-DEBUG] Stored badge count ${count} in local storage`);
    });
  } catch (error) {
    console.error('[YAPE-DEBUG] Error updating badge:', error);
  }
}



// Initialize context menus
function initializeContextMenus() {
  chrome.contextMenus.create({
    id: 'yape',
    title: 'Download with Yape',
    contexts: ['link']
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
}

// Handle context menu clicks
async function handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  if (info.menuItemId === 'yape' && tab && tab.id) {
    // Show loading notification
    await showToast(tab.id, 'info', 'Requesting download...');

    // Get current state
    const state = await loadState();
    
    // Check if logged in
    if (!state.isLoggedIn) {
      await showToast(tab.id, 'error', 'Not logged in. Please configure your settings first.');
      // Open options page to help the user
      chrome.runtime.openOptionsPage();
      return;
    }
    
    // Create PyLoad client
    const client = new PyloadClient(state.settings.connection);
    
    // Check server status and attempt login
    const statusResponse = await client.getServerStatus();
    
    if (!statusResponse.success) {
      await showToast(tab.id, 'error', `Server error: ${statusResponse.message || 'Could not connect to PyLoad server'}`);
      console.error('Server status check failed:', statusResponse);
      return;
    }
    
    // Ensure we're logged in even if state says we are
    const loginResponse = await client.login();
    if (!loginResponse.success) {
      await showToast(tab.id, 'error', 'Login failed. Please check your credentials in settings.');
      // Update login state
      await updateState(currentState => ({
        ...currentState,
        isLoggedIn: false
      }));
      return;
    }
    
    // Check if URL is valid
    if (info.linkUrl) {
      const checkResponse = await client.checkURL(info.linkUrl);
      
      if (!checkResponse.success) {
        await showToast(tab.id, 'error', `Error checking URL: ${checkResponse.message}`);
        return;
      }
      
      // Add package for download
      const packageName = info.linkUrl.replace(/[^a-z0-9._\-]/gi, '_');
      const addResponse = await client.addPackage(packageName, info.linkUrl);
      
      if (!addResponse.success) {
        await showToast(tab.id, 'error', `Error requesting download: ${addResponse.message}`);
        return;
      }
      
      // Notify popup to refresh downloads with the package ID - handle potential errors
      try {
        // Check if popup is open before sending message
        chrome.runtime.sendMessage({ 
          type: 'download_added', 
          packageId: addResponse.data, // Include the package ID from the response
          packageName: packageName,
          url: info.linkUrl
        }).catch(error => {
          // This will catch the error if popup isn't open
          console.log('[YAPE-DEBUG] Popup not open, storing refresh data for next open');
          // Store details in local storage to refresh on next popup open
          chrome.storage.local.set({ 
            pendingRefresh: true,
            lastAddedPackage: {
              id: addResponse.data,
              name: packageName,
              url: info.linkUrl,
              timestamp: Date.now()
            }
          });
          
          // Show a notification that the download was added
          safeCreateNotification(`download-added-${Date.now()}`, {
            type: 'basic',
            title: 'Download Added',
            message: `"${packageName}" has been added to PyLoad`,
            iconUrl: './images/icon_128.png',
          });
        });
      } catch (error) {
        console.warn('[YAPE-DEBUG] Failed to send message to popup - it might not be open', error);
        // Store details in local storage to refresh on next popup open
        await chrome.storage.local.set({ 
          pendingRefresh: true,
          lastAddedPackage: {
            id: addResponse.data,
            name: packageName,
            url: info.linkUrl,
            timestamp: Date.now()
          }
        });
        
        // Show a notification that the download was added
        safeCreateNotification(`download-added-${Date.now()}`, {
          type: 'basic',
          title: 'Download Added',
          message: `"${packageName}" has been added to PyLoad`,
          iconUrl: './images/icon_128.png',
        });
      }
      
      await showToast(tab.id, 'success', 'Download added successfully');
    }
  }
}

// Initialize message handlers
function initializeMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[YAPE-DEBUG] Received message:', message.type);
    
    // Handle show notification message
    if (message.type === 'notification') {
      safeCreateNotification(`notification-${Date.now()}`, {
        type: 'basic',
        title: message.title || 'Yape',
        message: message.message || '',
        iconUrl: './images/icon_128.png',
      });
    }
    
    // Handle settings update message
    if (message.type === 'settings_updated') {
      console.log('[YAPE-DEBUG] Background received settings update, reconfiguring background checks...');
      setupBackgroundChecks();
    }
    
    // Handle restore badge message
    if (message.type === 'restore_badge' && message.count) {
      console.log(`[YAPE-DEBUG] Received request to restore badge with count: ${message.count}`);
      updateBadge(message.count);
    }
    
    // Handle explicit notification creation message
    if (message.type === 'create_notification' && message.options) {
      console.log('[YAPE-DEBUG] Received request to create notification via message');
      try {
        chrome.notifications.create(message.id || `notification-${Date.now()}`, message.options, (notificationId) => {
          console.log('[YAPE-DEBUG] Created notification via message handler:', notificationId);
        });
      } catch (error) {
        console.error('[YAPE-DEBUG] Failed to create notification via message handler:', error);
      }
    }
    
    // Handle download added message - mainly used for tracking ID for notification tracking
    if (message.type === 'download_added' && message.packageId) {
      console.log(`[YAPE-DEBUG] Download added with ID: ${message.packageId}, adding to notified list`);
      // Add to our notified set to avoid showing completion notification later
      lastNotifiedDownloadIds.add(message.packageId.toString());
      
      // Persist the notification IDs
      chrome.storage.local.set({
        lastNotifiedDownloadIds: JSON.stringify(Array.from(lastNotifiedDownloadIds))
      });
      
      // Show notification for added download if requested
      if (message.showNotification) {
        safeCreateNotification(`download-added-${Date.now()}`, {
          type: 'basic',
          title: 'Download Added',
          message: `"${message.packageName || 'Package'}" has been added to PyLoad`,
          iconUrl: './images/icon_128.png',
        });
      }
    }
    
    // Return true to indicate async response
    return true;
  });
}

// Helper function to show toast notifications in tabs
async function showToast(tabId: number, type: 'info' | 'success' | 'error' | 'warning', message: string): Promise<void> {
  try {
    // Insert CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['css/toastr.min.css']
    });
    
    // Insert JavaScript
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['js/toastr.min.js']
    });
    
    // Configure toastr
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // @ts-ignore - toastr is injected from the script above
        window.toastr.options = {
          closeButton: false,
          newestOnTop: false,
          progressBar: false,
          positionClass: 'toast-top-right',
          preventDuplicates: true,
          timeOut: 8000
        };
      }
    });
    
    // Show toast
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (type, message) => {
        // @ts-ignore - toastr is injected from the script above
        window.toastr[type](message);
      },
      args: [type, message]
    });
  } catch (error) {
    console.error('Failed to show toast notification', error);
  }
}

// Add a heartbeat log to confirm the background script is running
setInterval(() => {
  console.log('[YAPE-DEBUG] ❤️ Background service worker heartbeat ❤️');
  // Check if our interval is still running
  console.log('[YAPE-DEBUG] Background check interval active:', backgroundCheckIntervalId !== null);
  // Log current finished count
  console.log('[YAPE-DEBUG] Current finishedDownloadCount:', finishedDownloadCount);
}, 60000); // Log every minute

// Run an immediate check to verify functionality
console.log('[YAPE-DEBUG] 🚀 Background script loaded 🚀');

// Initialize extension when installed or started
chrome.runtime.onInstalled.addListener(() => {
  console.log('[YAPE-DEBUG] Extension installed or updated, initializing...');
  initializeExtension();
});

// Also run initialization when Chrome starts
chrome.runtime.onStartup.addListener(() => {
  console.log('[YAPE-DEBUG] Browser started, initializing extension...');
  initializeExtension();
});

// Initialization function that runs when the extension loads
async function startup() {
  console.log('[YAPE-DEBUG] Service worker startup called');
  
  try {
    // Load previously stored notification IDs and badge count
    const storedData = await chrome.storage.local.get(['lastNotifiedDownloadIds', 'badgeCount']);
    
    if (storedData.lastNotifiedDownloadIds) {
      try {
        const savedIds = JSON.parse(storedData.lastNotifiedDownloadIds);
        if (Array.isArray(savedIds)) {
          lastNotifiedDownloadIds = new Set(savedIds);
          console.log(`[YAPE-DEBUG] Loaded ${lastNotifiedDownloadIds.size} previously notified download IDs`);
        }
      } catch (error) {
        console.error('[YAPE-DEBUG] Error parsing stored notification IDs:', error);
      }
    }
    
    // Restore badge if there was a previous count
    if (storedData.badgeCount && typeof storedData.badgeCount === 'number') {
      finishedDownloadCount = storedData.badgeCount;
      updateBadge(finishedDownloadCount);
      console.log(`[YAPE-DEBUG] Restored badge count to ${finishedDownloadCount}`);
    }
    
    // Set up background checks
    await setupBackgroundChecks();
    
    // Run an immediate check after a short delay
    setTimeout(() => {
      console.log('[YAPE-DEBUG] Running immediate check after startup');
      checkForFinishedDownloads();
    }, 3000);
  } catch (error) {
    console.error('[YAPE-DEBUG] Error during startup:', error);
  }
}

// Call startup on module load
startup();
