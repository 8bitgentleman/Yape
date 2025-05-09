import { ApiError, ApiResponse, ConnectionSettings, PyloadConfigValue, DownloadTask, TaskStatus } from '../types';

/**
 * Base PyLoad API client class
 */
export class PyloadClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private defaultTimeout: number;

  /**
   * Create a new PyloadClient instance
   * @param settings Connection settings
   * @param defaultTimeout Default timeout in milliseconds
   */
  constructor(settings: ConnectionSettings, defaultTimeout: number = 10000) {
    const { protocol, hostname, port, path } = settings;
    this.baseUrl = `${protocol}://${hostname}:${port}${path}`;
    
    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }

    this.username = settings.username;
    this.password = settings.password;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Make a request to the PyLoad API
   * @param endpoint API endpoint
   * @param params Request parameters
   * @param options Request options
   * @returns API response
   */
  async request<T>(
    endpoint: string, 
    params: Record<string, any> = {}, 
    options: { method?: 'GET' | 'POST', timeout?: number } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'POST', timeout = this.defaultTimeout } = options;
    
    // Prepare URL and query parameters
    const url = new URL(`${this.baseUrl}/api/${endpoint}`);
    
    if (method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, 
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          );
        }
      });
    }

    // Prepare request options
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    // Add body for POST requests
    if (method === 'POST') {
      const formData = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, 
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          );
        }
      });
      
      requestInit.body = formData;
    }

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      requestInit.signal = controller.signal;

      // Execute fetch request
      console.log(`Making API request to: ${url.toString()}`);
      const response = await fetch(url.toString(), requestInit);
      clearTimeout(timeoutId);

      // Parse response
      const contentType = response.headers.get('content-type') || '';
      let data;
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.log(`Received non-JSON response: ${text}`);
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse response as JSON', e);
          data = { error: 'Invalid JSON response' };
        }
      }

      console.log('API response:', data);

      // Handle API errors
      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 403) {
          return { 
            success: false, 
            error: 'login-failed', 
            message: 'Invalid credentials. Make sure you are logged in.'
          };
        }
        
        return { 
          success: false, 
          error: 'server-error', 
          message: data && data.error ? data.error : 'Server returned an error'
        };
      }

      // Check for API error in response
      if (data && data.hasOwnProperty('error') && data.error) {
        return { 
          success: false, 
          error: 'request-failed', 
          message: data.error
        };
      }

      // Return successful response
      return { 
        success: true, 
        data: data as T 
      };
    } catch (error) {
      console.error('API request error:', error);
      
      // Handle fetch errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { 
          success: false, 
          error: 'timeout', 
          message: 'Request timed out'
        };
      }
      
      return { 
        success: false, 
        error: 'connection-error', 
        message: error instanceof Error ? error.message : 'Failed to connect to server'
      };
    }
  }

  /**
   * Check server status
   */
  async getServerStatus(): Promise<ApiResponse<any>> {
    return this.request('statusServer');
  }

  /**
   * Login to PyLoad
   */
  async login(): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('login', {
      username: this.username,
      password: this.password
    });
  }

  /**
   * Get status of all downloads
   */
  async getStatusDownloads(): Promise<ApiResponse<DownloadTask[]>> {
    const response = await this.request<any[]>('statusDownloads');
    
    if (!response.success || !response.data) {
      return response as ApiResponse<DownloadTask[]>;
    }
    
    try {
      // Map the API response to our DownloadTask interface
      const tasks: DownloadTask[] = [];
      
      // Different versions of PyLoad have different response formats
      // Try to handle them generically
      if (Array.isArray(response.data)) {
        // Try to map each item to a DownloadTask
        response.data.forEach((item: any) => {
          if (item) {
            try {
              // Extract required fields with fallbacks
              const task: DownloadTask = {
                id: String(item.id || item.fid || '0'),
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
              
              tasks.push(task);
            } catch (e) {
              console.error('Failed to parse download task:', e, item);
            }
          }
        });
      } else if (typeof response.data === 'object') {
        // Some PyLoad versions return an object with queue, collector properties
        const data = response.data as any;
        
        // Try to handle queue data
        if (data.queue && Array.isArray(data.queue)) {
          data.queue.forEach((item: any) => {
            try {
              const task: DownloadTask = {
                id: String(item.id || '0'),
                name: String(item.name || 'Unknown'),
                status: TaskStatus.Queued,
                url: String(item.url || ''),
                added: Number(item.added || Date.now() / 1000),
                percent: 0,
                size: Number(item.size || 0),
                speed: 0,
                eta: 0,
                format_eta: '00:00:00'
              };
              
              tasks.push(task);
            } catch (e) {
              console.error('Failed to parse queue task:', e, item);
            }
          });
        }
        
        // Try to handle collector data (finished downloads)
        if (data.collector && Array.isArray(data.collector)) {
          data.collector.forEach((item: any) => {
            try {
              const task: DownloadTask = {
                id: String(item.id || '0'),
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
              
              tasks.push(task);
            } catch (e) {
              console.error('Failed to parse collector task:', e, item);
            }
          });
        }
      }
      
      console.log('Processed download tasks:', tasks);
      return {
        success: true,
        data: tasks
      };
    } catch (e) {
      console.error('Failed to process download tasks:', e, response.data);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to process download tasks'
      };
    }
  }

  /**
   * Map PyLoad status to our TaskStatus enum
   */
  private mapStatus(status: string): TaskStatus | string {
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

  /**
   * Get queue data
   */
  async getQueueData(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('getQueueData');
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
   * Get speed limit status
   * @returns API response with data that could be boolean or string
   */
  async getLimitSpeedStatus(): Promise<ApiResponse<PyloadConfigValue>> {
    return this.request<PyloadConfigValue>('getConfigValue', {
      category: JSON.stringify("download"),
      option: JSON.stringify("limit_speed")
    });
  }

  /**
   * Set speed limit status
   * @param limitSpeed Speed limit status to set
   * @returns API response with boolean or string result
   */
  async setLimitSpeedStatus(limitSpeed: boolean): Promise<ApiResponse<PyloadConfigValue>> {
    return this.request<PyloadConfigValue>('setConfigValue', {
      category: JSON.stringify("download"),
      option: JSON.stringify("limit_speed"),
      value: JSON.stringify(limitSpeed.toString())
    });
  }
}
