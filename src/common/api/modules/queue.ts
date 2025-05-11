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
    console.log('[DEBUG] Calling getQueueData');
    try {
      const response = await this.request<any>('getQueueData');
      console.log('[DEBUG] getQueueData response:', response);
      
      if (!response.success || !response.data) {
        console.log('[DEBUG] No data in getQueueData response');
        return response as ApiResponse<DownloadTask[]>;
      }
      
      // Add detailed logging to help debug response format
      console.log('[DEBUG] Raw queueData response type:', typeof response.data);
      console.log('[DEBUG] isArray?', Array.isArray(response.data));
      
      if (typeof response.data === 'object' && !Array.isArray(response.data)) {
        console.log('[DEBUG] Object keys:', Object.keys(response.data));
      }
      
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
          console.log('[DEBUG] Processing package:', pkg.name || `pkg-${pkgIndex}`);
          
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
              
              console.log(`[DEBUG] Parsed PyLoad 0.4.9 file: ${task.name}, Status: ${status}, Percent: ${percent}`);
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
        console.log('[DEBUG] Processing files array from getQueueData');
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
            
            console.log(`[DEBUG] Parsed file ${index}:`, task);
            tasks.push(task);
          } catch (e) {
            console.error(`[DEBUG] Failed to parse file ${index}:`, e, file);
          }
        });
      }
      
      // Check for PyLoad8+ format where data itself is the package
      if (!Array.isArray(data) && typeof data === 'object' && data.id && !tasks.length) {
        console.log('[DEBUG] Processing single package from getQueueData');
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
          
          console.log('[DEBUG] Parsed direct package:', task);
          tasks.push(task);
        } catch (e) {
          console.error('[DEBUG] Failed to parse direct package:', e, data);
        }
      }
      
      console.log('Processed getQueueData tasks:', tasks);
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
    
    console.log(`Adding package: ${safeName}, URL: ${url}`);
    
    const response = await this.request('addPackage', {
      name: JSON.stringify(safeName),
      links: JSON.stringify([url])
    });
    
    console.log('Add package response:', response);
    
    return response;
  }

  /**
   * Remove a task
   * @param id Task ID
   */
  async removeTask(id: string): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('deletePackages', {
      ids: JSON.stringify([id])
    });
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
    console.log('[DEBUG] Clearing all finished tasks');
    try {
      // For PyLoad 0.4.9, we can use the deleteFinished API endpoint
      // which removes all finished downloads in one call
      const response = await this.request<any>('deleteFinished');
      console.log('[DEBUG] deleteFinished response:', response);
      
      // Also refresh the queue data to ensure we're in sync
      const queueRefreshResponse = await this.request<any>('getQueueData');
      
      if (response.success) {
        return response as ApiResponse<boolean>;
      } else {
        return {
          success: false,
          // Change 'failed-clear' to a known ApiError type, e.g., 'request-failed'
          // Or use a more generic one if available, like 'operation-failed' or 'server-error'
          error: 'request-failed', // Or another valid ApiError type
          message: 'Failed to clear finished tasks (specific: failed-clear)' // You can add more context here
        };
      }
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
