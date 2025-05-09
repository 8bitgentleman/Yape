import { loadState, updateState } from '../common/state';
import { PyloadClient } from '../common/api/client';
import { ApiResponse, ConnectionSettings } from '../common/types';

// Initialize the extension
async function initializeExtension() {
  // Setup context menus
  initializeContextMenus();
  
  // Set up message listeners
  initializeMessageHandlers();

  console.log('Yape background service initialized');
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
      
      // Notify popup to refresh downloads
      chrome.runtime.sendMessage({ type: 'download_added' });
      
      await showToast(tab.id, 'success', 'Download added successfully');
    }
  }
}

// Initialize message handlers
function initializeMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle show notification message
    if (message.type === 'notification') {
      chrome.notifications.create('', {
        type: 'basic',
        title: message.title || 'Yape',
        message: message.message || '',
        iconUrl: './images/icon_128.png',
      });
    }
    
    // Add more message handlers here
    
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

// Initialize extension when installed or started
chrome.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

// Also run initialization when Chrome starts
chrome.runtime.onStartup.addListener(() => {
  initializeExtension();
});
