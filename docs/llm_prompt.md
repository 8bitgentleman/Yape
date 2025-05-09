# Yape Chrome Extension Modernization Project

## Project Overview

You are helping with the modernization of Yape (Yet Another PyLoad Extension), a Chrome extension for interacting with PyLoad download managers. The project is a ground-up rebuild of the original extension, using modern web technologies and best practices.

## Project Structure

The modernized codebase is structured in the following way:

```
/Users/mtvogel/Documents/Github-Repos/Yape/yape-modern/
├── src/
│   ├── background/        # Background script
│   │   └── index.ts       # Main background script
│   ├── common/            # Shared code
│   │   ├── api/           # API client
│   │   │   └── client.ts  # PyLoad API client
│   │   ├── components/    # Reusable React components
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── PlaceholderDownload.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── state/         # State management
│   │   │   └── index.ts   # State management functions
│   │   ├── styles/        # SCSS styles
│   │   │   ├── global.scss
│   │   │   └── variables.scss
│   │   ├── utils/         # Utility functions
│   │   │   ├── config/    # Config value parsing utilities
│   │   │   ├── debounce.ts # Debounce utility for smoother UI
│   │   │   └── notifications.ts
│   │   └── types.ts       # Type definitions
│   ├── popup/             # Popup UI
│   │   ├── components/    # Popup components
│   │   │   ├── AddCurrentPage.tsx
│   │   │   ├── AddUrlForm.tsx      # URL submission form
│   │   │   ├── DownloadItem.tsx
│   │   │   ├── DownloadList.tsx
│   │   │   ├── Header.tsx
│   │   │   └── StatusBar.tsx       # Status bar component
│   │   ├── hooks/                  # Custom React hooks
│   │   │   └── useDownloadManager.ts # Download management hook
│   │   ├── index.html     # Popup HTML
│   │   ├── index.tsx      # Popup entry point
│   │   └── Popup.tsx      # Main popup component
│   └── settings/          # Settings UI
│       ├── components/    # Settings components
│       │   ├── ConnectionForm.tsx
│       │   └── InterfaceSettings.tsx
│       ├── index.html     # Settings HTML
│       ├── index.tsx      # Settings entry point
│       └── Settings.tsx   # Main settings component
├── docs/
│   ├── llm_prompt.md      # This document for LLM assistance
│   └── rewrite_phases.md  # Project phases and progress
├── .eslintrc.js           # ESLint configuration
├── .gitignore             # Git ignore file
├── manifest.json          # Extension manifest
├── package.json           # NPM package file
├── README.md              # Project readme
├── tsconfig.json          # TypeScript configuration
├── webpack.common.js      # Common webpack configuration
├── webpack.dev.js         # Development webpack configuration
└── webpack.prod.js        # Production webpack configuration
```

## PyLoad API

PyLoad exposes a simple HTTP API that allows interacting with download tasks. Key endpoints include:

- `statusServer` - Check server status
- `login` - Log in to PyLoad
- `statusDownloads` - Get status of all downloads
- `getQueueData` - Get queue data
- `checkURLs` - Check if URLs are valid for download
- `addPackage` - Add a package for download
- `deletePackages` - Remove a package
- `getConfigValue` - Get a configuration value
- `setConfigValue` - Set a configuration value

## Current Implementation Status

The modernization has made significant progress:

1. ✅ Core Infrastructure
   - Project scaffolding with TypeScript, React, and Webpack
   - Modern PyLoad API client with proper error handling
   - State management system with type-safe interfaces
   - Background service with context menu integration

2. ✅ User Interface
   - Component-based UI for popup and settings pages
   - Modern UI design based on NAS Download Manager style
   - Responsive design with loading placeholders
   - Status bar with connection and speed information

3. ✅ Functionality
   - Basic download management functionality
   - Fixed download display issues across PyLoad versions
   - Added right-click download functionality
   - Connection testing and configuration
   - Toast notifications for download actions

4. ✅ Code Quality
   - Code organization with React hooks and custom components
   - Performance optimizations like debounced API calls
   - Proper error handling throughout the application
   - Type-safe interfaces for all data structures

## Recent Fixes and Improvements

Recent improvements to the extension include:

1. **Fixed API Client**:
   - Enhanced PyLoad API client with better response parsing
   - Added support for different PyLoad API response formats
   - Improved error handling and debug logging

2. **Fixed UI Issues**:
   - Modernized UI based on NAS Download Manager style
   - Fixed UI flashing when refreshing data
   - Added loading placeholders for smoother UX
   - Added proper download status display

3. **Fixed Download Functionality**:
   - Fixed right-click download menu functionality
   - Implemented proper download task display
   - Added notification system between background and popup
   - Fixed download status detection and display

4. **Performance Improvements**:
   - Implemented debouncing to prevent UI flashing
   - Split functionality into focused components and hooks
   - Optimized API calls to reduce unnecessary traffic

## Technical Preferences

- Use TypeScript for all new code
- Keep files focused and under 300 lines of code
- Follow React best practices and hooks
- Use async/await for asynchronous operations
- Use proper error handling with try/catch
- Comment complex logic and public API functions
- Prefer functional components over class components in React
- Use SCSS for styling with BEM methodology where appropriate
- Follow semantic versioning for releases

## Current Status and Challenges

The extension is currently functional with basic download management features. Users can view active and completed downloads, add new downloads via the UI or right-click menu, and view download status in a clean, modern interface.

### Remaining Challenges

1. **PyLoad API Compatibility**:
   - Different PyLoad versions return slightly different response formats
   - Some PyLoad APIs may have undocumented behavior
   - Error handling can be improved for different server configurations

2. **Download Management Features**:
   - Pause/resume functionality needs to be implemented
   - Download priority management is not yet available
   - Package name editing is not yet implemented

3. **UI Enhancements**:
   - Detailed view for download items needs to be implemented
   - Sorting and filtering options for downloads
   - Additional customization options for the interface

## Next Steps

1. **Testing and Bug Fixes**:
   - Test with different PyLoad server versions to ensure compatibility
   - Address any edge cases in API response handling
   - Fix any remaining UI issues or inconsistencies

2. **Feature Enhancements**:
   - Implement download control actions (pause, resume, cancel)
   - Add download queue management features
   - Implement download filtering and sorting options

3. **Performance and UX Improvements**:
   - Optimize data refresh strategies for better performance
   - Add offline support for basic functionality
   - Improve error messaging and recovery options

## Communication Guidelines

When making changes or suggesting improvements:
- Explain your reasoning for significant changes
- Note any potential issues or edge cases
- Ask for clarification when the requirements are unclear
- Provide code snippets for implementation suggestions
- If replacing existing functionality, explain how the new approach is better

Please help maintain the high quality of this codebase by focusing on simplicity, maintainability, and robustness. The key goal is to create a modern, reliable Chrome extension that provides a better user experience than the original while maintaining all functionality.
