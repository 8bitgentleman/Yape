import { PyloadClient } from '../../common/api/client';
import { DownloadTask, State, TaskStatus } from '../../common/types';

/**
 * Pause a download
 */
export const pauseDownload = async (
  id: string,
  state: State | null,
  setDataLoading: (loading: boolean) => void,
  setActiveTasks: React.Dispatch<React.SetStateAction<DownloadTask[]>>,
  refreshDataImmediate: () => Promise<void>
) => {
  if (!state) return;
  
  try {
    setDataLoading(true);
    const client = new PyloadClient(state.settings.connection);
    
    const response = await client.pauseDownload(id);
    
    if (response.success) {
      // Update task status locally
      setActiveTasks(prev =>
        prev.map(task =>
          task.id === id
            ? { ...task, status: TaskStatus.Paused }
            : task
        )
      );
      
      // Refresh data to get updated status
      await refreshDataImmediate();
    }
  } catch (err) {
    console.error('Failed to pause download:', err);
  } finally {
    setDataLoading(false);
  }
};

/**
 * Resume a download
 */
export const resumeDownload = async (
  id: string,
  state: State | null,
  setDataLoading: (loading: boolean) => void,
  setActiveTasks: React.Dispatch<React.SetStateAction<DownloadTask[]>>,
  refreshDataImmediate: () => Promise<void>
) => {
  if (!state) return;
  
  try {
    setDataLoading(true);
    const client = new PyloadClient(state.settings.connection);
    
    const response = await client.resumeDownload(id);
    
    if (response.success) {
      // Update task status locally
      setActiveTasks(prev =>
        prev.map(task =>
          task.id === id
            ? { ...task, status: TaskStatus.Active }
            : task
        )
      );
      
      // Refresh data to get updated status
      await refreshDataImmediate();
    }
  } catch (err) {
    console.error('Failed to resume download:', err);
  } finally {
    setDataLoading(false);
  }
};