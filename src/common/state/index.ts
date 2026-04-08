import { State, ConnectionSettings } from '../types';

// Default state
export const DEFAULT_STATE: State = {
  settings: {
    connection: {
      hostname: '192.168.1.12',
      port: 890,
      protocol: 'http',
      path: '/',
      apiKey: ''
    },
    ui: {
      showCompleted: true,
      autoRefresh: true,
      refreshInterval: 3000,
      backgroundCheckInterval: 60000 // Default to checking every 60 seconds
    }
  },
  tasks: [],
  isLoggedIn: false
};

/**
 * Get the host URL from connection settings
 */
export function getHostUrl(settings: ConnectionSettings): string {
  const { protocol, hostname, port, path } = settings;
  let url = `${protocol}://${hostname}:${port}${path}`;
  
  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  
  return url;
}

/**
 * Migrate saved state from older schema versions to the current one.
 * Handles the transition from username/password Basic Auth to API key auth.
 */
function migrateState(state: any): State {
  const connection = state?.settings?.connection ?? {};
  // If stored state has username/password but no apiKey, preserve other fields
  // and add an empty apiKey so the user knows they need to enter one.
  if (!('apiKey' in connection)) {
    connection.apiKey = '';
    delete connection.username;
    delete connection.password;
  }
  return state as State;
}

/**
 * Load the state from storage
 */
export async function loadState(): Promise<State> {
  try {
    const data = await chrome.storage.local.get('state');
    if (!data.state) return DEFAULT_STATE;
    return migrateState(data.state);
  } catch (error) {
    console.error('Failed to load state', error);
    return DEFAULT_STATE;
  }
}

/**
 * Save the state to storage
 */
export async function saveState(state: State): Promise<void> {
  try {
    await chrome.storage.local.set({ state });
  } catch (error) {
    console.error('Failed to save state', error);
  }
}

/**
 * Update a specific part of the state
 */
export async function updateState(updater: (state: State) => Partial<State>): Promise<State> {
  const currentState = await loadState();
  const updatedState = {
    ...currentState,
    ...updater(currentState),
    lastUpdate: Date.now()
  };
  
  await saveState(updatedState);
  return updatedState;
}

/**
 * Listen for state changes
 */
export function onStateChange(callback: (state: State) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area === 'local' && changes.state) {
      callback(changes.state.newValue);
    }
  };
  
  chrome.storage.onChanged.addListener(listener);
  
  // Return a function to remove the listener
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
