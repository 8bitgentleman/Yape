import React from 'react';
import ReactDOM from 'react-dom/client';
import Settings from './Settings';
import ErrorBoundary from '../common/components/ErrorBoundary';
import '../common/styles/global.scss';

// Create root element
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render settings component
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Settings />
    </ErrorBoundary>
  </React.StrictMode>
);
