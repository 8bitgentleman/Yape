import { ApiResponse, ServerStatus } from '../../types';
import { BaseApiClient } from './base';

/**
 * PyLoad-NG API methods related to authentication and server status
 */
export class AuthApiClient extends BaseApiClient {
  /**
   * Check server status
   * GET /api/status_server
   */
  async getServerStatus(): Promise<ApiResponse<ServerStatus>> {
    return this.request<ServerStatus>('status_server', {}, { method: 'GET' });
  }

  /**
   * Validate the API key by hitting status_server.
   * Returns 401 with "Invalid API key" if the key is wrong.
   */
  async login(): Promise<ApiResponse<boolean>> {
    const response = await this.request<object>('status_server', {}, { method: 'GET' });

    if (!response.success) {
      return {
        success: false,
        error: response.error ?? 'login-failed',
        message: response.message ?? 'Invalid API key'
      };
    }

    return { success: true, data: true };
  }
}
