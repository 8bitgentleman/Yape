import { ApiResponse, CaptchaTask } from '../../types';
import { BaseApiClient } from './base';

/**
 * PyLoad-NG API methods related to captcha handling
 */
export class CaptchaApiClient extends BaseApiClient {
  /**
   * Check if a captcha task is waiting
   * GET /api/is_captcha_waiting
   * @returns true if captcha is waiting, false otherwise
   */
  async isCaptchaWaiting(): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('is_captcha_waiting', {}, { method: 'GET' });
  }

  /**
   * Get the current captcha task
   * GET /api/get_captcha_task
   * @returns CaptchaTask with tid, data, type, and result_type
   */
  async getCaptchaTask(): Promise<ApiResponse<CaptchaTask>> {
    return this.request<CaptchaTask>('get_captcha_task', {}, { method: 'GET' });
  }

  /**
   * Get status of a captcha task
   * GET /api/get_captcha_task_status?tid=X
   * @param tid Task ID
   * @returns Status string
   */
  async getCaptchaTaskStatus(tid: number): Promise<ApiResponse<string>> {
    return this.request<string>('get_captcha_task_status', { tid }, { method: 'GET' });
  }

  /**
   * Submit captcha result
   * POST /api/set_captcha_result?tid=X&result=Y (uses query params)
   * @param tid Task ID
   * @param result Captcha solution
   */
  async setCaptchaResult(tid: number, result: string): Promise<ApiResponse<void>> {
    return this.request<void>('set_captcha_result', { tid, result }, {
      method: 'POST',
      useQueryParams: true
    });
  }
}
