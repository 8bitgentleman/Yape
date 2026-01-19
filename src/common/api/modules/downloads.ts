import { ApiResponse, DownloadTask, TaskStatus, DownloadInfo } from '../../types';
import { BaseApiClient } from './base';
import { QueueApiClient } from './queue';

/**
 * PyLoad-NG API methods related to downloads
 */
export class DownloadsApiClient extends BaseApiClient {
  private queueClient: QueueApiClient;

  constructor(settings: any, defaultTimeout: number = 10000) {
    super(settings, defaultTimeout);
    this.queueClient = new QueueApiClient(settings, defaultTimeout);
  }

  /**
   * Pause/stop a download
   * POST /api/stop_downloads with JSON body {file_ids: [id]}
   */
  async pauseDownload(fid: string): Promise<ApiResponse<boolean>> {
    try {
      console.log(`[DEBUG] Pausing download ${fid}`);
      const response = await this.request<void>('stop_downloads', {
        file_ids: [parseInt(fid, 10)]
      });

      return {
        success: response.success,
        data: response.success
      };
    } catch (e) {
      console.error('Failed to pause download:', e);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to pause download'
      };
    }
  }

  /**
   * Resume/restart a download
   * POST /api/restart_file?file_id=X (uses query param, not JSON body)
   */
  async resumeDownload(fid: string): Promise<ApiResponse<boolean>> {
    try {
      console.log(`[DEBUG] Resuming download ${fid}`);
      // restart_file uses query parameter, not JSON body
      const response = await this.request<void>('restart_file', {
        file_id: parseInt(fid, 10)
      }, { method: 'POST', useQueryParams: true });

      return {
        success: response.success,
        data: response.success
      };
    } catch (e) {
      console.error('Failed to resume download:', e);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to resume download'
      };
    }
  }

  /**
   * Get status of all active downloads
   * GET /api/status_downloads
   */
  async getStatusDownloads(): Promise<ApiResponse<DownloadTask[]>> {
    console.log('[DEBUG] Calling getStatusDownloads');
    try {
      const response = await this.request<DownloadInfo[]>('status_downloads', {}, { method: 'GET' });

      console.log('[DEBUG] getStatusDownloads response:', response);

      if (!response.success || !response.data) {
        console.error('[DEBUG] Failed to get downloads status:', response);
        return {
          success: response.success,
          error: response.error,
          message: response.message,
          data: []
        };
      }

      // Log response structure
      console.log('[DEBUG] Raw status_downloads response type:', typeof response.data);
      console.log('[DEBUG] isArray?', Array.isArray(response.data));

      try {
        console.log('[DEBUG] Full response structure:', JSON.stringify(response.data, null, 2));
      } catch (e) {
        console.warn('[DEBUG] Could not stringify response:', e);
      }

      // status_downloads returns empty array [] when no active downloads
      if (Array.isArray(response.data) && response.data.length === 0) {
        console.log('[DEBUG] No active downloads, checking queue for tasks');

        // Get queue data to show all tasks
        const queueResponse = await this.queueClient.getQueueData();
        if (queueResponse.success && queueResponse.data) {
          return queueResponse;
        }

        return {
          success: true,
          data: []
        };
      }

      // Map DownloadInfo to DownloadTask
      const tasks: DownloadTask[] = response.data.map((item: DownloadInfo, index: number) => {
        const bytesTotal = Number(item.size || 0);
        const bytesLoaded = item.bleft ? (bytesTotal - Number(item.bleft)) : (bytesTotal * (Number(item.percent || 0) / 100));

        return {
          id: String(item.fid),
          name: String(item.name || 'Unknown'),
          status: this.mapStatus(item.status, item.statusmsg),
          url: '',
          added: Date.now() / 1000,
          percent: Number(item.percent || 0),
          size: bytesTotal,
          bytesLoaded: bytesLoaded,
          speed: Number(item.speed || 0),
          eta: Number(item.eta || 0),
          format_eta: String(item.format_eta || '00:00:00')
        };
      });

      console.log('Final processed download tasks:', tasks);
      return {
        success: true,
        data: tasks
      };
    } catch (e) {
      console.error('Failed to process download tasks:', e);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to process download tasks'
      };
    }
  }

  /**
   * Map PyLoad-NG numeric status to TaskStatus enum
   * Based on OpenAPI DownloadStatus enum:
   * 0=FINISHED, 1=OFFLINE, 2=ONLINE, 3=QUEUED, 4=SKIPPED, 5=WAITING,
   * 6=TEMPOFFLINE, 7=STARTING, 8=FAILED, 9=ABORTED, 10=DECRYPTING,
   * 11=CUSTOM, 12=DOWNLOADING, 13=PROCESSING, 14=UNKNOWN
   */
  private mapStatus(status: number | string, statusmsg?: string): TaskStatus | string {
    if (typeof status === 'number') {
      switch (status) {
        case 0: return TaskStatus.Finished;
        case 1: return TaskStatus.Failed; // OFFLINE
        case 2: return TaskStatus.Waiting; // ONLINE
        case 3: return TaskStatus.Queued;
        case 4: return TaskStatus.Failed; // SKIPPED
        case 5: return TaskStatus.Waiting;
        case 6: return TaskStatus.Waiting; // TEMPOFFLINE
        case 7: return TaskStatus.Active; // STARTING
        case 8: return TaskStatus.Failed;
        case 9: return TaskStatus.Failed; // ABORTED
        case 10: return TaskStatus.Active; // DECRYPTING
        case 11: return statusmsg || `status-${status}`; // CUSTOM
        case 12: return TaskStatus.Active; // DOWNLOADING
        case 13: return TaskStatus.Active; // PROCESSING
        case 14: return TaskStatus.Waiting; // UNKNOWN
        default: return `status-${status}`;
      }
    }

    // Handle string status
    const lowerStatus = String(status).toLowerCase();

    if (lowerStatus.includes('queue')) return TaskStatus.Queued;
    if (lowerStatus.includes('active') || lowerStatus.includes('download')) return TaskStatus.Active;
    if (lowerStatus.includes('wait')) return TaskStatus.Waiting;
    if (lowerStatus.includes('pause')) return TaskStatus.Paused;
    if (lowerStatus.includes('finish')) return TaskStatus.Finished;
    if (lowerStatus.includes('complete')) return TaskStatus.Complete;
    if (lowerStatus.includes('fail') || lowerStatus.includes('error')) return TaskStatus.Failed;

    return status;
  }
}
