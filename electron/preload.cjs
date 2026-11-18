const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('veritas', {
  version: () => ipcRenderer.invoke('app:version'),
  validateImportUrl: (url) => ipcRenderer.invoke('import:validate-url', url),
  databaseStatus: () => ipcRenderer.invoke('db:status'),
});
