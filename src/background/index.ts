import { loadState, updateState } from '../common/state';
import { PyloadClient } from '../common/api/client';
import { ApiResponse, ConnectionSettings, DownloadTask, TaskStatus } from '../common/types';

// Message handler for badge update messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle badge update message from popup or content scripts
    if (message.type === 'update_badge' && message.count !== undefined) {
      console.log(`[YAPE-DEBUG] Received request to update badge to count: ${message.count}, action: ${message.action || 'unspecified'}`);
      updateBadge(message.count);
    }
    
    // Handle check for finished downloads message
    if (message.type === 'check_for_finished_downloads') {
      console.log('[YAPE-DEBUG] Received request to check for finished downloads');
      // Run a check right away
      checkForFinishedDownloads();
    }
    
    return true; // Keep channel open for async response
});



/**
 * Request the notification to be shown by delegating to the background script
 * This function handles notification creation regardless of context
 * Respects user notification settings
 * @param id Notification ID
 * @param options Notification options
 * @param notificationType The type of notification for filtering (added, completed, failed)
 */
async function safeCreateNotification(id: string, options: {
  type: 'basic' | 'image' | 'list' | 'progress';
  title: string;
  message: string;
  iconUrl: string;
  priority?: number;
  silent?: boolean;
}, notificationType: 'added' | 'completed' | 'failed' = 'completed'): Promise<void> {
  // Log notification we're going to show
  console.log('[YAPE-DEBUG] Attempting to create notification:', {
    id,
    title: options.title,
    message: options.message,
    type: notificationType
  });

  // Check notification settings before showing
  try {
    // Get notification settings from storage
    const data = await chrome.storage.local.get(['notificationSettings']);
    const settings = data.notificationSettings;
    
    // If we have settings and notifications are disabled, skip
    if (settings && !settings.enabled) {
      console.log('[YAPE-DEBUG] Notifications are disabled in user settings, skipping');
      return;
    }
    
    // Check if this specific notification type is enabled
    if (settings && (
      (notificationType === 'added' && !settings.onDownloadAdded) ||
      (notificationType === 'completed' && !settings.onDownloadCompleted) ||
      (notificationType === 'failed' && !settings.onDownloadFailed)
    )) {
      console.log(`[YAPE-DEBUG] ${notificationType} notifications are disabled in user settings, skipping`);
      return;
    }
    
    // Set silent mode based on user settings
    if (settings && !settings.soundEnabled) {
      options.silent = true;
    }
    
    // Continue with showing the notification
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
  } catch (error) {
    console.error('[YAPE-DEBUG] Error checking notification settings:', error);
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

  // Load previously stored notification IDs and settings
  const storedData = await chrome.storage.local.get([
    'lastNotifiedDownloadIds', 
    'badgeCount', 
    'notificationSettings'
  ]);
  
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
  
  // If notification settings don't exist, initialize them
  if (!storedData.notificationSettings) {
    console.log('[YAPE] Initializing notification settings in storage');
    chrome.storage.local.set({
      notificationSettings: {
        enabled: true,
        onDownloadAdded: true,
        onDownloadCompleted: true,
        onDownloadFailed: true,
        soundEnabled: false
      }
    });
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
  
  // Default to 30 seconds if not configured (reduced from 60 seconds for faster updates)
  const checkInterval = state.settings.ui.backgroundCheckInterval || 30000;
  
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
  
  // Set up a periodic sanity check to ensure our interval is still running
  // and the badge is visible if it should be
  setInterval(() => {
    // First check if our background check interval is still running
    if (backgroundCheckIntervalId === null) {
      console.log('[YAPE-DEBUG] WARNING: Background check interval was lost, re-initializing...');
      setupBackgroundChecks();
    }
    
    // Also check if we have a badge count but it's not visible
    chrome.storage.local.get(['badgeCount'], (result) => {
      const storedCount = result.badgeCount;
      if (storedCount && storedCount > 0) {
        // Check if badge is currently visible
        chrome.action.getBadgeText({}, (currentText) => {
          if (!currentText || currentText === '') {
            console.log(`[YAPE-DEBUG] Badge is not visible but should show ${storedCount}, restoring...`);
            // Restore badge
            chrome.action.setBadgeText({ text: storedCount.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
          }
        });
      }
    });
  }, 60000); // Run sanity check every minute
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
          title: `${task.name}`,
          message: 'Download Finished',
          iconUrl: './images/icon_128.png',
        }, 'completed');
        
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
        }, 'completed');
        
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
function updateBadge(count: number | undefined) {
  if (count === undefined) {
    console.error('[YAPE-DEBUG] Count is undefined in updateBadge');
    return;
  }
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
    
    // Always store the badge count in local storage for persistence
    chrome.storage.local.set({ badgeCount: count }, () => {
      console.log(`[YAPE-DEBUG] Stored badge count ${count} in local storage`);
    });

    // Set badge text to the count regardless of popup state - always keep it visible
    chrome.action.setBadgeText({ text: count.toString() });
    console.log(`[YAPE-DEBUG] Set badge text to: ${count}`);
    
    // Set badge background color (green)
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    console.log('[YAPE-DEBUG] Set badge background color to green');
  } catch (error) {
    console.error('[YAPE-DEBUG] Error updating badge:', error);
  }
}



// Initialize context menus
function initializeContextMenus() {
  console.log('[YAPE-DEBUG] Initializing context menus');
  
  // First, remove any existing context menus to prevent duplicates
  try {
    chrome.contextMenus.removeAll(() => {
      console.log('[YAPE-DEBUG] Cleared existing context menus');
      
      // Create the context menu after clearing existing ones
      try {
        chrome.contextMenus.create({
          id: 'yape',
          title: 'Download with Yape',
          contexts: ['link']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('[YAPE-DEBUG] Error creating context menu:', chrome.runtime.lastError);
            
            // Try again with a timeout - works around potential timing issues
            setTimeout(() => {
              try {
                chrome.contextMenus.create({
                  id: 'yape',
                  title: 'Download with Yape',
                  contexts: ['link']
                }, () => {
                  if (chrome.runtime.lastError) {
                    console.error('[YAPE-DEBUG] Second attempt failed:', chrome.runtime.lastError);
                  } else {
                    console.log('[YAPE-DEBUG] Context menu created successfully on second attempt');
                  }
                });
              } catch (secondError) {
                console.error('[YAPE-DEBUG] Error in second attempt:', secondError);
              }
            }, 1000);
          } else {
            console.log('[YAPE-DEBUG] Context menu created successfully');
          }
        });
      } catch (error) {
        console.error('[YAPE-DEBUG] Error creating context menu:', error);
        
        // Try again with a timeout as a fallback
        setTimeout(() => {
          try {
            chrome.contextMenus.create({
              id: 'yape',
              title: 'Download with Yape',
              contexts: ['link']
            });
            console.log('[YAPE-DEBUG] Context menu created via fallback');
          } catch (fallbackError) {
            console.error('[YAPE-DEBUG] Fallback creation also failed:', fallbackError);
          }
        }, 1500);
      }
    });
  } catch (error) {
    console.error('[YAPE-DEBUG] Error clearing context menus:', error);
    
    // Attempt to create the menu even if clearing failed
    setTimeout(() => {
      try {
        chrome.contextMenus.create({
          id: 'yape',
          title: 'Download with Yape',
          contexts: ['link']
        });
        console.log('[YAPE-DEBUG] Created context menu without clearing');
      } catch (createError) {
        console.error('[YAPE-DEBUG] Failed to create context menu:', createError);
      }
    }, 500);
  }

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('[YAPE-DEBUG] Context menu click detected:', info);
    handleContextMenuClick(info, tab);
  });
  
  console.log('[YAPE-DEBUG] Context menu initialization completed');
}

// Handle context menu clicks
async function handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  console.log('[YAPE-DEBUG] Context menu clicked:', info);
  
  try {
    // Make sure we have all the required data
    if (info.menuItemId !== 'yape') {
      console.log('[YAPE-DEBUG] Ignoring non-Yape context menu click:', info.menuItemId);
      return;
    }
    
    // Verify we have tab information
    if (!tab || !tab.id) {
      console.error('[YAPE-DEBUG] Missing tab information in context menu click');
      // Try to get the active tab as a fallback
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].id) {
          console.log('[YAPE-DEBUG] Using active tab as fallback');
          tab = tabs[0];
        } else {
          console.error('[YAPE-DEBUG] Could not find an active tab as fallback');
          // Show notification since we can't show a toast without a tab
          safeCreateNotification(`error-${Date.now()}`, {
            type: 'basic',
            title: 'Error',
            message: 'Failed to process download request: No active tab found.',
            iconUrl: './images/icon_128.png',
          }, 'failed');
          return;
        }
      } catch (error) {
        console.error('[YAPE-DEBUG] Error getting active tab:', error);
        safeCreateNotification(`error-${Date.now()}`, {
          type: 'basic',
          title: 'Error',
          message: 'Failed to process download request.',
          iconUrl: './images/icon_128.png',
        }, 'failed');
        return;
      }
    }
    // Show loading notification
    await showToast(tab.id, 'info', 'Requesting download...');

    // Get current state
    const state = await loadState();
    console.log('[YAPE-DEBUG] Current state:', state);
    
    // Check if logged in
    if (!state || !state.isLoggedIn) {
      console.log('[YAPE-DEBUG] Not logged in, showing error');
      await showToast(tab.id, 'error', 'Not logged in. Please configure your settings first.');
      // Open options page to help the user
      chrome.runtime.openOptionsPage();
      return;
    }
    
    // Verify we have a URL to download
    if (!info.linkUrl) {
      console.error('[YAPE-DEBUG] No link URL provided in context menu info');
      await showToast(tab.id, 'error', 'No URL found to download');
      return;
    }
    
    // Log the URL we're trying to download
    console.log('[YAPE-DEBUG] Attempting to download URL:', info.linkUrl);
    
    // Create PyLoad client
    const client = new PyloadClient(state.settings.connection);
    
    try {
      // Check server status and attempt login
      console.log('[YAPE-DEBUG] Checking server status...');
      const statusResponse = await client.getServerStatus();
      
      if (!statusResponse.success) {
        console.error('[YAPE-DEBUG] Server status check failed:', statusResponse);
        await showToast(tab.id, 'error', `Server error: ${statusResponse.message || 'Could not connect to PyLoad server'}`);
        return;
      }
      
      // Ensure we're logged in even if state says we are
      console.log('[YAPE-DEBUG] Logging in to PyLoad...');
      const loginResponse = await client.login();
      if (!loginResponse.success) {
        console.error('[YAPE-DEBUG] Login failed:', loginResponse);
        await showToast(tab.id, 'error', 'Login failed. Please check your credentials in settings.');
        // Update login state
        await updateState(currentState => ({
          ...currentState,
          isLoggedIn: false
        }));
        return;
      }
      
      // Check if URL is valid - this step is optional and can be bypassed if it fails
      console.log('[YAPE-DEBUG] Checking if URL is valid...');
      const checkResponse = await client.checkURL(info.linkUrl);
      
      if (!checkResponse.success) {
        console.warn('[YAPE-DEBUG] URL check failed, but continuing anyway:', checkResponse);
        // Don't return, just log warning and continue - some PyLoad versions
        // might not support URL checking or have different endpoint
      } else {
        console.log('[YAPE-DEBUG] URL check succeeded:', checkResponse);
      }
      
      // Generate a package name from the URL or link text
      let packageName = '';
      if (info.selectionText) {
        // If user selected text, use that as the package name
        packageName = info.selectionText.trim().replace(/[^a-z0-9._\-\s]/gi, '_').substring(0, 50);
        console.log('[YAPE-DEBUG] Using selection text for package name:', packageName);
      } else {
        // Otherwise use the URL
        try {
          const url = new URL(info.linkUrl);
          // Try to use the pathname as the package name
          const pathname = url.pathname;
          if (pathname && pathname !== '/') {
            // Get the last part of the pathname
            const parts = pathname.split('/');
            const lastPart = parts[parts.length - 1];
            if (lastPart) {
              packageName = decodeURIComponent(lastPart);
              console.log('[YAPE-DEBUG] Using pathname for package name:', packageName);
            } else {
              packageName = url.hostname;
              console.log('[YAPE-DEBUG] Using hostname for package name:', packageName);
            }
          } else {
            packageName = url.hostname;
            console.log('[YAPE-DEBUG] Using hostname for package name:', packageName);
          }
        } catch (error) {
          // Fallback if URL parsing fails
          packageName = info.linkUrl.replace(/[^a-z0-9._\-]/gi, '_');
          console.log('[YAPE-DEBUG] Using raw URL for package name (fallback):', packageName);
        }
        
        // Clean up the package name
        packageName = packageName.replace(/[^a-z0-9._\-\s]/gi, '_').substring(0, 50);
        console.log('[YAPE-DEBUG] Final package name:', packageName);
      }
      
      // Add package for download
      console.log('[YAPE-DEBUG] Adding package:', packageName, 'with URL:', info.linkUrl);
      const addResponse = await client.addPackage(packageName, info.linkUrl);
      
      if (!addResponse.success) {
        console.error('[YAPE-DEBUG] Failed to add package:', addResponse);
        await showToast(tab.id, 'error', `Error requesting download: ${addResponse.message || 'Unknown error'}`);
        return;
      }
      
      console.log('[YAPE-DEBUG] Package added successfully:', addResponse.data);
      
      // Store the package ID for tracking
      const packageId = addResponse.data;
      
      // Notify popup to refresh downloads with the package ID - handle potential errors
      try {
        // Check if popup is open before sending message
        console.log('[YAPE-DEBUG] Attempting to notify popup of added download...');
        chrome.runtime.sendMessage({ 
          type: 'download_added', 
          packageId: packageId, 
          packageName: packageName,
          url: info.linkUrl
        })
        .then(() => {
          console.log('[YAPE-DEBUG] Successfully notified popup of added download');
        })
        .catch(error => {
          // This will catch the error if popup isn't open
          console.log('[YAPE-DEBUG] Popup not open, storing refresh data for next open:', error);
          // Store details in local storage to refresh on next popup open
          chrome.storage.local.set({ 
            pendingRefresh: true,
            lastAddedPackage: {
              id: packageId,
              name: packageName,
              url: info.linkUrl,
              timestamp: Date.now()
            }
          });
          
          // Show a notification that the download was added
          safeCreateNotification(`download-added-${Date.now()}`, {
            type: 'basic',
            title: 'Download Added',
            message: `${packageName}`,
            iconUrl: './images/icon_128.png',
          }, 'added');
        });
      } catch (error) {
        console.warn('[YAPE-DEBUG] Failed to send message to popup - it might not be open:', error);
        // Store details in local storage to refresh on next popup open
        await chrome.storage.local.set({ 
          pendingRefresh: true,
          lastAddedPackage: {
            id: packageId,
            name: packageName,
            url: info.linkUrl,
            timestamp: Date.now()
          }
        });
        
        // Show a notification that the download was added
        safeCreateNotification(`download-added-${Date.now()}`, {
          type: 'basic',
          title: 'Download Added',
          message: `${packageName}`,
          iconUrl: './images/icon_128.png',
        }, 'added');
      }
      
      // Show success toast
      await showToast(tab.id, 'success', 'Download added successfully');
      
      // Also trigger a background check to refresh the badge and UI
      setTimeout(() => {
        console.log('[YAPE-DEBUG] Triggering background check to refresh download status...');
        checkForFinishedDownloads();
      }, 2000); // Wait 2 seconds before checking
      
    } catch (error) {
      console.error('[YAPE-DEBUG] Error in context menu handler:', error);
      
      // Try to show error toast if we have a tab
      if (tab && tab.id) {
        await showToast(tab.id, 'error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } else {
        // Show error notification if we don't have a tab
        safeCreateNotification(`error-${Date.now()}`, {
          type: 'basic',
          title: 'Error',
          message: `Failed to process download: ${error instanceof Error ? error.message : 'Unknown error'}`,
          iconUrl: './images/icon_128.png',
        }, 'failed');
      }
    }
  } catch (outerError) {
    console.error('[YAPE-DEBUG] Unhandled error in context menu handler:', outerError);
    // Show error notification for unhandled errors
    safeCreateNotification(`error-${Date.now()}`, {
      type: 'basic',
      title: 'Error',
      message: `Failed to process download request: ${outerError instanceof Error ? outerError.message : 'Unknown error'}`,
      iconUrl: './images/icon_128.png',
    }, 'failed');
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
      }, message.notificationType || 'completed');
    }
    
    // Handle settings update message
    if (message.type === 'settings_updated') {
      console.log('[YAPE-DEBUG] Background received settings update, reconfiguring background checks...');
      setupBackgroundChecks();
    }
    
    // Handle notification settings update message
    if (message.type === 'notification_settings_updated') {
      console.log('[YAPE-DEBUG] Background received notification settings update:', message.settings);
      // Store these settings in local storage for faster access
      chrome.storage.local.set({ notificationSettings: message.settings }, () => {
        console.log('[YAPE-DEBUG] Notification settings stored in local storage');
      });
    }
    
    // Handle restore badge message
    if (message.type === 'restore_badge' && message.count) {
      console.log(`[YAPE-DEBUG] Received request to restore badge with count: ${message.count}`);
      // Only update if the count is different from current
      if (finishedDownloadCount !== message.count) {
        updateBadge(message.count);
      } else {
        // Even if the count is the same, ensure the badge is visible
        chrome.action.setBadgeText({ text: message.count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
        console.log(`[YAPE-DEBUG] Ensured badge visibility with count: ${message.count}`);
      }
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
          message: `"${message.packageName || 'Package has been added to PyLoad'}"`,
          iconUrl: './images/icon_128.png',
        }, 'added');
      }
    }
    
    // Return true to indicate async response
    return true;
  });
}

// Helper function to show toast notifications in tabs
async function showToast(tabId: number | undefined, type: 'info' | 'success' | 'error' | 'warning', message: string): Promise<void> {
  if (tabId === undefined) {
    console.error('[YAPE-DEBUG] TabId is undefined in showToast');
    return;
  }
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
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[YAPE-DEBUG] Extension ${details.reason === 'install' ? 'installed' : 'updated'}, initializing...`);
  initializeExtension();
  
  // Special setup for extension installation
  if (details.reason === 'install') {
    chrome.storage.local.set({
      installationCompleted: true,
      installationDate: Date.now()
    });
    console.log('[YAPE-DEBUG] New installation recorded');
  }
  
  // Special handling for upgrade - ensure the context menu is recreated
  if (details.reason === 'update') {
    setTimeout(() => {
      console.log('[YAPE-DEBUG] Ensuring context menu is created after update...');
      initializeContextMenus();
    }, 1000);
  }
});

// Also run initialization when Chrome starts
chrome.runtime.onStartup.addListener(() => {
  console.log('[YAPE-DEBUG] Browser started, initializing extension...');
  initializeExtension();
  
  // Ensure context menu is created
  setTimeout(() => {
    console.log('[YAPE-DEBUG] Ensuring context menu is created after startup...');
    initializeContextMenus();
  }, 1000);
});

// Initialization function that runs when the extension loads
async function startup() {
  console.log('[YAPE-DEBUG] Service worker startup called');
  
  try {
    // Load previously stored notification IDs, badge count, and notification settings
    const storedData = await chrome.storage.local.get([
      'lastNotifiedDownloadIds', 
      'badgeCount',
      'notificationSettings'
    ]);
    
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
    
    // If notification settings don't exist, initialize them
    if (!storedData.notificationSettings) {
      console.log('[YAPE-DEBUG] Initializing notification settings in storage');
      chrome.storage.local.set({
        notificationSettings: {
          enabled: true,
          onDownloadAdded: true,
          onDownloadCompleted: true,
          onDownloadFailed: true,
          soundEnabled: false
        }
      });
    } else {
      console.log('[YAPE-DEBUG] Loaded notification settings:', storedData.notificationSettings);
    }
    
    // Restore badge if there was a previous count
    if (storedData.badgeCount && typeof storedData.badgeCount === 'number') {
      finishedDownloadCount = storedData.badgeCount;
      // Make sure the badge is visible
      chrome.action.setBadgeText({ text: finishedDownloadCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
      console.log(`[YAPE-DEBUG] Restored badge count to ${finishedDownloadCount}`);
    } else {
      // Make sure the badge is cleared if no count is stored
      chrome.action.setBadgeText({ text: '' });
      console.log('[YAPE-DEBUG] No stored badge count, cleared badge');
    }
    
    // Initialize the context menu
    console.log('[YAPE-DEBUG] Initializing context menus during startup');
    initializeContextMenus();
    
    // Set up background checks
    await setupBackgroundChecks();
    
    // Set up message handlers
    console.log('[YAPE-DEBUG] Initializing message handlers during startup');
    initializeMessageHandlers();
    
    // Run an immediate check after a short delay
    setTimeout(() => {
      console.log('[YAPE-DEBUG] Running immediate check after startup');
      checkForFinishedDownloads();
    }, 3000);
    
    // Log successful initialization
    console.log('[YAPE-DEBUG] Startup completed successfully');
  } catch (error) {
    console.error('[YAPE-DEBUG] Error during startup:', error);
    
    // Even if there was an error, try to initialize the core functionality
    try {
      initializeContextMenus();
      initializeMessageHandlers();
      console.log('[YAPE-DEBUG] Initialized core functionality despite startup error');
    } catch (secondaryError) {
      console.error('[YAPE-DEBUG] Failed to initialize core functionality:', secondaryError);
    }
  }
}

// Function to ensure badge is correctly displayed
async function ensureBadgeVisibility() {
  console.log('[YAPE-DEBUG] Ensuring badge visibility');
  try {
    const result = await chrome.storage.local.get(['badgeCount']);
    const storedCount = result.badgeCount;
    
    if (storedCount && storedCount > 0) {
      console.log(`[YAPE-DEBUG] Restoring badge with stored count: ${storedCount}`);
      // Restore the badge count
      chrome.action.setBadgeText({ text: storedCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
      finishedDownloadCount = storedCount;
    } else {
      console.log('[YAPE-DEBUG] No badge count stored or count is 0, clearing badge');
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('[YAPE-DEBUG] Error ensuring badge visibility:', error);
  }
}

// Call startup on module load
startup();

// Also add an interval to periodically check if the badge is visible
setInterval(ensureBadgeVisibility, 30000); // Check every 30 seconds
