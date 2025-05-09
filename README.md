# Yape - Yet Another PyLoad Extension

A modern Chrome extension for easily monitoring and adding downloads to your PyLoad server.

## Features

- **Modern Architecture**: Built with TypeScript, React, and Webpack
- **Intuitive UI**: Clean, responsive interface for managing your downloads
- **Download Management**: Add, monitor, and delete downloads directly from Chrome
- **Context Menu Integration**: Right-click on any link to download with PyLoad
- **Customizable Settings**: Configure server connection and UI preferences

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) (v7 or higher) or [yarn](https://yarnpkg.com/)
- [Chrome](https://www.google.com/chrome/) browser

### Installation

1. Clone the repository
2. Navigate to the project directory:
   ```
   cd yape-modern
   ```
3. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn install
   ```

### Development

1. Start the development server:
   ```
   npm run watch
   ```
   or
   ```
   yarn watch
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` directory

3. The extension will automatically rebuild when you make changes to the source code

### Building for Production

1. Build the extension:
   ```
   npm run build
   ```
   or
   ```
   yarn build
   ```

2. The built extension will be in the `dist` directory

3. Create a zip file for distribution:
   ```
   npm run zip
   ```
   or
   ```
   yarn zip
   ```

## Project Structure

```
src/
├── background/        # Background script
├── common/            # Shared code
│   ├── api/           # API client
│   ├── components/    # Reusable React components
│   ├── state/         # State management
│   ├── styles/        # SCSS styles
│   ├── utils/         # Utility functions
│   └── types.ts       # Type definitions
├── popup/             # Popup UI
│   ├── components/    # Popup components
│   ├── index.html     # Popup HTML
│   └── index.tsx      # Popup entry point
└── settings/          # Settings UI
    ├── components/    # Settings components
    ├── index.html     # Settings HTML
    └── index.tsx      # Settings entry point
```

## Core Technologies

- **TypeScript**: For static typing and better code quality
- **React**: For building the user interface
- **Webpack**: For bundling and building the extension
- **SCSS**: For styling
- **Bootstrap**: For UI components
- **FontAwesome**: For icons

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [PyLoad](https://pyload.net/) - The awesome download manager
- [nas-download-manager](https://github.com/seansfkelley/nas-download-manager) - Inspiration for the modern architecture
