import React, { useMemo } from 'react';
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
  
  // Memoize empty state to prevent unnecessary re-renders
  const emptyStateContent = useMemo(() => (
    <div className="empty-state">
      <i className="fas fa-download empty-icon"></i>
      {/* <div>No download tasks. Use the '+' button to add downloads.</div> */}
    </div>
  ), []);
  
  // Memoize loading placeholder to prevent re-renders
  const loadingPlaceholder = useMemo(() => (
    <div className="loading-placeholder">
      <PlaceholderDownload />
      <PlaceholderDownload />
    </div>
  ), []);
  
  // Memoize task lists to prevent unnecessary re-renders when task arrays are the same
  const activeTasksContent = useMemo(() => 
    activeTasks.map((task) => (
      <DownloadItem 
        key={task.id} 
        task={task} 
        onRemove={onRemoveTask}
      />
    )), [activeTasks, onRemoveTask]);
  
  const completedTasksContent = useMemo(() => 
    showCompleted && completedTasks.length > 0 ? (
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
    ) : null, [showCompleted, completedTasks, onRemoveTask, onClearCompleted]);
  
  return (
    <div className="download-list">
      {isLoading && totalTasks === 0 && loadingPlaceholder}
      
      {!isLoading && totalTasks === 0 ? emptyStateContent : (
        <>
          {activeTasksContent}
          {completedTasksContent}
        </>
      )}
    </div>
  );
};

export default DownloadList;
