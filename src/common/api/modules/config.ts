import { ApiResponse, PyloadConfigValue } from '../../types';
import { BaseApiClient } from './base';

/**
 * PyLoad-NG API methods related to configuration
 */
export class ConfigApiClient extends BaseApiClient {
  /**
   * Get speed limit status
   * GET /api/get_config_value?category=download&option=limit_speed
   * @returns API response with boolean config value
   */
  async getLimitSpeedStatus(): Promise<ApiResponse<PyloadConfigValue>> {
    return this.request<PyloadConfigValue>('get_config_value', {
      category: 'download',
      option: 'limit_speed'
    }, { method: 'GET' });
  }

  /**
   * Set speed limit status
   * POST /api/set_config_value with JSON body {category, option, value}
   * @param limitSpeed Speed limit status to set
   * @returns API response
   */
  async setLimitSpeedStatus(limitSpeed: boolean): Promise<ApiResponse<PyloadConfigValue>> {
    return this.request<PyloadConfigValue>('set_config_value', {
      category: 'download',
      option: 'limit_speed',
      value: limitSpeed
    });
  }
}
