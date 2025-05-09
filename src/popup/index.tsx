import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import ErrorBoundary from '../common/components/ErrorBoundary';
import '../common/styles/global.scss';

// Create root element
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render popup component
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Popup />
    </ErrorBoundary>
  </React.StrictMode>
);
