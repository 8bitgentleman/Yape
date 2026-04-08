import { ApiError, ApiResponse, ConnectionSettings } from '../../types';

/**
 * Request options for the PyLoad-NG API
 */
export interface RequestOptions {
  method?: 'GET' | 'POST';
  timeout?: number;
  /**
   * For POST requests: send params as query string instead of JSON body.
   * Required for endpoints like restart_file that use POST with query params.
   */
  useQueryParams?: boolean;
}

/**
 * Base PyLoad-NG API client with core request functionality
 * Uses X-API-Key header authentication
 */
export class BaseApiClient {
  protected baseUrl: string;
  protected apiKey: string;
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

    this.apiKey = settings.apiKey;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Make a request to the PyLoad-NG API
   * @param endpoint API endpoint (snake_case)
   * @param params Request parameters
   * @param options Request options
   * @returns API response
   */
  async request<T>(
    endpoint: string,
    params: Record<string, any> = {},
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'POST', timeout = this.defaultTimeout, useQueryParams = false } = options;

    console.log(`[YAPE-DEBUG] Making API request to ${endpoint}`, {
      method,
      useQueryParams,
      params: JSON.stringify(params, null, 2)
    });

    // Prepare URL and query parameters
    let url: URL;
    try {
      url = new URL(`${this.baseUrl}/api/${endpoint}`);
    } catch (error) {
      console.error(`[YAPE-DEBUG] Invalid URL: ${this.baseUrl}/api/${endpoint}`, error);
      return {
        success: false,
        error: 'connection-error',
        message: `Invalid server URL: ${this.baseUrl}/api/${endpoint}`
      };
    }

    // For GET requests OR POST with useQueryParams, append params as query string
    if (method === 'GET' || useQueryParams) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          );
        }
      });
    }

    // Prepare request options with API key auth
    const requestInit: RequestInit = {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json'
      }
    };

    // Add JSON body for POST requests (unless using query params)
    if (method === 'POST' && !useQueryParams) {
      (requestInit.headers as Record<string, string>)['Content-Type'] = 'application/json';
      requestInit.body = JSON.stringify(params);
      console.log(`[YAPE-DEBUG] POST body:`, params);
    }

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      requestInit.signal = controller.signal;

      // Execute fetch request
      const response = await fetch(url.toString(), requestInit);
      clearTimeout(timeoutId);

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
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: 'login-failed',
            message: 'Invalid credentials. Check username and password.'
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
