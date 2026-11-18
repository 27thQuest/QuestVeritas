/* ── Notes ── */
let notesSaveTimer = null;
let currentNoteId = null;

function initNotes() {
  App.el('newNoteBtn').addEventListener('click', createNewNote);
  App.el('notesSearch').addEventListener('input', renderNotesList);
}

function renderNotesList() {
  const search = App.el('notesSearch').value.toLowerCase();
  let list = [...App.notes];

  if (search) list = list.filter(n =>
    (n.title || '').toLowerCase().includes(search) ||
    (n.content || '').toLowerCase().includes(search)
  );

  list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const container = App.el('notesList');
  if (!list.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">
      No notes yet. Create your first note.</div>`;
    return;
  }

  container.innerHTML = list.map(n => {
    const preview = (n.content || '').slice(0, 60).replace(/\n/g, ' ');
    const isActive = n.id === currentNoteId ? ' active' : '';
    const article = n.articleId ? App.articles.find(a => a.id === n.articleId) : null;

    return `<div class="note-item${isActive}" data-id="${n.id}">
      <div class="note-item-title">${escapeHtml(n.title || 'Untitled')}</div>
      <div class="note-item-preview">${escapeHtml(preview) || 'Empty note'}</div>
      <div class="note-item-meta">
        <span class="note-item-date">${formatRelative(n.updatedAt || n.createdAt)}</span>
        ${article ? `<span class="note-item-article-link">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Linked
        </span>` : ''}
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', () => openNote(item.dataset.id));
  });
}
window.renderNotesList = renderNotesList;

async function createNewNote() {
  const note = {
    title: '',
    content: '',
    updatedAt: new Date().toISOString(),
  };
  const saved = await window.api.saveNote(note);
  App.notes.unshift(saved);
  renderNotesList();
  openNote(saved.id);
}

function openNote(id) {
  const note = App.notes.find(n => n.id === id);
  if (!note) return;

  currentNoteId = id;
  App.currentNote = note;

  const editor = App.el('notesEditor');
  const article = note.articleId ? App.articles.find(a => a.id === note.articleId) : null;

  editor.innerHTML = `
    <div class="note-editor-header">
      <input type="text" class="note-title-input" id="noteTitleInput" 
        placeholder="Note title…" value="${escapeHtml(note.title || '')}">
      <div class="note-editor-meta">
        <span>${formatDate(note.updatedAt || note.createdAt)}</span>
        ${article ? `<span class="note-article-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          ${escapeHtml(article.title.slice(0, 40))}
        </span>` : ''}
      </div>
    </div>
    <div class="note-content-area">
      <textarea class="note-textarea" id="noteContentInput" 
        placeholder="Start writing…">${escapeHtml(note.content || '')}</textarea>
    </div>
    <div class="note-editor-footer">
      <span class="note-autosave-status" id="noteAutosave">Autosaved</span>
      <button class="note-delete-btn" id="noteDeleteBtn">Delete note</button>
    </div>
  `;

  // Autosave on title change
  App.el('noteTitleInput').addEventListener('input', () => scheduleNoteSave());
  App.el('noteContentInput').addEventListener('input', () => scheduleNoteSave());

  App.el('noteDeleteBtn').addEventListener('click', async () => {
    if (!confirm('Delete this note?')) return;
    await window.api.deleteNote(note.id);
    App.notes = App.notes.filter(n => n.id !== note.id);
    currentNoteId = null;
    App.currentNote = null;
    App.el('notesEditor').innerHTML = `<div class="notes-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      <p>Select a note or create a new one</p>
    </div>`;
    renderNotesList();
    showToast('Note deleted.');
  });

  // Focus on content
  setTimeout(() => App.el('noteContentInput')?.focus(), 50);

  // Update active state in list
  document.querySelectorAll('.note-item').forEach(i => {
    i.classList.toggle('active', i.dataset.id === id);
  });
}

function scheduleNoteSave() {
  const statusEl = App.el('noteAutosave');
  if (statusEl) statusEl.textContent = 'Saving…';

  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(async () => {
    if (!App.currentNote) return;
    App.currentNote.title   = App.el('noteTitleInput')?.value || '';
    App.currentNote.content = App.el('noteContentInput')?.value || '';
    App.currentNote.updatedAt = new Date().toISOString();

    const saved = await window.api.saveNote(App.currentNote);
    const idx = App.notes.findIndex(n => n.id === saved.id);
    if (idx !== -1) App.notes[idx] = saved;

    if (statusEl) statusEl.textContent = 'Autosaved';
    renderNotesList(); // refresh list order/preview
  }, 800);
}
