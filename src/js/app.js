/* ── Global App State ── */
window.App = {
  articles:    [],
  notes:       [],
  annotations: [],
  settings:    { theme: 'dark', fontSize: 18, readingWidth: 680, defaultHighlight: 'yellow' },

  currentArticle: null,
  currentNote:    null,
  pendingDeleteId: null,
  pendingDeleteType: null,
  pendingPdfPath: null,

  // DOM refs
  el: (id) => document.getElementById(id),
};

/* ── Toast ── */
let toastTimer;
window.showToast = (msg, duration = 2500) => {
  const t = App.el('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, duration);
};

/* ── Date helpers ── */
window.formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

window.formatRelative = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
};

/* ── Reading time ── */
window.calcReadingTime = (text) => {
  if (!text) return null;
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 230));
  return `${mins} min read`;
};

/* ── Escape HTML ── */
window.escapeHtml = (str) => {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

/* ── Status label/badge ── */
window.statusBadge = (status) => {
  const labels = { 'to-read': 'To Read', 'reading': 'Reading', 'completed': 'Completed', 'archived': 'Archived' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
};

/* ── Modal helpers ── */
window.openModal = (id) => {
  const m = App.el(id);
  if (m) m.style.display = 'flex';
};
window.closeModal = (id) => {
  const m = App.el(id);
  if (m) m.style.display = 'none';
};

document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) closeModal(closeBtn.dataset.close);

  const overlay = e.target;
  if (overlay.classList.contains('modal-overlay')) closeModal(overlay.id);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => {
      if (m.style.display !== 'none') closeModal(m.id);
    });
  }
});

/* ── Load all data ── */
async function loadAllData() {
  [App.articles, App.notes, App.annotations, App.settings] = await Promise.all([
    window.api.getArticles(),
    window.api.getNotes(),
    window.api.getAnnotations(),
    window.api.getSettings(),
  ]);
}

/* ── Bootstrap ── */
(async () => {
  await loadAllData();

  // Apply settings
  applySettings(App.settings);

  // Set version
  const v = await window.api.getVersion();
  const verEl = App.el('appVersion');
  if (verEl) verEl.textContent = `v${v}`;

  // Storage info
  const info = await window.api.getStorageInfo();
  const storEl = App.el('storageInfo');
  if (storEl) storEl.textContent = formatBytes(info.bytes);

  // Init all modules
  initNavigation();
  initLibrary();
  initAnnotationsPage();
  initNotes();
  initSettings();
  initReaderControls();

  // Update home stats
  updateHomeStats();
})();

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}

function applySettings(s) {
  document.documentElement.setAttribute('data-theme', s.theme || 'dark');
  document.documentElement.style.setProperty('--reader-font-size', (s.fontSize || 18) + 'px');
  document.documentElement.style.setProperty('--reading-width', (s.readingWidth || 680) + 'px');
  App.settings = s;
}
window.applySettings = applySettings;

function updateHomeStats() {
  const a = App.articles;
  App.el('stat-total').textContent     = a.length;
  App.el('stat-reading').textContent   = a.filter(x => x.status === 'reading').length;
  App.el('stat-completed').textContent = a.filter(x => x.status === 'completed').length;
  App.el('stat-toread').textContent    = a.filter(x => !x.status || x.status === 'to-read').length;
}
window.updateHomeStats = updateHomeStats;
