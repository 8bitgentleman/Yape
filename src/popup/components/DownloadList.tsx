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
  // Log properties for debugging
  console.log('[DEBUG] DownloadList Props:', {
    activeTasks: activeTasks.length,
    completedTasks: completedTasks.length,
    showCompleted,
    isLoading
  });
  
  if (activeTasks.length > 0) {
    console.log('[DEBUG] First active task:', activeTasks[0]);
  }
  
  if (completedTasks.length > 0 && showCompleted) {
    console.log('[DEBUG] First completed task:', completedTasks[0]);
  }
  
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
          <div>No download tasks. Use the '+' button to add downloads.</div>
        </div>
      ) : (
        <>
          {activeTasks.map((task) => (
            <DownloadItem 
              key={task.id} 
              task={task} 
              onRemove={onRemoveTask}
            />
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
