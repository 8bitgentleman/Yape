import { ApiResponse, PyloadConfigValue } from '../../types';
import { BaseApiClient } from './base';

/**
 * PyLoad API methods related to configuration
 */
export class ConfigApiClient extends BaseApiClient {
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
