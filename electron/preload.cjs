const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('veritas', {
  version: () => ipcRenderer.invoke('app:version'),
  validateImportUrl: (url) => ipcRenderer.invoke('import:validate-url', url),
  databaseStatus: () => ipcRenderer.invoke('db:status'),
  listDocuments: () => ipcRenderer.invoke('library:list'),
  importUrl: (url) => ipcRenderer.invoke('import:url', url),
  importPdf: () => ipcRenderer.invoke('import:pdf'),
  readPdf: (id) => ipcRenderer.invoke('pdf:read', id),
});
