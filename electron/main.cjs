const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { z } = require('zod');

const isDev = !app.isPackaged;
const cachePath = path.join(app.getPath('userData'), 'Cache');
fs.mkdirSync(cachePath, { recursive: true });
app.setPath('cache', cachePath);
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: '#111210',
    title: 'Quest Veritas',
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) mainWindow.loadURL('http://127.0.0.1:5174');
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') shell.openExternal(url);
    } catch { /* Ignore malformed external URLs. */ }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('import:validate-url', (_event, value) => {
  const schema = z.string().url().refine((input) => ['http:', 'https:'].includes(new URL(input).protocol));
  const result = schema.safeParse(value);
  return result.success ? { ok: true, url: result.data } : { ok: false, error: 'Enter a valid http or https URL.' };
});
ipcMain.handle('db:status', () => {
  const databasePath = path.join(app.getPath('userData'), 'database', 'veritas.db');
  return { configured: fs.existsSync(databasePath), path: databasePath };
});
