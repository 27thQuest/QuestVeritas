const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// ─── Paths ───────────────────────────────────────────────────────────────────
const userDataPath = app.getPath('userData');
const dbPath       = path.join(userDataPath, 'database');
const docsPath     = path.join(userDataPath, 'documents', 'pdfs');
const settingsPath = path.join(userDataPath, 'settings');

const FILES = {
  articles:    path.join(dbPath, 'articles.json'),
  notes:       path.join(dbPath, 'notes.json'),
  annotations: path.join(dbPath, 'annotations.json'),
  prefs:       path.join(settingsPath, 'preferences.json'),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ensureDirs() {
  [dbPath, docsPath, settingsPath].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function readJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Window ───────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  // mainWindow.webContents.openDevTools(); // uncomment for debugging
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── IPC: Articles ────────────────────────────────────────────────────────────
ipcMain.handle('articles:getAll', () => readJSON(FILES.articles, []));

ipcMain.handle('articles:save', (_, article) => {
  const list = readJSON(FILES.articles, []);
  if (!article.id) {
    article.id = generateId();
    article.dateAdded = new Date().toISOString();
    list.unshift(article);
  } else {
    const idx = list.findIndex(a => a.id === article.id);
    if (idx !== -1) list[idx] = article; else list.unshift(article);
  }
  writeJSON(FILES.articles, list);
  return article;
});

ipcMain.handle('articles:delete', (_, id) => {
  const list = readJSON(FILES.articles, []);
  const article = list.find(a => a.id === id);
  if (article && article.pdfPath && fs.existsSync(article.pdfPath)) {
    try { fs.unlinkSync(article.pdfPath); } catch {}
  }
  const updated = list.filter(a => a.id !== id);
  writeJSON(FILES.articles, updated);
  // Also remove annotations
  const annotations = readJSON(FILES.annotations, []);
  writeJSON(FILES.annotations, annotations.filter(a => a.articleId !== id));
  return true;
});

// ─── IPC: PDF ─────────────────────────────────────────────────────────────────
ipcMain.handle('pdf:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import PDF',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const src = result.filePaths[0];
  const name = path.basename(src);
  const dest = path.join(docsPath, generateId() + '_' + name);
  fs.copyFileSync(src, dest);
  return { path: dest, name: path.basename(src, '.pdf') };
});

ipcMain.handle('pdf:read', (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  // Safety: must be inside userData
  if (!filePath.startsWith(userDataPath)) return null;
  return fs.readFileSync(filePath).toString('base64');
});

// ─── IPC: URL Fetch ───────────────────────────────────────────────────────────
ipcMain.handle('url:fetch', (_, url) => {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        // Follow redirects once
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirect = new URL(res.headers.location, url).href;
          const mod2 = redirect.startsWith('https') ? https : http;
          mod2.get(redirect, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
            let data = '';
            res2.on('data', c => data += c);
            res2.on('end', () => resolve({ ok: true, html: data, url: redirect }));
          }).on('error', () => resolve({ ok: false }));
          return;
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ ok: true, html: data, url }));
      });
      req.on('error', () => resolve({ ok: false }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false }); });
    } catch {
      resolve({ ok: false });
    }
  });
});

// ─── IPC: Notes ───────────────────────────────────────────────────────────────
ipcMain.handle('notes:getAll', () => readJSON(FILES.notes, []));

ipcMain.handle('notes:save', (_, note) => {
  const list = readJSON(FILES.notes, []);
  if (!note.id) {
    note.id = generateId();
    note.createdAt = new Date().toISOString();
    list.unshift(note);
  } else {
    const idx = list.findIndex(n => n.id === note.id);
    if (idx !== -1) list[idx] = note; else list.unshift(note);
  }
  writeJSON(FILES.notes, list);
  return note;
});

ipcMain.handle('notes:delete', (_, id) => {
  const list = readJSON(FILES.notes, []).filter(n => n.id !== id);
  writeJSON(FILES.notes, list);
  return true;
});

// ─── IPC: Annotations ────────────────────────────────────────────────────────
ipcMain.handle('annotations:getAll', () => readJSON(FILES.annotations, []));

ipcMain.handle('annotations:save', (_, annotation) => {
  const list = readJSON(FILES.annotations, []);
  if (!annotation.id) {
    annotation.id = generateId();
    annotation.createdAt = new Date().toISOString();
    list.push(annotation);
  } else {
    const idx = list.findIndex(a => a.id === annotation.id);
    if (idx !== -1) list[idx] = annotation; else list.push(annotation);
  }
  writeJSON(FILES.annotations, list);
  return annotation;
});

ipcMain.handle('annotations:delete', (_, id) => {
  const list = readJSON(FILES.annotations, []).filter(a => a.id !== id);
  writeJSON(FILES.annotations, list);
  return true;
});

// ─── IPC: Settings ────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => readJSON(FILES.prefs, {
  theme: 'dark', fontSize: 18, readingWidth: 680, defaultHighlight: 'yellow'
}));

ipcMain.handle('settings:save', (_, prefs) => {
  writeJSON(FILES.prefs, prefs);
  return true;
});

// ─── IPC: Backup ──────────────────────────────────────────────────────────────
ipcMain.handle('backup:export', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Library Backup',
    defaultPath: 'reading-library-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return false;
  const data = {
    version: app.getVersion(),
    exportedAt: new Date().toISOString(),
    articles: readJSON(FILES.articles, []),
    notes: readJSON(FILES.notes, []),
    annotations: readJSON(FILES.annotations, []),
    preferences: readJSON(FILES.prefs, {}),
  };
  writeJSON(result.filePath, data);
  return true;
});

ipcMain.handle('backup:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Library Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return false;
  try {
    const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    if (data.articles) writeJSON(FILES.articles, data.articles);
    if (data.notes) writeJSON(FILES.notes, data.notes);
    if (data.annotations) writeJSON(FILES.annotations, data.annotations);
    if (data.preferences) writeJSON(FILES.prefs, data.preferences);
    return true;
  } catch { return false; }
});

// ─── IPC: Misc ────────────────────────────────────────────────────────────────
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getUserDataPath', () => userDataPath);
ipcMain.handle('app:getStorageInfo', () => {
  let size = 0;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) walk(fp);
      else size += stat.size;
    });
  };
  walk(path.join(userDataPath, 'database'));
  walk(path.join(userDataPath, 'documents'));
  return { bytes: size, path: userDataPath };
});
