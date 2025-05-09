import React from 'react';
import { DownloadTask } from '../../common/types';
import DownloadItem from './DownloadItem';
import PlaceholderDownload from '../../common/components/PlaceholderDownload';

interface DownloadListProps {
  activeTasks: DownloadTask[];
  completedTasks: DownloadTask[];
  onRemoveTask: (id: string) => void;
  onClearCompleted: () => void;
  showCompleted: boolean;
  isLoading?: boolean;
}

/**
 * Component to display a list of downloads
 */
const DownloadList: React.FC<DownloadListProps> = ({
  activeTasks,
  completedTasks,
  onRemoveTask,
  onClearCompleted,
  showCompleted,
  isLoading = false
}) => {
  const totalTasks = activeTasks.length + (showCompleted ? completedTasks.length : 0);
  
  return (
    <div className="download-list">
      {isLoading && totalTasks === 0 && (
        <div className="loading-placeholder">
          <PlaceholderDownload />
          <PlaceholderDownload />
        </div>
      )}
      
      {!isLoading && totalTasks === 0 ? (
        <div className="empty-state">
          <i className="fas fa-download empty-icon"></i>
          <div>No download tasks.</div>
        </div>
      ) : (
        <>
          {activeTasks.map((task) => (
            <DownloadItem key={task.id} task={task} />
          ))}
          
          {showCompleted && completedTasks.length > 0 && (
            <>
              {completedTasks.map((task) => (
                <DownloadItem
                  key={task.id}
                  task={task}
                  onRemove={onRemoveTask}
                />
              ))}
              
              {completedTasks.length > 1 && (
                <div className="text-center mt-3 mb-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={onClearCompleted}
                    title="Clear all completed downloads"
                  >
                    Clear all completed ({completedTasks.length})
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default DownloadList;
