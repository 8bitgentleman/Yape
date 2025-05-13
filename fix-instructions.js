// This file contains suggested changes for fixing the badge persistence issue and right-click context menu in YAPE
// These changes should be manually incorporated into the codebase

// 1. Add message handler for check_for_finished_downloads in the initializeMessageHandlers function
// in /src/background/index.ts

// Find this function:
function initializeMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[YAPE-DEBUG] Received message:', message.type);
    
    // Add this block after the existing handlers:
    
    // Handle check for finished downloads request
    if (message.type === 'check_for_finished_downloads') {
      console.log('[YAPE-DEBUG] Received request to check for finished downloads');
      // Run a check right away
      checkForFinishedDownloads();
    }
    
    // The rest of the existing message handlers...
  });
}

// 2. Modify the addPackage function in /src/common/api/modules/queue.ts to try different parameter formats

async addPackage(name: string, url: string): Promise<ApiResponse<any>> {
  const safeName = name.replace(/[^a-z0-9._\-]/gi, '_');
  
  console.log(`[YAPE-DEBUG] Adding package ${safeName} with URL ${url}`);
  
  try {
    // First, try with JSON.stringify for name (most common format)
    const response = await this.request('addPackage', {
      name: JSON.stringify(safeName),
      links: JSON.stringify([url])
    });
    
    console.log(`[YAPE-DEBUG] addPackage response:`, response);
    
    // If the request failed, try with regular name
    if (!response.success) {
      console.log(`[YAPE-DEBUG] First attempt failed, trying with regular name...`);
      
      const altResponse = await this.request('addPackage', {
        name: safeName,
        links: JSON.stringify([url])
      });
      
      console.log(`[YAPE-DEBUG] Alternative addPackage response:`, altResponse);
      
      // If that worked, return it
      if (altResponse.success) {
        return altResponse;
      }
      
      // Try with destination parameter (PyLoad 0.4.9 and earlier need this)
      console.log(`[YAPE-DEBUG] Second attempt failed, trying with dest parameter...`);
      const legacyResponse = await this.request('addPackage', {
        name: safeName,
        links: JSON.stringify([url]),
        dest: 1 // 1 = Queue in older PyLoad versions
      });
      
      console.log(`[YAPE-DEBUG] Legacy addPackage response:`, legacyResponse);
      
      // If that failed, try one more approach with dest and JSON name
      if (!legacyResponse.success) {
        console.log(`[YAPE-DEBUG] Third attempt failed, trying with dest parameter and JSON name...`);
        const finalAttempt = await this.request('addPackage', {
          name: JSON.stringify(safeName),
          links: JSON.stringify([url]),
          dest: 1
        });
        
        console.log(`[YAPE-DEBUG] Final addPackage attempt response:`, finalAttempt);
        return finalAttempt;
      }
      
      return legacyResponse;
    }
    
    return response;
  } catch (error) {
    console.error(`[YAPE-DEBUG] Error adding package:`, error);
    return {
      success: false,
      error: 'request-failed',
      message: error instanceof Error ? error.message : 'Failed to add package'
    };
  }
}

// 3. Add effect in the useDownloadManager hook to trigger badge updates in background
// Add this to the end of /src/popup/hooks/useDownloadManager.ts

// Add this effect at the appropriate place in the file:
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
    
    // Set up auto-refresh if enabled
    if (state.settings.ui.autoRefresh) {
      const interval = setInterval(() => {
        refreshData();
      }, state.settings.ui.refreshInterval);
      
      return () => {
        clearInterval(interval);
      };
    }
  }
}, [state, refreshData, refreshDataImmediate]);

// 4. Ensure badge persistence - modify updateBadge function in background/index.ts
// The key change is to always show the badge regardless of popup state:

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
    
    // Always store the badge count in local storage for persistence
    chrome.storage.local.set({ badgeCount: count }, () => {
      console.log(`[YAPE-DEBUG] Stored badge count ${count} in local storage`);
    });

    // Set badge text to the count - always show badge regardless of popup state
    chrome.action.setBadgeText({ text: count.toString() });
    console.log(`[YAPE-DEBUG] Set badge text to: ${count}`);
    
    // Set badge background color (green)
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    console.log('[YAPE-DEBUG] Set badge background color to green');
  } catch (error) {
    console.error('[YAPE-DEBUG] Error updating badge:', error);
  }
}

// 5. Modify the popup to regularly check the badge visibility - add to Popup.tsx:

// Add this effect to Popup.tsx:
useEffect(() => {
  // When popup opens
  chrome.runtime.sendMessage({ 
    type: 'check_for_finished_downloads'
  }).catch(error => {
    console.log('[YAPE-DEBUG] Error requesting downloads check:', error);
  });
  
  // When popup closes (cleanup function of the effect)
  return () => {
    // Request a check on popup close
    chrome.runtime.sendMessage({ 
      type: 'check_for_finished_downloads'
    }).catch(error => {
      console.log('[YAPE-DEBUG] Error requesting downloads check on close:', error);
    });
  };
}, []);