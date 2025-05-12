import React from 'react';
import { DownloadTask, TaskStatus } from '../../common/types';
import ProgressBar from '../../common/components/ProgressBar';

interface DownloadItemProps {
  task: DownloadTask;
  onRemove?: (id: string) => void;
}

// Define a type for the object returned by getStatusInfo
interface StatusDisplayInfo {
  icon: string;
  variant: 'success' | 'warning' | 'danger' | 'primary';
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
  
  // Check if task is failed
  const isFailed = task.status === TaskStatus.Failed || 
                  task.status === 'failed';
  
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
  
  // Get status icon class and variant
  const getStatusInfo = (): StatusDisplayInfo => {
    if (isCompleted) return { 
      icon: 'fas fa-check status-icon complete', 
      variant: 'success' 
    };
    if (isPaused) return { 
      icon: 'fas fa-pause status-icon paused', 
      variant: 'warning' 
    };
    if (isFailed) return { 
      icon: 'fas fa-times status-icon failed', 
      variant: 'danger' 
    };
    // Default for active/other states
    return { 
      icon: 'fas fa-arrow-down status-icon active', 
      variant: 'primary' 
    };
  };
  
  const statusInfo = getStatusInfo();
  
  // Get status text
  const getStatusText = () => {
    // Calculate bytes loaded - use bytesLoaded if available, otherwise estimate from percent
    const loadedBytes = task.bytesLoaded !== undefined ? task.bytesLoaded : (task.size * task.percent / 100);
    
    if (isCompleted) return '100% – ' + formatSize(task.size) + ' downloaded';
    if (isPaused) return 'PAUSED – ' + task.percent.toFixed(0) + '% – ' + formatSize(loadedBytes) + ' of ' + formatSize(task.size);
    if (isFailed) return 'FAILED - ' + task.percent.toFixed(0) + '%';
    return task.percent.toFixed(0) + '% – ' + formatSize(loadedBytes) + ' of ' + formatSize(task.size);
  };

  return (
    <div className="download-item">
      <div className="download-name ellipsis" title={task.name}>
        {task.name}
      </div>
      
      <ProgressBar
        progress={task.percent}
        showLabel={false}
        animated={!isCompleted && !isPaused && !isFailed}
        variant={statusInfo.variant}
      />
      
      <div className="download-meta">
        <div className="download-status">
          <i className={statusInfo.icon}></i>
          <span>{getStatusText()}</span>
        </div>
        
        {!isCompleted && !isFailed && task.speed > 0 && (
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