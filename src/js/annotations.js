/* ── Annotations Page ── */
function initAnnotationsPage() {
  App.el('annotationsSearch').addEventListener('input',        renderAnnotationsPage);
  App.el('annotationArticleFilter').addEventListener('change', renderAnnotationsPage);
  App.el('annotationTypeFilter').addEventListener('change',    renderAnnotationsPage);
}

function renderAnnotationsPage() {
  // Populate article filter
  const articleFilter = App.el('annotationArticleFilter');
  const selectedArticle = articleFilter.value;

  const articleIds = [...new Set(App.annotations.map(a => a.articleId))];
  const options = ['<option value="">All Articles</option>'];
  articleIds.forEach(id => {
    const article = App.articles.find(a => a.id === id);
    if (article) {
      const sel = selectedArticle === id ? 'selected' : '';
      options.push(`<option value="${id}" ${sel}>${escapeHtml(article.title.slice(0,50))}</option>`);
    }
  });
  articleFilter.innerHTML = options.join('');

  const search      = App.el('annotationsSearch').value.toLowerCase();
  const articleId   = App.el('annotationArticleFilter').value;
  const type        = App.el('annotationTypeFilter').value;

  let list = [...App.annotations];

  if (articleId) list = list.filter(a => a.articleId === articleId);
  if (type)      list = list.filter(a => a.type === type);
  if (search)    list = list.filter(a =>
    (a.text || '').toLowerCase().includes(search) ||
    (a.comment || '').toLowerCase().includes(search)
  );

  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = App.el('annotationsList');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <p>No annotations yet. Highlight text while reading.</p>
    </div>`;
    return;
  }

  container.innerHTML = list.map(a => {
    const article = App.articles.find(x => x.id === a.articleId);
    const articleTitle = article?.title || 'Unknown Article';

    const colorClass = a.type === 'underline' ? 'underline' : (a.color || '');
    const typeBadge = a.type === 'highlight'
      ? `<span class="badge badge-to-read" style="background:transparent;border:1px solid var(--border)">${a.color || ''} highlight</span>`
      : a.type === 'underline'
        ? `<span class="badge badge-to-read">underline</span>`
        : `<span class="badge badge-reading">comment</span>`;

    const pageRef = a.pdfPage ? ` · Page ${a.pdfPage}` : '';

    return `<div class="annotation-entry" data-id="${a.id}" data-article-id="${a.articleId}">
      <div class="annotation-entry-quote ${colorClass}">${escapeHtml((a.text||'').slice(0,300))}</div>
      ${a.comment ? `<div class="annotation-entry-comment">${escapeHtml(a.comment)}</div>` : ''}
      <div class="annotation-entry-meta">
        <div>
          <span class="annotation-entry-article">${escapeHtml(articleTitle.slice(0,40))}</span>
          <span style="color:var(--text-muted)">${pageRef}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          ${typeBadge}
          <span>${formatRelative(a.createdAt)}</span>
          <button class="btn-ghost delete-ann-entry" data-id="${a.id}" style="padding:3px 6px;font-size:11px">Remove</button>
        </div>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.annotation-entry').forEach(entry => {
    entry.addEventListener('click', (e) => {
      if (e.target.closest('.delete-ann-entry')) {
        const id = e.target.closest('.delete-ann-entry').dataset.id;
        deleteAnnotationFromPage(id);
        return;
      }
      const articleId = entry.dataset.articleId;
      const annId = entry.dataset.id;
      openArticleReader(articleId);
      // Scroll to annotation after reader renders
      setTimeout(() => scrollToAnnotation(annId), 400);
    });
  });
}
window.renderAnnotationsPage = renderAnnotationsPage;

async function deleteAnnotationFromPage(id) {
  await window.api.deleteAnnotation(id);
  App.annotations = App.annotations.filter(a => a.id !== id);
  renderAnnotationsPage();
  showToast('Annotation removed.');
}
