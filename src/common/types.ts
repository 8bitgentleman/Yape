/**
 * Common types used across the application
 */

// Connection settings for PyLoad server
export interface ConnectionSettings {
  hostname: string;
  port: number;
  protocol: 'http' | 'https';
  path: string;
  username: string;
  password: string;
}

// Download task status enum
export enum TaskStatus {
  Queued = 'queued',
  Active = 'active',
  Waiting = 'waiting',
  Paused = 'paused',
  Finished = 'finished',
  Failed = 'failed',
  Complete = 'complete',
}

// Download task interface
export interface DownloadTask {
  id: string;
  name: string;
  status: TaskStatus | string;
  url: string;
  added: number; // timestamp
  percent: number;
  size: number;
  speed: number;
  eta: number;
  format_eta: string;
}

// Application state interface
export interface State {
  settings: {
    connection: ConnectionSettings;
    ui: {
      showCompleted: boolean;
      autoRefresh: boolean;
      refreshInterval: number;
    };
  };
  tasks: DownloadTask[];
  lastSevereError?: string;
  isLoggedIn: boolean;
  lastUpdate?: number;
}

// API error types
export type ApiError = 
  | 'connection-error'
  | 'login-failed'
  | 'request-failed'
  | 'timeout'
  | 'server-error'
  | 'unknown-error';

// PyLoad config value type (can be boolean, string, number, etc.)
export type PyloadConfigValue = boolean | string | number;

// API response type
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}
