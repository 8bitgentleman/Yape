import React from 'react';
import { DownloadTask, TaskStatus } from '../../common/types';
import ProgressBar from '../../common/components/ProgressBar';

interface DownloadItemProps {
  task: DownloadTask;
  onRemove?: (id: string) => void;
}

/**
 * Component to display a single download item
 */
const DownloadItem: React.FC<DownloadItemProps> = ({
  task,
  onRemove
}) => {
  // Check if task is completed
  const isCompleted = task.status === TaskStatus.Finished || 
                     task.status === TaskStatus.Complete || 
                     task.percent === 100;
  
  // Check if task is paused
  const isPaused = task.status === TaskStatus.Paused;
  
  // Format file size
  const formatSize = (size: number): string => {
    if (size === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return `${(size / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  };
  
  // Format speed (B/s, KB/s, MB/s)
  const formatSpeed = (speed: number): string => {
    if (speed === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(speed) / Math.log(1024));
    return `${(speed / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  };
  
  // Get status icon class
  const getStatusIcon = () => {
    if (isCompleted) return 'fas fa-check status-icon complete';
    if (isPaused) return 'fas fa-pause status-icon paused';
    return 'fas fa-arrow-down status-icon active';
  };
  
  // Get status text
  const getStatusText = () => {
    if (isCompleted) return '100% – ' + formatSize(task.size) + ' downloaded';
    if (isPaused) return 'PAUSED – ' + task.percent.toFixed(0) + '% – ' + formatSize(task.size * task.percent / 100) + ' of ' + formatSize(task.size);
    return task.percent.toFixed(0) + '% – ' + formatSize(task.size * task.percent / 100) + ' of ' + formatSize(task.size) + ' downloaded';
  };

  return (
    <div className="download-item">
      <div className="download-name ellipsis" title={task.name}>
        {task.name}
      </div>
      
      <ProgressBar
        progress={task.percent}
        showLabel={false}
        animated={!isCompleted && !isPaused}
        variant={isCompleted ? 'success' : 'primary'}
      />
      
      <div className="download-meta">
        <div className="download-status">
          <i className={getStatusIcon()}></i>
          <span>{getStatusText()}</span>
        </div>
        
        {!isCompleted && !isPaused && task.speed > 0 && (
          <div className="download-speed">
            {formatSpeed(task.speed)}
          </div>
        )}
        
        {onRemove && (
          <button
            className="icon-button"
            style={{ 
              width: '24px', 
              height: '24px', 
              fontSize: '0.8rem',
              marginLeft: '8px'
            }}
            onClick={() => onRemove(task.id)}
            title="Remove download"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default DownloadItem;
