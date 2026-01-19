import { ApiResponse, ConnectionSettings, DownloadTask, PyloadConfigValue, CaptchaTask } from '../types';
import { BaseApiClient, RequestOptions } from './modules/base';
import { AuthApiClient } from './modules/auth';
import { DownloadsApiClient } from './modules/downloads';
import { QueueApiClient } from './modules/queue';
import { ConfigApiClient } from './modules/config';
import { CaptchaApiClient } from './modules/captcha';

/**
 * PyLoad API client that combines all module functionality
 */
export class PyloadClient {
  private authClient: AuthApiClient;
  private downloadsClient: DownloadsApiClient;
  private queueClient: QueueApiClient;
  private configClient: ConfigApiClient;
  private captchaClient: CaptchaApiClient;

  /**
   * Create a new PyloadClient instance
   * @param settings Connection settings
   * @param defaultTimeout Default timeout in milliseconds
   */
  constructor(settings: ConnectionSettings, defaultTimeout: number = 10000) {
    this.authClient = new AuthApiClient(settings, defaultTimeout);
    this.downloadsClient = new DownloadsApiClient(settings, defaultTimeout);
    this.queueClient = new QueueApiClient(settings, defaultTimeout);
    this.configClient = new ConfigApiClient(settings, defaultTimeout);
    this.captchaClient = new CaptchaApiClient(settings, defaultTimeout);
  }

  // Auth methods
  async getServerStatus(): Promise<ApiResponse<any>> {
    return this.authClient.getServerStatus();
  }

  async login(): Promise<ApiResponse<boolean>> {
    return this.authClient.login();
  }

  // Downloads methods
  async getStatusDownloads(): Promise<ApiResponse<DownloadTask[]>> {
    return this.downloadsClient.getStatusDownloads();
  }

  async pauseDownload(fid: string): Promise<ApiResponse<boolean>> {
    return this.downloadsClient.pauseDownload(fid);
  }

  async resumeDownload(fid: string): Promise<ApiResponse<boolean>> {
    return this.downloadsClient.resumeDownload(fid);
  }

  // Queue methods
  async getQueueData(): Promise<ApiResponse<DownloadTask[]>> {
    return this.queueClient.getQueueData();
  }

  async addPackage(name: string, url: string): Promise<ApiResponse<any>> {
    return this.queueClient.addPackage(name, url);
  }

  async removeTask(id: string): Promise<ApiResponse<boolean>> {
    return this.queueClient.removeTask(id);
  }

  async checkURL(url: string): Promise<ApiResponse<any>> {
    return this.queueClient.checkURL(url);
  }

  // Config methods
  async getLimitSpeedStatus(): Promise<ApiResponse<PyloadConfigValue>> {
    return this.configClient.getLimitSpeedStatus();
  }

  async setLimitSpeedStatus(limitSpeed: boolean): Promise<ApiResponse<PyloadConfigValue>> {
    return this.configClient.setLimitSpeedStatus(limitSpeed);
  }

  /**
   * Remove all completed tasks from PyLoad queue
   */
  async clearFinishedTasks(): Promise<ApiResponse<boolean>> {
    return this.queueClient.clearFinishedTasks();
  }

  // Captcha methods
  /**
   * Check if a captcha task is waiting to be solved
   */
  async isCaptchaWaiting(): Promise<ApiResponse<boolean>> {
    return this.captchaClient.isCaptchaWaiting();
  }

  /**
   * Get the current captcha task details
   */
  async getCaptchaTask(): Promise<ApiResponse<CaptchaTask>> {
    return this.captchaClient.getCaptchaTask();
  }

  /**
   * Get status of a specific captcha task
   */
  async getCaptchaTaskStatus(tid: number): Promise<ApiResponse<string>> {
    return this.captchaClient.getCaptchaTaskStatus(tid);
  }

  /**
   * Submit captcha solution
   */
  async setCaptchaResult(tid: number, result: string): Promise<ApiResponse<void>> {
    return this.captchaClient.setCaptchaResult(tid, result);
  }

  /**
   * Make a raw API request (for advanced usage)
   * @param endpoint API endpoint
   * @param params Request parameters
   * @param options Request options
   */
  async request<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.queueClient['request']<T>(endpoint, params, options);
  }
}
