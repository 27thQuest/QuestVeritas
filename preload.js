const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Articles
  getArticles:     ()        => ipcRenderer.invoke('articles:getAll'),
  saveArticle:     (article) => ipcRenderer.invoke('articles:save', article),
  deleteArticle:   (id)      => ipcRenderer.invoke('articles:delete', id),

  // PDF
  importPDF:   ()         => ipcRenderer.invoke('pdf:import'),
  readPDF:     (filePath) => ipcRenderer.invoke('pdf:read', filePath),

  // URL
  fetchURL:    (url)      => ipcRenderer.invoke('url:fetch', url),

  // Notes
  getNotes:    ()         => ipcRenderer.invoke('notes:getAll'),
  saveNote:    (note)     => ipcRenderer.invoke('notes:save', note),
  deleteNote:  (id)       => ipcRenderer.invoke('notes:delete', id),

  // Annotations
  getAnnotations:  ()           => ipcRenderer.invoke('annotations:getAll'),
  saveAnnotation:  (annotation) => ipcRenderer.invoke('annotations:save', annotation),
  deleteAnnotation:(id)         => ipcRenderer.invoke('annotations:delete', id),

  // Settings
  getSettings:  ()      => ipcRenderer.invoke('settings:get'),
  saveSettings: (prefs) => ipcRenderer.invoke('settings:save', prefs),

  // Backup
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  // App info
  getVersion:       () => ipcRenderer.invoke('app:getVersion'),
  getUserDataPath:  () => ipcRenderer.invoke('app:getUserDataPath'),
  getStorageInfo:   () => ipcRenderer.invoke('app:getStorageInfo'),
});
