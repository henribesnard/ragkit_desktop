# RAGKIT Desktop

RAGKIT Desktop is a local, private RAG (Retrieval-Augmented Generation) system that allows you to chat with your documents.

## Features (v0.1.0)
- Cross-platform desktop application (Windows, macOS, Linux).
- Minimal skeleton with Chat, Settings, and Dashboard tabs.
- Python backend sidecar managed automatically.
- Dark/Light mode support.
- English/French localization.

## Development

### Prerequisites
- Node.js 20+
- Python 3.10+
- Rust (stable)

### Setup

1. Install frontend dependencies:
   ```bash
   cd desktop
   npm install
   ```

2. Install backend dependencies:
   ```bash
   pip install -e ".[desktop]"
   ```

3. Run in development mode:
   ```bash
   cd desktop
   npm run tauri:dev
   ```

## License
MIT
