import { ApiResponse, DownloadTask } from '../../types';
import { BaseApiClient } from './base';

/**
 * PyLoad API methods related to queue management
 */
export class QueueApiClient extends BaseApiClient {
  /**
   * Get queue data with enhanced debugging
   */
  async getQueueData(): Promise<ApiResponse<DownloadTask[]>> {
    try {
      const response = await this.request<any>('getQueueData');
      
      if (!response.success || !response.data) {
        return response as ApiResponse<DownloadTask[]>;
      }
      
      // Add detailed logging to help debug response format
      
      // if (typeof response.data === 'object' && !Array.isArray(response.data)) {
      //   console.log('[DEBUG] Object keys:', Object.keys(response.data));
      // }
      
      // Try to log full response structure
      try {
        console.log('[DEBUG] Full queue response structure:', JSON.stringify(response.data, null, 2));
      } catch (e) {
        console.warn('[DEBUG] Could not stringify response:', e);
      }
      
      // Process the queue data to match our DownloadTask format
      const tasks: DownloadTask[] = [];
      const data = response.data;
      
      // Process PyLoad 0.4.9 format with nested links array
      if (Array.isArray(data) && data.length > 0) {
        // Focus on extracting individual files from nested packages structure
        data.forEach((pkg: any, pkgIndex: number) => {
          
          // Check for the links array with files
          if (pkg.links && Array.isArray(pkg.links)) {
            pkg.links.forEach((link: any, linkIndex: number) => {
              // In PyLoad 0.4.9, status 0 is 'finished' and statusmsg can be 'finished', 'queued', etc.
              const isCompleted = link.status === 0 || link.statusmsg === 'finished';
              const isQueued = link.statusmsg === 'queued';
              const isFailed = link.statusmsg === 'failed' || link.error;
              
              let status = 'unknown';
              if (isCompleted) status = 'finished';
              else if (isQueued) status = 'queued';
              else if (isFailed) status = 'failed';
              else if (link.statusmsg) status = link.statusmsg;
              
              // Fill in percent based on status
              let percent = link.percent || 0;
              if (isCompleted) percent = 100;
              
              const task: DownloadTask = {
                id: String(link.fid || link.packageID || `pkg-${pkgIndex}-link-${linkIndex}`),
                name: String(link.name || pkg.name || 'Unknown'),
                status: status,
                url: String(link.url || ''),
                added: Number(pkg.added || Date.now() / 1000),
                percent: percent,
                size: Number(link.size || 0),
                speed: Number(link.speed || 0),
                eta: 0,
                format_eta: '00:00:00'
              };
              
              tasks.push(task);
            });
          }
        });
      }
      
      // Different PyLoad versions have different response formats
      // Try to handle packages array
      if (data.packages && Array.isArray(data.packages)) {
        console.log('Processing packages from getQueueData');
        data.packages.forEach((pkg: any, index: number) => {
          try {
            // Create a download task from package info
            const task: DownloadTask = {
              id: String(pkg.id || `pkg-${index}`),
              name: String(pkg.name || 'Unknown Package'),
              status: this.mapStatus(pkg.status || 'queued'),
              url: '',  // Package might not have URL directly
              added: Number(pkg.added || Date.now() / 1000),
              percent: Number(pkg.percent || 0),
              size: Number(pkg.size || 0),
              speed: Number(pkg.speed || 0),
              eta: Number(pkg.eta || 0),
              format_eta: String(pkg.format_eta || '00:00:00')
            };
            
            console.log(`Parsed package ${index}:`, task);
            tasks.push(task);
          } catch (e) {
            console.error(`Failed to parse package ${index}:`, e, pkg);
          }
        });
      }
      
      // Handle links/files in queue
      if (data.links && Array.isArray(data.links)) {
        console.log('Processing links from getQueueData');
        data.links.forEach((link: any, index: number) => {
          try {
            // Create a download task from link info
            const task: DownloadTask = {
              id: String(link.id || link.fid || `link-${index}`),
              name: String(link.name || link.filename || 'Unknown File'),
              status: this.mapStatus(link.status || 'queued'),
              url: String(link.url || link.link || ''),
              added: Number(link.added || Date.now() / 1000),
              percent: Number(link.percent || link.progress || 0),
              size: Number(link.size || link.filesize || 0),
              speed: Number(link.speed || 0),
              eta: Number(link.eta || 0),
              format_eta: String(link.format_eta || '00:00:00')
            };
            
            console.log(`Parsed link ${index}:`, task);
            tasks.push(task);
          } catch (e) {
            console.error(`Failed to parse link ${index}:`, e, link);
          }
        });
      }
      
      // Check for PyLoad 8+ format where files are in a different format
      if (data.files && Array.isArray(data.files)) {
        data.files.forEach((file: any, index: number) => {
          try {
            // Create a download task from file info
            const task: DownloadTask = {
              id: String(file.id || file.fid || `file-${index}`),
              name: String(file.name || file.filename || 'Unknown File'),
              status: this.mapStatus(file.status || file.statusmsg || 'queued'),
              url: String(file.url || file.link || ''),
              added: Number(file.added || file.addedTime || Date.now() / 1000),
              percent: Number(file.percent || file.completion || 0),
              size: Number(file.size || file.filesize || 0),
              speed: Number(file.speed || file.downloadSpeed || 0),
              eta: Number(file.eta || file.estimated_time || 0),
              format_eta: String(file.format_eta || file.estimated_time || '00:00:00')
            };
            
            tasks.push(task);
          } catch (e) {
            console.error(`[DEBUG] Failed to parse file ${index}:`, e, file);
          }
        });
      }
      
      // Check for PyLoad8+ format where data itself is the package
      if (!Array.isArray(data) && typeof data === 'object' && data.id && !tasks.length) {
        try {
          const task: DownloadTask = {
            id: String(data.id || 'pkg-direct'),
            name: String(data.name || 'Package'),
            status: this.mapStatus(data.status || 'queued'),
            url: '',
            added: Number(data.added || Date.now() / 1000),
            percent: Number(data.percent || 0),
            size: Number(data.size || 0),
            speed: Number(data.speed || 0),
            eta: Number(data.eta || 0),
            format_eta: String(data.format_eta || '00:00:00')
          };
          
          tasks.push(task);
        } catch (e) {
          console.error('[DEBUG] Failed to parse direct package:', e, data);
        }
      }
      
      return {
        success: true,
        data: tasks
      };
    } catch (error) {
      console.error('Error getting queue data:', error);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to get queue data'
      };
    }
  }

  /**
   * Add a package for download
   * @param name Package name
   * @param url URL to download
   */
  async addPackage(name: string, url: string): Promise<ApiResponse<any>> {
    const safeName = name.replace(/[^a-z0-9._\-]/gi, '_');
    
    console.log(`[YAPE-DEBUG] Adding package ${safeName} with URL ${url}`);
    
    try {
      // Try with both parameters JSON-encoded first (most common PyLoad format)
      const response = await this.request('addPackage', {
        name: JSON.stringify(safeName),
        links: JSON.stringify([url])
      });
      
      console.log(`[YAPE-DEBUG] addPackage response:`, response);
      
      // If the request failed, try with name not JSON-encoded
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

  /**
   * Remove a task
   * @param id Task ID
   */
  async removeTask(id: string): Promise<ApiResponse<boolean>> {
    console.log(`[DEBUG] Removing task with ID: ${id}`);
    try {
      // First, try to stop the download if it's running
      // PyLoad requires stopping downloads before deleting them
      try {
        const stopResponse = await this.request<boolean>('stopDownloads', {
          fids: JSON.stringify([id])
        });
        
        console.log(`[DEBUG] Stop download response:`, stopResponse);
      } catch (stopError) {
        // Log but don't fail if stopping fails - some PyLoad versions might not need this step
        console.warn(`[DEBUG] Error stopping download (continuing anyway):`, stopError);
      }
      
      // Wait a short delay to ensure the download is stopped
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try multiple methods to delete the task, as different PyLoad versions have different APIs
      let deleteSuccess = false;
      
      // First attempt: Try deleteFiles (most common for file tasks)
      try {
        const deleteResponse = await this.request<boolean>('deleteFiles', {
          fids: JSON.stringify([id])
        });
        
        console.log(`[DEBUG] Delete files response:`, deleteResponse);
        if (deleteResponse.success) {
          deleteSuccess = true;
        }
      } catch (deleteError) {
        console.warn(`[DEBUG] Error deleting file (trying next method):`, deleteError);
      }
      
      // Second attempt: Try deletePackages if we haven't succeeded yet
      if (!deleteSuccess) {
        try {
          console.log(`[DEBUG] Trying deletePackages as fallback...`);
          const packageResponse = await this.request<boolean>('deletePackages', {
            pids: JSON.stringify([id])
          });
          
          console.log(`[DEBUG] Delete packages response:`, packageResponse);
          if (packageResponse.success) {
            deleteSuccess = true;
          }
        } catch (packageError) {
          console.warn(`[DEBUG] Error deleting package (trying next method):`, packageError);
        }
      }
      
      // Third attempt: Try delete directly (some PyLoad versions use this)
      if (!deleteSuccess) {
        try {
          console.log(`[DEBUG] Trying direct 'delete' method as final fallback...`);
          const directResponse = await this.request<boolean>('delete', {
            id: id
          });
          
          console.log(`[DEBUG] Direct delete response:`, directResponse);
          if (directResponse.success) {
            deleteSuccess = true;
          }
        } catch (directError) {
          console.warn(`[DEBUG] Error with direct delete method:`, directError);
        }
      }
      
      // Return result based on whether any delete method worked
      return {
        success: deleteSuccess,
        data: deleteSuccess,
        message: deleteSuccess ? 'Successfully removed task' : 'Failed to remove task'
      };
    } catch (error) {
      console.error(`[DEBUG] Error removing task with ID ${id}:`, error);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to remove task'
      };
    }
  }

  /**
   * Check if a URL is valid for download
   * @param url URL to check
   */
  async checkURL(url: string): Promise<ApiResponse<any>> {
    return this.request('checkURLs', {
      urls: JSON.stringify([url])
    });
  }

  /**
   * Map PyLoad status to our TaskStatus enum
   */
  private mapStatus(status: string): string {
    const lowerStatus = String(status).toLowerCase();
    
    if (lowerStatus.includes('queue')) return 'queued';
    if (lowerStatus.includes('active') || lowerStatus.includes('download')) return 'active';
    if (lowerStatus.includes('wait')) return 'waiting';
    if (lowerStatus.includes('pause')) return 'paused';
    if (lowerStatus.includes('finish')) return 'finished';
    if (lowerStatus.includes('complete')) return 'complete';
    if (lowerStatus.includes('fail') || lowerStatus.includes('error')) return 'failed';
    
    return status;
  }

  /**
   * Remove all completed tasks from PyLoad queue
   * @returns API response
   */
  async clearFinishedTasks(): Promise<ApiResponse<boolean>> {
    try {
      // For PyLoad 0.4.9, we use the deleteFinished API endpoint
      // which removes all finished downloads in one call
      // According to PyLoad API docs, this takes no parameters
      const response = await this.request<any>('deleteFinished');
      console.log('[DEBUG] deleteFinished response:', response);
      
      // Check if the response contains deleted package IDs (as per PyLoad API docs)
      if (response.success && Array.isArray(response.data)) {
        console.log(`[DEBUG] Successfully cleared ${response.data.length} finished packages`);
      }
      
      // Return a simplified response for the UI
      return {
        success: response.success,
        data: true,
        message: response.success ? 'Successfully cleared finished tasks' : 'Failed to clear finished tasks'
      };
    } catch (error) {
      console.error('Error clearing finished tasks:', error);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to clear finished tasks'
      };
    }
  }
}
