/* ── Navigation ── */
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });
}

function navigateTo(page, skipHistory = false) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const target = App.el(`page-${page}`);
  if (target) target.classList.add('active');

  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  // Trigger page-specific render
  if (page === 'home')        renderHome();
  if (page === 'library')     renderLibrary();
  if (page === 'reading')     renderFilteredLibrary('reading', 'readingList');
  if (page === 'completed')   renderFilteredLibrary('completed', 'completedList');
  if (page === 'notes')       renderNotesList();
  if (page === 'annotations') renderAnnotationsPage();
  if (page === 'settings')    renderSettings();
}
window.navigateTo = navigateTo;

function renderHome() {
  updateHomeStats();
  const recent = [...App.articles]
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 8);
  renderArticleCards(recent, App.el('homeRecentList'));
}

function renderFilteredLibrary(status, containerId) {
  const filtered = App.articles.filter(a => a.status === status);
  const container = App.el(containerId);
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <p>No articles here yet.</p></div>`;
    return;
  }
  renderArticleCards(filtered, container);
}
