/* ── Settings ── */
function initSettings() {
  // Font size
  const fontSlider = App.el('fontSizeSlider');
  const fontVal    = App.el('fontSizeVal');
  fontSlider.addEventListener('input', () => {
    fontVal.textContent = fontSlider.value + 'px';
    document.documentElement.style.setProperty('--reader-font-size', fontSlider.value + 'px');
    scheduleSettingsSave();
  });

  // Reading width
  const widthSlider = App.el('readingWidthSlider');
  const widthVal    = App.el('readingWidthVal');
  widthSlider.addEventListener('input', () => {
    widthVal.textContent = widthSlider.value + 'px';
    document.documentElement.style.setProperty('--reading-width', widthSlider.value + 'px');
    scheduleSettingsSave();
  });

  // Theme
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.documentElement.setAttribute('data-theme', btn.dataset.theme);
      App.settings.theme = btn.dataset.theme;
      scheduleSettingsSave();
    });
  });

  // Default highlight color
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      App.settings.defaultHighlight = dot.dataset.color;
      scheduleSettingsSave();
    });
  });

  // Export/Import
  App.el('exportBackupBtn').addEventListener('click', async () => {
    const ok = await window.api.exportBackup();
    showToast(ok ? 'Backup exported successfully.' : 'Export cancelled.');
  });

  App.el('importBackupBtn').addEventListener('click', async () => {
    const ok = await window.api.importBackup();
    if (ok) {
      showToast('Backup imported. Reloading…');
      setTimeout(() => location.reload(), 1200);
    } else {
      showToast('Import cancelled or failed.');
    }
  });
}

function renderSettings() {
  const s = App.settings;

  // Font size
  App.el('fontSizeSlider').value = s.fontSize || 18;
  App.el('fontSizeVal').textContent = (s.fontSize || 18) + 'px';

  // Reading width
  App.el('readingWidthSlider').value = s.readingWidth || 680;
  App.el('readingWidthVal').textContent = (s.readingWidth || 680) + 'px';

  // Theme
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === (s.theme || 'dark'));
  });

  // Default color
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === (s.defaultHighlight || 'yellow'));
  });

  // Storage info
  window.api.getStorageInfo().then(info => {
    App.el('storagePathDisplay').textContent = info.path;
    App.el('storageUsedDisplay').textContent = formatBytes(info.bytes);
  });

  // Version
  window.api.getVersion().then(v => {
    App.el('settingsVersion').textContent = `v${v}`;
  });
}
window.renderSettings = renderSettings;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}

let settingsSaveTimer = null;
function scheduleSettingsSave() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    App.settings.fontSize     = parseInt(App.el('fontSizeSlider').value);
    App.settings.readingWidth = parseInt(App.el('readingWidthSlider').value);
    await window.api.saveSettings(App.settings);
  }, 500);
}
