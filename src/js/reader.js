/* ── Reader ── */
let previousPage = 'library';
let readerFontSize = 18;
let selectionState = null;

function openArticleReader(id) {
  const article = App.articles.find(a => a.id === id);
  if (!article) return;

  App.currentArticle = article;
  previousPage = document.querySelector('.nav-item.active')?.dataset.page || 'library';

  // Update last opened
  article.lastOpened = new Date().toISOString();
  if (!article.status || article.status === 'to-read') {
    article.status = 'reading';
  }
  window.api.saveArticle(article);

  readerFontSize = App.settings.fontSize || 18;
  document.documentElement.style.setProperty('--reader-font-size', readerFontSize + 'px');

  // Set status selector
  App.el('readerStatus').value = article.status || 'to-read';

  // Show reader page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  App.el('page-reader').classList.add('active');

  if (article.type === 'pdf') {
    renderPdfReader(article);
  } else {
    renderTextReader(article);
  }

  renderAnnotationPanel();
}
window.openArticleReader = openArticleReader;

/* ── Text Reader ── */
function renderTextReader(article) {
  const container = App.el('readerArticle');

  const bylineParts = [];
  if (article.author) bylineParts.push(`<span>${escapeHtml(article.author)}</span>`);
  if (article.source) bylineParts.push(`<span>${escapeHtml(article.source)}</span>`);
  if (article.dateAdded) bylineParts.push(`<span>${formatDate(article.dateAdded)}</span>`);
  const rt = article.text ? calcReadingTime(article.text) : null;
  if (rt) bylineParts.push(`<span>${rt}</span>`);

  container.innerHTML = `
    <div class="reader-article-header">
      <h1 class="reader-article-title">${escapeHtml(article.title)}</h1>
      ${bylineParts.length ? `<div class="reader-article-byline">${bylineParts.join('')}</div>` : ''}
      ${(article.tags||[]).length ? `<div style="margin-top:10px">${article.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</div>` : ''}
    </div>
    <div class="reader-body" id="readerBody"></div>
  `;

  // Render text with annotations
  renderBodyWithAnnotations(article);

  // Restore scroll position
  const readerMain = App.el('readerMain');
  if (article.scrollPos) {
    requestAnimationFrame(() => { readerMain.scrollTop = article.scrollPos; });
  }

  // Track scroll + reading progress
  readerMain.onscroll = () => {
    const scrollable = readerMain.scrollHeight - readerMain.clientHeight;
    const progress   = scrollable > 0 ? (readerMain.scrollTop / scrollable) * 100 : 0;
    App.el('readingProgress').style.width = progress + '%';

    // Save scroll position debounced
    clearTimeout(readerMain._scrollTimer);
    readerMain._scrollTimer = setTimeout(() => {
      article.scrollPos = readerMain.scrollTop;
      window.api.saveArticle(article);
    }, 500);
  };

  // Setup text selection
  setupTextSelection();
}

function renderBodyWithAnnotations(article) {
  const bodyEl = App.el('readerBody');
  if (!bodyEl) return;

  const text = article.text || '';
  const artAnnotations = App.annotations.filter(a => a.articleId === article.id && a.type !== 'note');

  // Sort annotations by start offset for sequential rendering
  const sorted = [...artAnnotations].sort((a, b) => (a.startOffset || 0) - (b.startOffset || 0));

  // Build annotated HTML
  let html = '';
  let pos = 0;
  const chars = [...text];

  // Merge overlapping ranges
  const ranges = sorted.map(ann => ({
    id: ann.id,
    start: ann.startOffset || 0,
    end: ann.endOffset || 0,
    type: ann.type,
    color: ann.color,
    comment: ann.comment,
  })).filter(r => r.end > r.start);

  // Build character-level annotation map
  const annotations = new Array(text.length).fill(null);
  ranges.forEach(r => {
    for (let i = r.start; i < Math.min(r.end, text.length); i++) {
      annotations[i] = { id: r.id, type: r.type, color: r.color };
    }
  });

  // Render spans
  let currentAnn = null;
  let spanText = '';
  let spanStart = 0;

  const flushSpan = () => {
    if (!spanText) return;
    const escaped = escapeHtml(spanText).replace(/\n/g, '<br>');
    if (currentAnn) {
      const ann = artAnnotations.find(a => a.id === currentAnn.id);
      if (currentAnn.type === 'highlight') {
        html += `<mark class="annotation-highlight ${currentAnn.color}" data-ann-id="${currentAnn.id}">${escaped}</mark>`;
      } else if (currentAnn.type === 'underline') {
        html += `<u class="annotation-underline" data-ann-id="${currentAnn.id}">${escaped}</u>`;
      } else {
        html += escaped;
      }
      // Add comment dot
      if (ann && ann.comment) {
        html += `<span class="annotation-comment-dot" data-ann-id="${ann.id}"></span>`;
      }
    } else {
      html += escaped;
    }
    spanText = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ann = annotations[i];
    const annId = ann ? ann.id : null;
    const prevId = currentAnn ? currentAnn.id : null;

    if (annId !== prevId) {
      flushSpan();
      currentAnn = ann;
    }
    spanText += text[i];
  }
  flushSpan();

  // Wrap in paragraphs
  const paragraphs = html.split('<br><br>');
  bodyEl.innerHTML = paragraphs
    .map(p => `<p>${p.replace(/<br>/g, ' ')}</p>`)
    .join('');

  // Click annotations to focus in panel
  bodyEl.querySelectorAll('[data-ann-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      highlightPanelAnnotation(el.dataset.annId);
    });
  });
}

/* ── Text Selection & Annotation ── */
function setupTextSelection() {
  const toolbar   = App.el('selectionToolbar');
  const readerMain = App.el('readerMain');

  readerMain.addEventListener('mouseup', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      toolbar.style.display = 'none';
      return;
    }

    // Position toolbar near selection
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - 100;
    const y = rect.top - 46 + window.scrollY;

    toolbar.style.left    = Math.max(8, x) + 'px';
    toolbar.style.top     = y + 'px';
    toolbar.style.display = 'flex';

    selectionState = { selection: sel, range: range.cloneRange() };
  });

  document.addEventListener('mousedown', (e) => {
    if (!toolbar.contains(e.target) && !e.target.closest('#selectionToolbar')) {
      toolbar.style.display = 'none';
    }
  });

  // Highlight buttons
  toolbar.querySelectorAll('.highlight-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      annotateSelection('highlight', btn.dataset.color);
    });
  });

  toolbar.querySelector('.underline-btn').addEventListener('click', (e) => {
    e.preventDefault();
    annotateSelection('underline');
  });

  toolbar.querySelector('.comment-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openCommentModal();
  });
}

function getSelectionOffsets(range) {
  const bodyEl = App.el('readerBody');
  if (!bodyEl) return null;

  // Get the text content and find character offsets
  const preRange = document.createRange();
  preRange.selectNodeContents(bodyEl);
  preRange.setEnd(range.startContainer, range.startOffset);

  const start = preRange.toString().length;
  const text = range.toString();

  // Map to original text offsets (accounting for paragraph rendering)
  const article = App.currentArticle;
  if (!article || !article.text) return null;

  const selectedText = text.trim();
  const idx = article.text.indexOf(selectedText);
  if (idx === -1) {
    // Fallback: use approximate offset
    return { start, end: start + text.length, text: selectedText };
  }

  return { start: idx, end: idx + selectedText.length, text: selectedText };
}

async function annotateSelection(type, color) {
  if (!selectionState || !App.currentArticle) return;

  const offsets = getSelectionOffsets(selectionState.range);
  if (!offsets || !offsets.text) return;

  const annotation = {
    articleId:   App.currentArticle.id,
    type,
    color:       color || null,
    text:        offsets.text,
    startOffset: offsets.start,
    endOffset:   offsets.end,
    comment:     null,
    page:        null,
  };

  const saved = await window.api.saveAnnotation(annotation);
  App.annotations.push(saved);

  App.el('selectionToolbar').style.display = 'none';
  window.getSelection().removeAllRanges();
  selectionState = null;

  renderBodyWithAnnotations(App.currentArticle);
  renderAnnotationPanel();
  showToast(type === 'highlight' ? 'Highlighted.' : 'Underlined.');
}

function openCommentModal() {
  if (!selectionState) return;
  const text = selectionState.range.toString().trim().slice(0, 300);
  App.el('commentSelectedText').textContent = text;
  App.el('commentText').value = '';
  App.el('selectionToolbar').style.display = 'none';
  openModal('commentModal');

  App.el('saveCommentBtn').onclick = async () => {
    const comment = App.el('commentText').value.trim();
    if (!comment) { showToast('Please write a comment.'); return; }

    const offsets = getSelectionOffsets(selectionState.range);
    if (!offsets) { closeModal('commentModal'); return; }

    const annotation = {
      articleId:   App.currentArticle.id,
      type:        'comment',
      color:       App.settings.defaultHighlight || 'yellow',
      text:        offsets.text,
      startOffset: offsets.start,
      endOffset:   offsets.end,
      comment,
    };

    const saved = await window.api.saveAnnotation(annotation);
    App.annotations.push(saved);

    window.getSelection().removeAllRanges();
    selectionState = null;
    closeModal('commentModal');
    renderBodyWithAnnotations(App.currentArticle);
    renderAnnotationPanel();
    showToast('Comment saved.');
  };
}

/* ── Annotation Panel ── */
function renderAnnotationPanel() {
  const list = App.el('panelAnnotationList');
  if (!list || !App.currentArticle) return;

  const artAnnotations = App.annotations.filter(a => a.articleId === App.currentArticle.id);

  if (!artAnnotations.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">
      Select text to highlight or annotate.</div>`;
    return;
  }

  list.innerHTML = artAnnotations.map(a => {
    const icon = a.type === 'highlight'
      ? `<span class="color-badge ${a.color}"></span> Highlight`
      : a.type === 'underline'
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg> Underline`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Comment`;

    return `<div class="panel-annotation-item" data-ann-id="${a.id}">
      <div class="panel-annotation-quote">${escapeHtml((a.text||'').slice(0,120))}</div>
      ${a.comment ? `<div class="panel-annotation-comment">${escapeHtml(a.comment)}</div>` : ''}
      <div class="panel-annotation-meta">
        <div class="panel-annotation-type">${icon}</div>
        <div class="panel-annotation-actions">
          ${a.type === 'comment' ? `<button class="panel-ann-btn edit-ann-btn" data-id="${a.id}" title="Edit">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>` : ''}
          <button class="panel-ann-btn delete-ann-btn" data-id="${a.id}" title="Delete">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Handlers
  list.querySelectorAll('.panel-annotation-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-ann-btn')) {
        deleteAnnotation(e.target.closest('.delete-ann-btn').dataset.id);
        return;
      }
      if (e.target.closest('.edit-ann-btn')) {
        const ann = App.annotations.find(a => a.id === e.target.closest('.edit-ann-btn').dataset.id);
        if (ann) editAnnotationComment(ann);
        return;
      }
      scrollToAnnotation(item.dataset.annId);
    });
  });
}
window.renderAnnotationPanel = renderAnnotationPanel;

function highlightPanelAnnotation(annId) {
  const items = App.el('panelAnnotationList')?.querySelectorAll('.panel-annotation-item');
  items?.forEach(i => {
    i.style.background = i.dataset.annId === annId ? 'var(--accent-soft)' : '';
  });
}

window.scrollToAnnotation = scrollToAnnotation;
function scrollToAnnotation(annId) {
  const el = document.querySelector(`[data-ann-id="${annId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = '2px solid var(--accent)';
    setTimeout(() => { el.style.outline = ''; }, 1500);
  }
  highlightPanelAnnotation(annId);
}

async function deleteAnnotation(id) {
  await window.api.deleteAnnotation(id);
  App.annotations = App.annotations.filter(a => a.id !== id);
  if (App.currentArticle) {
    renderBodyWithAnnotations(App.currentArticle);
    renderAnnotationPanel();
  }
  showToast('Annotation removed.');
}
window.deleteAnnotation = deleteAnnotation;

function editAnnotationComment(ann) {
  App.el('commentSelectedText').textContent = ann.text || '';
  App.el('commentText').value = ann.comment || '';
  openModal('commentModal');

  App.el('saveCommentBtn').onclick = async () => {
    const comment = App.el('commentText').value.trim();
    ann.comment = comment;
    const saved = await window.api.saveAnnotation(ann);
    const idx = App.annotations.findIndex(a => a.id === ann.id);
    if (idx !== -1) App.annotations[idx] = saved;
    closeModal('commentModal');
    renderBodyWithAnnotations(App.currentArticle);
    renderAnnotationPanel();
    showToast('Comment updated.');
  };
}

/* ── Reader Controls ── */
function initReaderControls() {
  App.el('readerBack').addEventListener('click', () => {
    // Clear scroll handler
    App.el('readerMain').onscroll = null;
    App.currentArticle = null;
    navigateTo(previousPage);
  });

  App.el('readerFontDecrease').addEventListener('click', () => {
    readerFontSize = Math.max(13, readerFontSize - 1);
    document.documentElement.style.setProperty('--reader-font-size', readerFontSize + 'px');
  });

  App.el('readerFontIncrease').addEventListener('click', () => {
    readerFontSize = Math.min(28, readerFontSize + 1);
    document.documentElement.style.setProperty('--reader-font-size', readerFontSize + 'px');
  });

  App.el('toggleAnnotations').addEventListener('click', () => {
    const panel = App.el('readerPanel');
    panel.classList.toggle('hidden');
    App.el('toggleAnnotations').classList.toggle('active');
  });

  App.el('readerStatus').addEventListener('change', async (e) => {
    if (!App.currentArticle) return;
    App.currentArticle.status = e.target.value;
    await window.api.saveArticle(App.currentArticle);
    updateHomeStats();
    showToast(`Status: ${e.target.value}`);
  });

  App.el('panelAddNote').addEventListener('click', () => {
    if (!App.currentArticle) return;
    App.el('articleNoteTitle').value = '';
    App.el('articleNoteContent').value = '';
    openModal('articleNoteModal');

    App.el('saveArticleNoteBtn').onclick = async () => {
      const title   = App.el('articleNoteTitle').value.trim() || 'Note';
      const content = App.el('articleNoteContent').value.trim();
      if (!content) { showToast('Please write something.'); return; }
      const note = {
        title,
        content,
        articleId: App.currentArticle.id,
        articleTitle: App.currentArticle.title,
        updatedAt: new Date().toISOString(),
      };
      const saved = await window.api.saveNote(note);
      App.notes.unshift(saved);
      closeModal('articleNoteModal');
      showToast('Note saved.');
    };
  });
}

// Called by app.js after full init
window.initReaderControls = initReaderControls;
