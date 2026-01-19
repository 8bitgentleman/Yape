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
   * Login / validate credentials
   * GET /api/check_auth?username=X&password=Y
   * Returns empty object {} if invalid, user data object if valid
   */
  async login(): Promise<ApiResponse<boolean>> {
    const response = await this.request<object>('check_auth', {
      username: this.username,
      password: this.password
    }, { method: 'GET' });

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        message: response.message
      };
    }

    // check_auth returns empty object {} if credentials are invalid
    // Returns populated user object if valid
    const isValid = response.data && Object.keys(response.data).length > 0;

    if (isValid) {
      return {
        success: true,
        data: true
      };
    } else {
      return {
        success: false,
        data: false,
        error: 'login-failed',
        message: 'Invalid credentials'
      };
    }
  }
}
