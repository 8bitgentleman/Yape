import { ApiResponse, DownloadTask, TaskStatus, PackageData, FileData } from '../../types';
import { BaseApiClient } from './base';

/**
 * PyLoad-NG API methods related to queue management
 */
export class QueueApiClient extends BaseApiClient {
  /**
   * Get queue data with all packages and files
   * GET /api/get_queue_data
   */
  async getQueueData(): Promise<ApiResponse<DownloadTask[]>> {
    try {
      const response = await this.request<PackageData[]>('get_queue_data', {}, { method: 'GET' });

      if (!response.success || !response.data) {
        return {
          success: response.success,
          error: response.error,
          message: response.message,
          data: []
        };
      }

      try {
        console.log('[DEBUG] Full queue response structure:', JSON.stringify(response.data, null, 2));
      } catch (e) {
        console.warn('[DEBUG] Could not stringify response:', e);
      }

      const tasks: DownloadTask[] = [];
      const data = response.data;

      // PyLoad-NG returns array of PackageData with nested links (FileData)
      if (Array.isArray(data)) {
        data.forEach((pkg: PackageData) => {
          // Extract files from package links
          if (pkg.links && Array.isArray(pkg.links)) {
            pkg.links.forEach((link: FileData) => {
              const task: DownloadTask = {
                id: String(link.fid),
                name: String(link.name || pkg.name || 'Unknown'),
                status: this.mapStatus(link.status, link.statusmsg),
                url: String(link.url || ''),
                added: Date.now() / 1000,
                percent: link.status === 0 ? 100 : 0, // status 0 = finished
                size: Number(link.size || 0),
                speed: 0,
                eta: 0,
                format_eta: '00:00:00'
              };

              tasks.push(task);
            });
          }
        });
      }

      return {
        success: true,
        data: tasks
      };
    } catch (error) {
      console.error('Error getting queue data:', error);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to get queue data'
      };
    }
  }

  /**
   * Add a package for download
   * POST /api/add_package with JSON body {name, links, dest}
   * @param name Package name
   * @param url URL to download
   */
  async addPackage(name: string, url: string): Promise<ApiResponse<number>> {
    const safeName = name.replace(/[^a-z0-9._\-]/gi, '_');

    console.log(`[YAPE-DEBUG] Adding package ${safeName} with URL ${url}`);

    try {
      const response = await this.request<number>('add_package', {
        name: safeName,
        links: [url],
        dest: 1 // 1 = QUEUE
      });

      console.log(`[YAPE-DEBUG] addPackage response:`, response);

      return response;
    } catch (error) {
      console.error(`[YAPE-DEBUG] Error adding package:`, error);
      return {
        success: false,
        error: 'request-failed',
        message: error instanceof Error ? error.message : 'Failed to add package'
      };
    }
  }

  /**
   * Remove a file/task
   * POST /api/delete_files with JSON body {file_ids}
   * @param id File ID
   */
  async removeTask(id: string): Promise<ApiResponse<boolean>> {
    console.log(`[DEBUG] Removing task with ID: ${id}`);
    try {
      // First try to stop the download
      try {
        await this.request<void>('stop_downloads', {
          file_ids: [parseInt(id, 10)]
        });
        console.log(`[DEBUG] Stopped download ${id}`);
      } catch (stopError) {
        console.warn(`[DEBUG] Error stopping download (continuing anyway):`, stopError);
      }

      // Wait briefly for the download to stop
      await new Promise(resolve => setTimeout(resolve, 300));

      // Delete the file
      const deleteResponse = await this.request<void>('delete_files', {
        file_ids: [parseInt(id, 10)]
      });

      console.log(`[DEBUG] Delete files response:`, deleteResponse);

      if (deleteResponse.success) {
        return {
          success: true,
          data: true,
          message: 'Successfully removed task'
        };
      }

      // Try deleting as package if file delete didn't work
      console.log(`[DEBUG] Trying deletePackages as fallback...`);
      const packageResponse = await this.request<void>('delete_packages', {
        package_ids: [parseInt(id, 10)]
      });

      console.log(`[DEBUG] Delete packages response:`, packageResponse);

      return {
        success: packageResponse.success,
        data: packageResponse.success,
        message: packageResponse.success ? 'Successfully removed task' : 'Failed to remove task'
      };
    } catch (error) {
      console.error(`[DEBUG] Error removing task with ID ${id}:`, error);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to remove task'
      };
    }
  }

  /**
   * Check if URLs are valid for download
   * POST /api/check_urls with JSON body {urls}
   * @param url URL to check
   */
  async checkURL(url: string): Promise<ApiResponse<Record<string, string[]>>> {
    return this.request<Record<string, string[]>>('check_urls', {
      urls: [url]
    });
  }

  /**
   * Remove all completed tasks from PyLoad queue
   * POST /api/delete_finished
   * @returns API response with array of deleted package IDs
   */
  async clearFinishedTasks(): Promise<ApiResponse<boolean>> {
    try {
      const response = await this.request<number[]>('delete_finished');
      console.log('[DEBUG] deleteFinished response:', response);

      if (response.success && Array.isArray(response.data)) {
        console.log(`[DEBUG] Successfully cleared ${response.data.length} finished packages`);
      }

      return {
        success: response.success,
        data: true,
        message: response.success ? 'Successfully cleared finished tasks' : 'Failed to clear finished tasks'
      };
    } catch (error) {
      console.error('Error clearing finished tasks:', error);
      return {
        success: false,
        error: 'request-failed',
        message: 'Failed to clear finished tasks'
      };
    }
  }

  /**
   * Map PyLoad-NG numeric status to TaskStatus
   * Based on OpenAPI DownloadStatus enum
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
