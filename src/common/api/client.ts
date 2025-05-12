import { ApiResponse, ConnectionSettings, DownloadTask, PyloadConfigValue } from '../types';
import { BaseApiClient } from './modules/base';
import { AuthApiClient } from './modules/auth';
import { DownloadsApiClient } from './modules/downloads';
import { QueueApiClient } from './modules/queue';
import { ConfigApiClient } from './modules/config';

/**
 * PyLoad API client that combines all module functionality
 */
export class PyloadClient {
  private authClient: AuthApiClient;
  private downloadsClient: DownloadsApiClient;
  private queueClient: QueueApiClient;
  private configClient: ConfigApiClient;

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
}
