import React, { useEffect, useState } from 'react';
import { loadState, updateState } from '../common/state';
import { ConnectionSettings, State } from '../common/types';
import { PyloadClient } from '../common/api/client';
import LoadingSpinner from '../common/components/LoadingSpinner';
import ConnectionForm from './components/ConnectionForm';
import InterfaceSettings from './components/InterfaceSettings';
import NotificationSettings from './components/NotificationSettings';

/**
 * Settings page component
 */
const Settings: React.FC = () => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [state, setState] = useState<State | null>(null);
  const [activeTab, setActiveTab] = useState<'connection' | 'interface' | 'notifications' | 'about'>('connection');
  const [saveStatus, setSaveStatus] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | null;
  }>({ message: '', type: null });
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    isLoggedIn: boolean;
    message: string;
  }>({
    isConnected: false,
    isLoggedIn: false,
    message: 'Not connected',
  });

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedState = await loadState();

        // Initialize notification settings if they don't exist yet
        if (!loadedState.settings.notifications) {
          loadedState.settings.notifications = {
            enabled: true,
            onDownloadAdded: true,
            onDownloadCompleted: true,
            onDownloadFailed: true,
            onClearCompleted: true, // Added new notification type
            soundEnabled: false
          };

          // Save the initialized state
          await updateState(() => loadedState);
        }

        setState(loadedState);

        // Test connection if we have connection settings
        if (loadedState.settings.connection.hostname) {
          await testConnection(loadedState.settings.connection);
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  /**
   * Test connection to PyLoad server
   */
  const testConnection = async (connectionSettings: ConnectionSettings) => {
    setConnectionStatus({
      isConnected: false,
      isLoggedIn: false,
      message: 'Testing connection...',
    });

    try {
      const client = new PyloadClient(connectionSettings);

      // Test server status
      const statusResponse = await client.getServerStatus();

      if (!statusResponse.success) {
        setConnectionStatus({
          isConnected: false,
          isLoggedIn: false,
          message: statusResponse.message || 'Failed to connect to server',
        });
        return;
      }

      // Try to login
      const loginResponse = await client.login();

      if (!loginResponse.success) {
        setConnectionStatus({
          isConnected: true,
          isLoggedIn: false,
          message: 'Connected to server, but login failed. Check your credentials.',
        });
        return;
      }

      // Successfully connected and logged in
      setConnectionStatus({
        isConnected: true,
        isLoggedIn: true,
        message: 'Successfully connected and logged in',
      });

      // Update state with login status
      if (state) {
        updateState((currentState) => ({
          ...currentState,
          isLoggedIn: true,
        }));
      }
    } catch (error) {
      console.error('Connection test error', error);
      setConnectionStatus({
        isConnected: false,
        isLoggedIn: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Handle connection settings change
   */
  const handleConnectionSettingsChange = async (connectionSettings: ConnectionSettings) => {
    if (!state) return;

    try {
      setSaveStatus({ message: 'Saving settings...', type: 'info' });

      // Update state
      const updatedState = await updateState((currentState) => ({
        ...currentState,
        settings: {
          ...currentState.settings,
          connection: connectionSettings,
        },
      }));

      setState(updatedState);

      // Test connection
      await testConnection(connectionSettings);

      setSaveStatus({ message: 'Settings saved successfully', type: 'success' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ message: '', type: null });
      }, 3000);
    } catch (error) {
      console.error('Failed to save connection settings', error);
      setSaveStatus({
        message: 'Failed to save settings',
        type: 'error'
      });
    }
  };

  /**
   * Handle interface settings change
   */
  const handleInterfaceSettingsChange = async (settings: {
    showCompleted: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    backgroundCheckInterval: number;
  }) => {
    if (!state) return;

    try {
      setSaveStatus({ message: 'Saving settings...', type: 'info' });

      // Update state
      const updatedState = await updateState((currentState) => ({
        ...currentState,
        settings: {
          ...currentState.settings,
          ui: settings,
        },
      }));

      setState(updatedState);

      setSaveStatus({ message: 'Settings saved successfully', type: 'success' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ message: '', type: null });
      }, 3000);

      // If background check interval changed, notify background script to update
      chrome.runtime.sendMessage({
        type: 'settings_updated',
        settings: settings
      });
    } catch (error) {
      console.error('Failed to save interface settings', error);
      setSaveStatus({
        message: 'Failed to save settings',
        type: 'error'
      });
    }
  };

  /**
   * Handle notification settings change
   */
  const handleNotificationSettingsChange = async (settings: {
    enabled: boolean;
    onDownloadAdded: boolean;
    onDownloadCompleted: boolean;
    onDownloadFailed: boolean;
    onClearCompleted: boolean;
    soundEnabled: boolean;
  }) => {
    if (!state) return;

    try {
      setSaveStatus({ message: 'Saving settings...', type: 'info' });

      // Update state
      const updatedState = await updateState((currentState) => ({
        ...currentState,
        settings: {
          ...currentState.settings,
          notifications: settings,
        },
      }));

      setState(updatedState);

      setSaveStatus({ message: 'Settings saved successfully', type: 'success' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ message: '', type: null });
      }, 3000);

      // Notify background script that notification settings have changed
      chrome.runtime.sendMessage({
        type: 'notification_settings_updated',
        settings: settings
      });
    } catch (error) {
      console.error('Failed to save notification settings', error);
      setSaveStatus({
        message: 'Failed to save settings',
        type: 'error'
      });
    }
  };

  // Show loading spinner while initializing
  if (loading) {
    return <LoadingSpinner text="Loading settings..." />;
  }

  // Render settings form
  return (
    <div className="container py-3" style={{ margin: '0 auto' }}>
      <h1 className="mb-3">Yape Settings</h1>

      {/* Save status alert */}
      {saveStatus.type && (
        <div className={`alert alert-${saveStatus.type} mb-2 py-2`} role="alert">
          {saveStatus.message}
        </div>
      )}



      {/* Tabs Navigation */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'connection' ? 'active' : ''}`}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab('connection'); }}
          >
            <i className="fas fa-server me-1"></i>
            Connection
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'interface' ? 'active' : ''}`}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab('interface'); }}
          >
            <i className="fas fa-desktop me-1"></i>
            Interface
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab('notifications'); }}
          >
            <i className="fas fa-bell me-1"></i>
            Notifications
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'about' ? 'active' : ''}`}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab('about'); }}
          >
            <i className="fas fa-info-circle me-1"></i>
            About
          </a>
        </li>
      </ul>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Connection settings */}
        {activeTab === 'connection' && (
          <div className="card">
            <div className="card-body">
              {state && (
                <ConnectionForm
                  connectionSettings={state.settings.connection}
                  onSave={handleConnectionSettingsChange}
                  onTest={testConnection}
                />
              )}
              {/* Connection status alert */}
              <div
                className={`alert ${connectionStatus.isLoggedIn
                  ? 'alert-success'
                  : connectionStatus.isConnected
                    ? 'alert-warning'
                    : 'alert-danger'
                  } mb-3 py-2`}
              >
                <strong>Server Status:</strong> {connectionStatus.message}
              </div>
            </div>
          </div>
        )}

        {/* Interface settings */}
        {activeTab === 'interface' && (
          <div className="card">
            <div className="card-body">
              {state && (
                <InterfaceSettings
                  settings={state.settings.ui}
                  onSave={handleInterfaceSettingsChange}
                />
              )}
            </div>
          </div>
        )}

        {/* Notification settings */}
        {activeTab === 'notifications' && (
          <div className="card">
            <div className="card-body">
              {state && state.settings.notifications && (
                <NotificationSettings
                  settings={state.settings.notifications}
                  onSave={handleNotificationSettingsChange}
                />
              )}
            </div>
          </div>
        )}

        {/* About section */}
        {activeTab === 'about' && (
          <div className="card">
            <div className="card-body">
              <p>
                Yape is a Chrome extension for PyLoad to easily monitor and add downloads.
              </p>
              <p className="mb-0">
                <small className="text-muted">Version 2</small>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
