/* ── Search ── */
// Global keyboard shortcut: Ctrl/Cmd+F focuses library search
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'page-library') {
      const searchInput = App.el('librarySearch');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  }
});
