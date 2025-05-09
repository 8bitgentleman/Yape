import { ApiError, ApiResponse, ConnectionSettings } from '../../types';

/**
 * Base PyLoad API client with core request functionality
 */
export class BaseApiClient {
  protected baseUrl: string;
  protected username: string;
  protected password: string;
  protected defaultTimeout: number;

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
      
      // Log raw response details
      console.log(`API Response status: ${response.status} ${response.statusText}`);
      console.log(`Response headers:`, Object.fromEntries([...response.headers.entries()]));
      console.log(`Response URL: ${response.url}`);
      
      // Create a clone to read the response body for logging
      const clonedResponse = response.clone();

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

      // Log the full response data
      try {
        const rawText = await clonedResponse.text();
        console.log('API raw response text:', rawText);
      } catch (e) {
        console.warn('Could not log raw response text:', e);
      }
      
      console.log('API parsed response:', data);

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
}
