/**
 * Notification utility functions
 */

/**
 * Show a Chrome notification
 * @param title Notification title
 * @param message Notification message
 */
export function showNotification(title: string, message: string): Promise<string> {
  return new Promise((resolve) => {
    chrome.notifications.create(
      {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon_128.png'),
        title: title || 'Yape',
        message: message || '',
      },
      (notificationId) => {
        resolve(notificationId);
      }
    );
  });
}

/**
 * Show a toast notification in a tab
 * @param tabId Tab ID
 * @param type Toast type
 * @param message Toast message
 */
export async function showToast(
  tabId: number, 
  type: 'info' | 'success' | 'error' | 'warning', 
  message: string
): Promise<void> {
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

/**
 * Send a message to the background script
 * @param message Message object
 */
export function sendMessage<T = any>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}
