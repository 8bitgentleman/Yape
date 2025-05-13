# Yape Chrome Extension Modernization Project

## Current Status Update (May 2025)

We've made significant progress on modernizing the Yape Chrome extension:

1. Restructured the codebase into modules:
   - Split the API client into modular components for better maintainability
   - Improved error handling and debugging capabilities
   - Enhanced API response parsing for different PyLoad versions

2. Fixed major issues:
   - Implemented proper download task display from PyLoad API responses
   - Added better status handling for completed downloads
   - Added "Clear Finished" functionality to remove completed downloads
   - Fixed badge notification and notification system for downloads
   - Implemented robust error handling in service worker context

3. Recent enhancements:
   - Implemented badge counter for completed downloads
   - Added Chrome notifications for download events
   - Fixed issues with right-click context menu integration
   - Added background check system for download status updates
   - Improved state persistence across browser sessions
   - Fixed TypeScript typing issues for Chrome APIs

4. Current challenges:
   - Ensuring consistent behavior across different PyLoad API versions
   - Handling edge cases in service worker lifecycle
   - Maintaining state synchronization between popup and background script
   - Badge persistence issues when popup is opened/closed
   - Right-click context menu sometimes not working properly

## Original Project Overview

You are helping with the modernization of Yape (Yet Another PyLoad Extension), a Chrome extension for interacting with PyLoad download managers. The project is a ground-up rebuild of the original extension, using modern web technologies and best practices.

## Project Structure

The modernized codebase is structured in the following way:

```
/Users/mtvogel/Documents/Github-Repos/Yape/
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

The extension is now functional with many key features working well:

1. ✅ Users can add downloads via the popup UI or right-click context menu
2. ✅ Badge notifications show the number of completed downloads
3. ✅ Notifications appear when downloads are added or completed
4. ✅ "Clear Finished" functionality works properly
5. ✅ The extension maintains state across browser sessions

However, we're still experiencing some issues:

1. ⚠️ Right-click context menu sometimes doesn't work properly
2. ⚠️ Badge counter may disappear after opening/closing the popup 
3. ⚠️ Badge counter occasionally doesn't update correctly when downloads finish or when cleaned up

## Badge Counter Debugging Guide

The badge counter should work as follows:

1. **Badge Appearance**: 
   - The badge should appear automatically when downloads finish
   - It should show the count of completed downloads (integer number)
   - The badge should remain visible until all downloads are cleared

2. **Badge Update Triggers**:
   - When a download completes, the background script detects this via the periodic check function `checkForFinishedDownloads()`
   - Finished downloads are counted, and the badge is updated via the `updateBadge()` function
   - When downloads are cleared/removed, the badge count should decrease or disappear

3. **Badge Persistence**:
   - The badge should remain visible when the popup is opened and closed
   - The badge count is stored in `chrome.storage.local` with the key 'badgeCount'
   - The badge should only be cleared when the count reaches 0

4. **Debug Points to Check**:
   - Does `checkForFinishedDownloads()` detect completed downloads properly?
   - Does `updateBadge()` execute when downloads complete?
   - Is the badge count properly stored in and retrieved from storage?
   - Is `clearCompletedTasks()` properly updating the badge count when tasks are cleared?

5. **Common Issues**:
   - Badge being cleared when popup opens but not restored when popup closes
   - Badge not updating when download status changes
   - Badge count not being decremented when completed downloads are cleared

## Right-Click Context Menu Debugging Guide

The right-click context menu should work as follows:

1. **Menu Creation**:
   - The context menu is created in `initializeContextMenus()` function in the background script
   - It should appear when right-clicking on any link in a webpage
   - The menu item should be titled "Download with Yape"

2. **Click Handling**:
   - When clicked, the menu triggers `handleContextMenuClick()` function
   - This function extracts the URL and sends it to PyLoad via the API

3. **Execution Flow**:
   - Check server status → Login → Check URL validity → Add package for download
   - Each step has proper error handling

4. **Debug Points to Check**:
   - Is the context menu being registered properly during extension initialization?
   - Is the click event being captured and logged?
   - Are there any errors during any step of the execution flow?
   - Does the API client properly format the request to PyLoad?

5. **Common Issues**:
   - Context menu not appearing in certain contexts
   - Click event not being transmitted to the handler
   - API request failing due to parameter formatting issues
   - No visual feedback to the user when right-click download is attempted

## Communication Guidelines

When making changes or suggesting improvements:
- Explain your reasoning for significant changes
- Note any potential issues or edge cases
- Ask for clarification when the requirements are unclear
- Provide code snippets for implementation suggestions
- If replacing existing functionality, explain how the new approach is better

## Next steps 
Review the app with `read_multiple_files` and then fix current bugs related to badge persistence and right-click functionality. You can use `edit_file` after you've reviewed

Please help maintain the high quality of this codebase by focusing on simplicity, maintainability, and robustness. The key goal is to create a modern, reliable Chrome extension that provides a better user experience than the original while maintaining all functionality.
