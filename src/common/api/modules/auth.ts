import { ApiResponse } from '../../types';
import { BaseApiClient } from './base';

/**
 * PyLoad API methods related to authentication and server status
 */
export class AuthApiClient extends BaseApiClient {
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
}
