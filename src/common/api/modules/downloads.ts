import { ApiResponse, DownloadTask, TaskStatus } from '../../types';
import { BaseApiClient } from './base';
import { QueueApiClient } from './queue';

/**
 * PyLoad API methods related to downloads
 */
export class DownloadsApiClient extends BaseApiClient {
  private queueClient: QueueApiClient;
  
  constructor(settings: any, defaultTimeout: number = 10000) {
    super(settings, defaultTimeout);
    this.queueClient = new QueueApiClient(settings, defaultTimeout);
  }
  /**
   * Get status of all downloads with extra debugging
   */
  async getStatusDownloads(): Promise<ApiResponse<DownloadTask[]>> {
    console.log('[DEBUG] Calling getStatusDownloads');
    try {
      const response = await this.request<any>('statusDownloads');
      
      console.log('[DEBUG] getStatusDownloads response:', response);
      
      if (!response.success || !response.data) {
        console.error('[DEBUG] Failed to get downloads status:', response);
        return response as ApiResponse<DownloadTask[]>;
      }
      
      // Add detailed logging to help debug response format
      console.log('[DEBUG] Raw statusDownloads response type:', typeof response.data);
      console.log('[DEBUG] isArray?', Array.isArray(response.data));
      
      if (typeof response.data === 'object' && !Array.isArray(response.data)) {
        console.log('[DEBUG] Object keys:', Object.keys(response.data));
      }
      
      // Try to log full response structure
      try {
        console.log('[DEBUG] Full response structure:', JSON.stringify(response.data, null, 2));
      } catch (e) {
        console.warn('[DEBUG] Could not stringify response:', e);
      }
      
      // Special debug step: check if the response is "total" value only, with no downloads
      // This is a specific PyLoad format that means there are no current downloads
      if (typeof response.data === 'object' && !Array.isArray(response.data) &&
          'total' in response.data && Object.keys(response.data).length <= 5) {
        console.log('[DEBUG] Detected PyLoad status-only response with no tasks');
        
        // Check for active downloads in the special PyLoad format
        if ('active' in response.data && typeof response.data.active === 'number') {
          
          console.log('[DEBUG] Found active downloads count:', response.data.active);
          
          // If there are active downloads but they're not in the response object
          // Try using getQueueData to get the active downloads
          if (response.data.active > 0) {
            console.log('[DEBUG] Found active downloads, but need to get queue data');
            
            // Make a direct call to get the queue data since active count > 0
            try {
              const queueResponse = await this.queueClient.getQueueData();
              if (queueResponse.success && queueResponse.data && queueResponse.data.length > 0) {
                console.log('[DEBUG] Successfully got queue data with tasks:', queueResponse.data.length);
                return queueResponse;
              }
            } catch (queueError) {
              console.error('[DEBUG] Error getting queue data:', queueError);
            }
          }
        }
        
        // Return empty array in this case, as there are no downloads
        return {
          success: true,
          data: []
        };
      }
      
      // Map the API response to our DownloadTask interface
      const tasks: DownloadTask[] = [];
      
      // Check if data is array
      if (Array.isArray(response.data)) {
        console.log('Handling array response format');
        
        // Try to map each item to a DownloadTask
        response.data.forEach((item: any, index: number) => {
          if (item) {
            try {
              // Extract required fields with fallbacks
              // Use downloaded size (bleft) if available
              const bytesTotal = Number(item.size || item.total_size || 0);
              const bytesLoaded = item.bleft ? (bytesTotal - Number(item.bleft)) : (bytesTotal * (Number(item.percent || 0) / 100));
              
              const task: DownloadTask = {
                id: String(item.id || item.fid || `unknown-${index}`),
                name: String(item.name || item.packageName || 'Unknown'),
                status: this.mapStatus(item.status || item.statusmsg || 'unknown'),
                url: String(item.url || item.host || ''),
                added: Number(item.added || Date.now() / 1000),
                percent: Number(item.percent || item.progress || 0),
                size: bytesTotal,
                bytesLoaded: bytesLoaded, // Add bytesLoaded property
                speed: Number(item.speed || item.download_speed || 0),
                eta: Number(item.eta || 0),
                format_eta: String(item.format_eta || item.eta || '00:00:00')
              };
              
              console.log(`Parsed download task ${index}:`, task);
              tasks.push(task);
            } catch (e) {
              console.error(`Failed to parse download task ${index}:`, e, item);
            }
          }
        });
      } else if (typeof response.data === 'object') {
        console.log('Handling object response format');
        this.processObjectResponse(response.data, tasks);
      }
      
      console.log('Final processed download tasks:', tasks);
      return {
        success: true,
        data: tasks
      };
    } catch (e) {
      console.error('Failed to process download tasks:', e);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to process download tasks'
      };
    }
  }

  /**
   * Process PyLoad response object to extract tasks
   */
  private processObjectResponse(data: any, tasks: DownloadTask[]): void {
    // Check for downloads property (used in some PyLoad versions)
    if (data.downloads && Array.isArray(data.downloads)) {
      console.log('Processing downloads array from response');
      data.downloads.forEach((item: any, index: number) => {
        try {
          // Extract task info
          const task: DownloadTask = {
            id: String(item.id || item.fid || `download-${index}`),
            name: String(item.name || item.packageName || 'Unknown'),
            status: this.mapStatus(item.status || item.statusmsg || 'unknown'),
            url: String(item.url || item.host || ''),
            added: Number(item.added || Date.now() / 1000),
            percent: Number(item.percent || item.progress || 0),
            size: Number(item.size || item.total_size || 0),
            speed: Number(item.speed || item.download_speed || 0),
            eta: Number(item.eta || 0),
            format_eta: String(item.format_eta || item.eta || '00:00:00')
          };
          
          console.log(`Parsed download from downloads array ${index}:`, task);
          tasks.push(task);
        } catch (e) {
          console.error(`Failed to parse download ${index}:`, e, item);
        }
      });
    }
    
    // Try to handle queue data
    if (data.queue && Array.isArray(data.queue)) {
      console.log('Processing queue array from response');
      data.queue.forEach((item: any, index: number) => {
        try {
          const task: DownloadTask = {
            id: String(item.id || item.fid || `queue-${index}`),
            name: String(item.name || 'Unknown'),
            status: TaskStatus.Queued,
            url: String(item.url || ''),
            added: Number(item.added || Date.now() / 1000),
            percent: Number(item.percent || 0),
            size: Number(item.size || 0),
            speed: Number(item.speed || 0),
            eta: Number(item.eta || 0),
            format_eta: String(item.format_eta || '00:00:00')
          };
          
          console.log(`Parsed queue task ${index}:`, task);
          tasks.push(task);
        } catch (e) {
          console.error(`Failed to parse queue task ${index}:`, e, item);
        }
      });
    }
    
    // Try to handle collector data (finished downloads)
    if (data.collector && Array.isArray(data.collector)) {
      console.log('Processing collector array from response');
      data.collector.forEach((item: any, index: number) => {
        try {
          const task: DownloadTask = {
            id: String(item.id || item.fid || `collector-${index}`),
            name: String(item.name || 'Unknown'),
            status: TaskStatus.Finished,
            url: String(item.url || ''),
            added: Number(item.added || Date.now() / 1000),
            percent: 100,
            size: Number(item.size || 0),
            speed: 0,
            eta: 0,
            format_eta: '00:00:00'
          };
          
          console.log(`Parsed collector task ${index}:`, task);
          tasks.push(task);
        } catch (e) {
          console.error(`Failed to parse collector task ${index}:`, e, item);
        }
      });
    }
  }

  /**
   * Map PyLoad status to our TaskStatus enum
   */
  private mapStatus(status: string | number): TaskStatus | string {
    // If status is a number, convert it to a string representation first
    if (typeof status === 'number') {
      // Map common PyLoad numeric status codes
      switch (status) {
        case 1: return TaskStatus.Waiting;
        case 2: return TaskStatus.Waiting;
        case 3: return TaskStatus.Waiting;
        case 7: return TaskStatus.Paused;
        case 12: return TaskStatus.Active; // Downloading
        case 13: return TaskStatus.Active; // Processing
        case 9: return TaskStatus.Finished;
        case 10: return TaskStatus.Finished;
        case 11: return TaskStatus.Failed;
        default: return `status-${status}`; // Return as string for unknown codes
      }
    }
    
    // Handle string status
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus.includes('queue')) return TaskStatus.Queued;
    if (lowerStatus.includes('active') || lowerStatus.includes('download')) return TaskStatus.Active;
    if (lowerStatus.includes('wait')) return TaskStatus.Waiting;
    if (lowerStatus.includes('pause')) return TaskStatus.Paused;
    if (lowerStatus.includes('finish')) return TaskStatus.Finished;
    if (lowerStatus.includes('complete')) return TaskStatus.Complete;
    if (lowerStatus.includes('fail') || lowerStatus.includes('error')) return TaskStatus.Failed;
    
    return status;
  }
}
