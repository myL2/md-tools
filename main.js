'use strict';

const { app, BrowserWindow, shell, Menu } = require('electron');

// Start the server immediately — it listens and exports a Promise
const serverReady = require('./server');

let win = null;

async function createWindow() {
  const server = await serverReady;
  const port   = server.address().port;

  win = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth:  800,
    minHeight: 600,
    autoHideMenuBar: true,
    title: 'md.edit',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });

  // Remove default menu bar (File/Edit/View…) — the app has its own toolbar
  Menu.setApplicationMenu(null);

  win.loadURL(`http://127.0.0.1:${port}/md-editor.html`);

  // Open <a target="_blank"> links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  try {
    const server = await serverReady;
    await new Promise(r => server.close(r));
  } catch {}
  app.quit();
});

app.on('activate', () => {
  // macOS: re-open window when dock icon is clicked
  if (!win) createWindow();
});
