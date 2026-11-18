/* ── Library ── */
let libraryLayout = 'grid';

function initLibrary() {
  // Add article buttons
  App.el('addArticleBtn').addEventListener('click',  () => openAddArticleModal());
  App.el('addArticleBtn2').addEventListener('click', () => openAddArticleModal());

  // Modal tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      App.el(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // PDF import
  App.el('choosePdfBtn').addEventListener('click', handlePdfImport);
  App.el('clearPdfBtn').addEventListener('click', () => {
    App.pendingPdfPath = null;
    App.el('pdfPreview').style.display = 'none';
    App.el('pdfDropArea').style.display = 'flex';
  });

  // URL fetch
  App.el('fetchUrlBtn').addEventListener('click', handleUrlFetch);
  App.el('importUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUrlFetch();
  });

  // Save article
  App.el('saveArticleBtn').addEventListener('click', saveArticle);

  // Library filters
  App.el('librarySearch').addEventListener('input',  renderLibrary);
  App.el('statusFilter').addEventListener('change',  renderLibrary);
  App.el('sortSelect').addEventListener('change',    renderLibrary);

  // Layout toggle
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      libraryLayout = btn.dataset.layout;
      renderLibrary();
    });
  });

  // Delete confirm
  App.el('confirmDeleteBtn').addEventListener('click', async () => {
    if (!App.pendingDeleteId) return;
    await window.api.deleteArticle(App.pendingDeleteId);
    App.articles = App.articles.filter(a => a.id !== App.pendingDeleteId);
    App.annotations = App.annotations.filter(a => a.articleId !== App.pendingDeleteId);
    App.pendingDeleteId = null;
    closeModal('deleteModal');
    renderLibrary();
    updateHomeStats();
    showToast('Article deleted.');
  });
}

function openAddArticleModal(article = null) {
  // Reset
  ['articleTitle','articleAuthor','articleSource','articleUrl','articleTags','articleAbstract','articleText',
   'pdfTitle','pdfAuthor','pdfTags','importUrl','urlTitle','urlAuthor','urlSource','urlTags','urlText']
    .forEach(id => { const el = App.el(id); if (el) el.value = ''; });

  App.pendingPdfPath = null;
  App.el('pdfPreview').style.display = 'none';
  App.el('pdfDropArea').style.display = 'flex';
  App.el('urlFetchResult').style.display = 'none';
  App.el('urlFetchStatus').style.display = 'none';

  // Reset tabs
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="paste"]').classList.add('active');
  App.el('tab-paste').classList.add('active');

  if (article) {
    App.el('articleModalTitle').textContent = 'Edit Article';
    App.el('saveArticleBtn').dataset.editId = article.id;

    if (article.type === 'pdf') {
      // Switch to PDF tab and show existing file info
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-tab="pdf"]').classList.add('active');
      App.el('tab-pdf').classList.add('active');

      App.pendingPdfPath = article.pdfPath;
      App.el('pdfFileName').textContent = article.title || 'document.pdf';
      App.el('pdfTitle').value  = article.title || '';
      App.el('pdfAuthor').value = article.author || '';
      App.el('pdfTags').value   = (article.tags || []).join(', ');
      App.el('pdfDropArea').style.display = 'none';
      App.el('pdfPreview').style.display  = 'block';
    } else {
      App.el('articleTitle').value     = article.title || '';
      App.el('articleAuthor').value    = article.author || '';
      App.el('articleSource').value    = article.source || '';
      App.el('articleUrl').value       = article.url || '';
      App.el('articleTags').value      = (article.tags || []).join(', ');
      App.el('articleAbstract').value  = article.abstract || '';
      App.el('articleText').value      = article.text || '';
    }
  } else {
    App.el('articleModalTitle').textContent = 'Add Article';
    delete App.el('saveArticleBtn').dataset.editId;
  }

  openModal('articleModal');
}
window.openAddArticleModal = openAddArticleModal;

async function handlePdfImport() {
  const result = await window.api.importPDF();
  if (!result) return;
  App.pendingPdfPath = result.path;
  App.el('pdfFileName').textContent = result.name;
  App.el('pdfTitle').value = result.name;
  App.el('pdfDropArea').style.display = 'none';
  App.el('pdfPreview').style.display = 'block';
}

async function handleUrlFetch() {
  const url = App.el('importUrl').value.trim();
  if (!url) return;

  const statusEl = App.el('urlFetchStatus');
  statusEl.className = 'fetch-status loading';
  statusEl.textContent = 'Fetching article…';
  statusEl.style.display = 'block';
  App.el('urlFetchResult').style.display = 'none';

  try {
    const res = await window.api.fetchURL(url);
    if (!res.ok || !res.html) throw new Error('Failed to fetch');

    const parsed = parseArticleFromHtml(res.html, url);
    App.el('urlTitle').value  = parsed.title;
    App.el('urlAuthor').value = parsed.author;
    App.el('urlSource').value = parsed.source;
    App.el('urlText').value   = parsed.text;

    statusEl.className = 'fetch-status success';
    statusEl.textContent = 'Article fetched. Review and edit below.';
    App.el('urlFetchResult').style.display = 'block';
  } catch {
    statusEl.className = 'fetch-status error';
    statusEl.textContent = 'Could not fetch automatically. Paste the article text manually below.';
    App.el('urlFetchResult').style.display = 'block';
    App.el('urlTitle').value  = '';
    App.el('urlAuthor').value = '';
    App.el('urlSource').value = new URL(url).hostname.replace('www.','');
    App.el('urlText').value   = '';
  }
}

function parseArticleFromHtml(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Title
  const title = doc.querySelector('meta[property="og:title"]')?.content
    || doc.querySelector('meta[name="twitter:title"]')?.content
    || doc.querySelector('title')?.textContent
    || '';

  // Author
  const author = doc.querySelector('meta[name="author"]')?.content
    || doc.querySelector('[rel="author"]')?.textContent
    || doc.querySelector('.author')?.textContent
    || doc.querySelector('[class*="author"]')?.textContent
    || '';

  // Source
  const source = doc.querySelector('meta[property="og:site_name"]')?.content
    || new URL(url).hostname.replace('www.','');

  // Extract article text
  let text = '';
  // Try article tag first
  const articleEl = doc.querySelector('article') 
    || doc.querySelector('[role="main"]')
    || doc.querySelector('main')
    || doc.querySelector('.article-body, .post-body, .entry-content, .story-body, .article__body');

  if (articleEl) {
    // Remove nav, ads, scripts
    articleEl.querySelectorAll('nav,aside,script,style,figure,img,iframe,.ad,.ads,.advertisement').forEach(e => e.remove());
    text = articleEl.innerText || articleEl.textContent || '';
  } else {
    // Fallback: gather paragraphs
    doc.querySelectorAll('p').forEach(p => { text += p.textContent + '\n\n'; });
  }

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

  return {
    title: title.trim(),
    author: author.trim().slice(0, 100),
    source: source.trim(),
    text: text.slice(0, 200000), // cap at 200k chars
  };
}

async function saveArticle() {
  const activeTab = document.querySelector('.modal-tab.active')?.dataset.tab;
  const editId = App.el('saveArticleBtn').dataset.editId;

  let article = editId ? App.articles.find(a => a.id === editId) || {} : {};

  if (activeTab === 'paste') {
    const text = App.el('articleText').value.trim();
    const title = App.el('articleTitle').value.trim() || generateTitle(text);
    if (!title && !text) { showToast('Please add a title or article text.'); return; }
    Object.assign(article, {
      title, type: 'text',
      author:   App.el('articleAuthor').value.trim(),
      source:   App.el('articleSource').value.trim(),
      url:      App.el('articleUrl').value.trim(),
      tags:     parseTags(App.el('articleTags').value),
      abstract: App.el('articleAbstract').value.trim(),
      text,
      status: article.status || 'to-read',
    });

  } else if (activeTab === 'pdf') {
    const existingPath = editId ? (App.articles.find(a => a.id === editId)?.pdfPath) : null;
    if (!App.pendingPdfPath && !existingPath) { showToast('Please choose a PDF file.'); return; }
    const title = App.el('pdfTitle').value.trim() || 'Untitled PDF';
    Object.assign(article, {
      title, type: 'pdf',
      author:   App.el('pdfAuthor').value.trim(),
      tags:     parseTags(App.el('pdfTags').value),
      pdfPath:  App.pendingPdfPath || existingPath,
      status: article.status || 'to-read',
      pdfPage: article.pdfPage || 1,
    });

  } else if (activeTab === 'url') {
    const title = App.el('urlTitle').value.trim() || generateTitle(App.el('urlText').value);
    if (!title) { showToast('Please add a title.'); return; }
    Object.assign(article, {
      title, type: 'text',
      author: App.el('urlAuthor').value.trim(),
      source: App.el('urlSource').value.trim(),
      url:    App.el('importUrl').value.trim(),
      tags:   parseTags(App.el('urlTags').value),
      text:   App.el('urlText').value.trim(),
      status: article.status || 'to-read',
    });
  }

  const saved = await window.api.saveArticle(article);
  if (editId) {
    const idx = App.articles.findIndex(a => a.id === editId);
    if (idx !== -1) App.articles[idx] = saved;
  } else {
    App.articles.unshift(saved);
  }

  closeModal('articleModal');
  renderLibrary();
  renderHome();
  showToast(editId ? 'Article updated.' : 'Article saved.');
}

function generateTitle(text) {
  if (!text) return '';
  const first = text.trim().split('\n')[0].trim();
  return first.slice(0, 80) + (first.length > 80 ? '…' : '');
}

function parseTags(str) {
  return str.split(',').map(t => t.trim()).filter(Boolean);
}

/* ── Render Library ── */
function renderLibrary() {
  const search = App.el('librarySearch').value.toLowerCase();
  const status = App.el('statusFilter').value;
  const sort   = App.el('sortSelect').value;

  let list = [...App.articles];

  if (status) list = list.filter(a => a.status === status);
  if (search) list = list.filter(a =>
    (a.title  || '').toLowerCase().includes(search) ||
    (a.author || '').toLowerCase().includes(search) ||
    (a.text   || '').toLowerCase().includes(search) ||
    (a.tags || []).some(t => t.toLowerCase().includes(search))
  );

  if (sort === 'title')      list.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  if (sort === 'dateAdded')  list.sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  if (sort === 'lastOpened') list.sort((a,b) => new Date(b.lastOpened||0) - new Date(a.lastOpened||0));

  const container = App.el('libraryList');
  container.className = `article-grid${libraryLayout === 'list' ? ' list-layout' : ''}`;
  renderArticleCards(list, container);
}
window.renderLibrary = renderLibrary;

/* ── Render article cards ── */
function renderArticleCards(articles, container) {
  if (!articles.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <p>No articles found.</p>
    </div>`;
    return;
  }

  const isList = container.classList.contains('list-layout');

  container.innerHTML = articles.map(a => {
    const tags = (a.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const rt = a.text ? calcReadingTime(a.text) : null;
    const typeIcon = a.type === 'pdf'
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg> Article`;

    if (isList) {
      return `<div class="article-card" data-id="${a.id}">
        <div class="article-card-body">
          <div class="article-card-title">${escapeHtml(a.title)}</div>
          <div class="article-card-meta">
            ${a.author ? `<span class="article-card-author">${escapeHtml(a.author)}</span>` : ''}
            ${a.source ? `<span class="article-card-source">${escapeHtml(a.source)}</span>` : ''}
          </div>
        </div>
        <div class="article-card-footer">
          ${statusBadge(a.status || 'to-read')}
          <span class="article-card-date">${formatRelative(a.dateAdded)}</span>
          <div class="article-card-actions">
            <button class="card-action-btn edit-btn" data-id="${a.id}" title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="card-action-btn delete-btn" data-id="${a.id}" title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    }

    return `<div class="article-card" data-id="${a.id}">
      <div class="article-card-top">
        <div class="article-card-type">${typeIcon}</div>
        <div class="article-card-actions">
          <button class="card-action-btn edit-btn" data-id="${a.id}" title="Edit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="card-action-btn delete-btn" data-id="${a.id}" title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div class="article-card-title">${escapeHtml(a.title)}</div>
      <div class="article-card-meta">
        ${a.author ? `<div class="article-card-author">${escapeHtml(a.author)}</div>` : ''}
        ${a.source ? `<div class="article-card-source">${escapeHtml(a.source)}</div>` : ''}
      </div>
      ${a.abstract ? `<div class="article-card-abstract">${escapeHtml(a.abstract)}</div>` : ''}
      <div class="article-card-footer">
        <div>
          ${statusBadge(a.status || 'to-read')}
          ${rt ? `<span style="font-size:10px;color:var(--text-muted);margin-left:6px">${rt}</span>` : ''}
        </div>
        <div>
          ${tags}
          <span class="article-card-date" style="margin-left:6px">${formatRelative(a.dateAdded)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Click handlers
  container.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.edit-btn')) {
        const id = e.target.closest('.edit-btn').dataset.id;
        const a = App.articles.find(x => x.id === id);
        if (a) openAddArticleModal(a);
        return;
      }
      if (e.target.closest('.delete-btn')) {
        App.pendingDeleteId = e.target.closest('.delete-btn').dataset.id;
        openModal('deleteModal');
        return;
      }
      openArticleReader(card.dataset.id);
    });
  });
}
window.renderArticleCards = renderArticleCards;
