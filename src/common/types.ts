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

// Download task status enum (internal representation)
export enum TaskStatus {
  Queued = 'queued',
  Active = 'active',
  Waiting = 'waiting',
  Paused = 'paused',
  Finished = 'finished',
  Failed = 'failed',
  Complete = 'complete',
}

/**
 * PyLoad-NG DownloadStatus enum (from OpenAPI spec)
 * Numeric status codes used by PyLoad-NG API
 */
export enum DownloadStatus {
  FINISHED = 0,
  OFFLINE = 1,
  ONLINE = 2,
  QUEUED = 3,
  SKIPPED = 4,
  WAITING = 5,
  TEMPOFFLINE = 6,
  STARTING = 7,
  FAILED = 8,
  ABORTED = 9,
  DECRYPTING = 10,
  CUSTOM = 11,
  DOWNLOADING = 12,
  PROCESSING = 13,
  UNKNOWN = 14,
}

/**
 * PyLoad-NG Destination enum
 */
export enum Destination {
  COLLECTOR = 0,
  QUEUE = 1,
}

// Download task interface (internal representation)
export interface DownloadTask {
  id: string;
  name: string;
  status: TaskStatus | string;
  url: string;
  added: number; // timestamp
  percent: number;
  size: number;
  bytesLoaded?: number; // Actual loaded bytes
  speed: number;
  eta: number;
  format_eta: string;
}

/**
 * PyLoad-NG ServerStatus (from OpenAPI spec)
 * Response from GET /api/status_server
 */
export interface ServerStatus {
  pause: boolean;
  active: number;
  queue: number;
  total: number;
  speed: number;
  download: boolean;
  reconnect: boolean;
  captcha: boolean;
  proxy: boolean;
}

/**
 * PyLoad-NG DownloadInfo (from OpenAPI spec)
 * Response items from GET /api/status_downloads
 */
export interface DownloadInfo {
  fid: number;
  name: string;
  speed: number;
  eta: number;
  format_eta: string;
  bleft: number; // bytes left
  size: number;
  format_size: string;
  percent: number;
  status: DownloadStatus;
  statusmsg: string;
  format_wait: string;
  wait_until: number;
  package_id: number;
  package_name: string;
  plugin: string;
  info: string;
}

/**
 * PyLoad-NG FileData (from OpenAPI spec)
 * Individual file within a package
 */
export interface FileData {
  fid: number;
  url: string;
  name: string;
  plugin: string;
  size: number;
  format_size: string;
  status: DownloadStatus;
  statusmsg: string;
  package_id: number;
  error: string;
  order: number;
}

/**
 * PyLoad-NG PackageData (from OpenAPI spec)
 * Response items from GET /api/get_queue_data
 */
export interface PackageData {
  pid: number;
  name: string;
  folder: string;
  site: string;
  password: string;
  dest: Destination;
  order: number;
  linksdone?: number | null;
  sizedone?: number | null;
  sizetotal?: number | null;
  linkstotal?: number | null;
  links?: FileData[] | null;
  fids?: number[] | null;
}

/**
 * PyLoad-NG UserData (from OpenAPI spec)
 * Response from GET /api/check_auth
 */
export interface UserData {
  id?: number | null;
  name?: string | null;
  email?: string | null;
  role?: number | null;
  permission?: number | null;
  template?: string | null;
}

/**
 * PyLoad-NG CaptchaTask (from OpenAPI spec)
 * Response from GET /api/get_captcha_task
 */
export interface CaptchaTask {
  tid: number;
  data?: object | null;
  type?: string | null;
  result_type?: string | null;
}

// Application state interface
export interface State {
  settings: {
    connection: ConnectionSettings;
    ui: {
      showCompleted: boolean;
      autoRefresh: boolean;
      refreshInterval: number;
      backgroundCheckInterval: number;
    };
    notifications?: {
      enabled: boolean;
      onDownloadAdded: boolean;
      onDownloadCompleted: boolean;
      onDownloadFailed: boolean;
      onClearCompleted: boolean;
      soundEnabled: boolean;
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
