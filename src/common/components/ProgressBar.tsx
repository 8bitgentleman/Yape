import React from 'react';
import classNames from 'classnames';

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  animated?: boolean;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info';
  height?: string;
}

/**
 * Progress bar component
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showLabel = false,
  animated = false,
  variant = 'primary',
  height = '6px'
}) => {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  
  return (
    <div className="progress" style={{ height }}>
      <div
        className={classNames(
          'progress-bar',
          {
            'bg-success': variant === 'success',
            'bg-primary': variant === 'primary',
            'bg-danger': variant === 'danger',
            'bg-warning': variant === 'warning',
            'bg-info': variant === 'info',
            'progress-bar-striped': animated,
            'progress-bar-animated': animated
          }
        )}
        role="progressbar"
        style={{ width: `${normalizedProgress}%` }}
        aria-valuenow={normalizedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {showLabel && `${normalizedProgress.toFixed(0)}%`}
      </div>
    </div>
  );
};

export default ProgressBar;
