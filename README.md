# md.edit (md-tools)

An offline-first Markdown editor with native SFTP file browsing and synchronization capabilities. Built by myL2 Connect.

## Core Features

- **Integrated SFTP Browser:** Connect directly to remote servers (user@host:port) to browse, read, and write Markdown files over SSH.
- **Offline-First:** Runs as a local Electron application or a standalone Node.js server.
- **Real-time Synchronization:** Write changes directly back to your remote server via SFTP.
- **SSH Key Support:** Automatically detects and uses local SSH keys (`id_ed25519`, `id_rsa`, etc.) or SSH agents for passwordless authentication.
- **Cross-Platform:** Includes build scripts for Linux (AppImage, deb) and Windows (NSIS).

## Technology Stack

- **Frontend:** HTML5, Markdown (via `md-editor.html`).
- **Backend:** Node.js, Express.
- **SFTP Engine:** `ssh2-sftp-client`.
- **Desktop Wrapper:** Electron & Electron Builder.

## Installation

### For Users
Builds are currently available as:
- **Linux:** AppImage or `.deb` package.
- **Windows:** Standard NSIS installer.

### For Developers
1. Clone the repository:
   ```bash
   git clone https://github.com/myL2/md-tools.git
   cd md-tools
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start in development mode (Electron):
   ```bash
   npm start
   ```
4. Start as a standalone web server (default port 3737):
   ```bash
   npm run server
   ```

## Usage

1. Open the application.
2. Enter your connection string (e.g., `myl2@192.168.1.100`).
3. Authenticate via your local SSH key or enter a password/passphrase when prompted.
4. Browse your remote filesystem and select a `.md` file to edit.
5. Save changes to update the file directly on the server.

## Scripts

- `install.sh` / `install.bat`: Setup environment.
- `md-editor.sh` / `md-editor.bat`: Launch scripts.
- `npm run dist`: Build production binaries for Linux and Windows.

---
© 2026 myL2 Connect. Licensed under MIT.
