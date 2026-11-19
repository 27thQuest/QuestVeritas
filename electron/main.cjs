const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { z } = require('zod');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const isDev = !app.isPackaged;
const dataDir = path.join(app.getPath('userData'), 'QuestVeritas');
const pdfDir = path.join(dataDir, 'pdfs');
const libraryFile = path.join(dataDir, 'library.json');
fs.mkdirSync(pdfDir, { recursive: true });
const cachePath = path.join(app.getPath('userData'), 'Cache');
fs.mkdirSync(cachePath, { recursive: true });
app.setPath('cache', cachePath);
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: '#111210',
    title: 'Quest Veritas',
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) mainWindow.loadURL('http://127.0.0.1:5174');
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') shell.openExternal(url);
    } catch { /* Ignore malformed external URLs. */ }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('import:validate-url', (_event, value) => {
  const schema = z.string().url().refine((input) => ['http:', 'https:'].includes(new URL(input).protocol));
  const result = schema.safeParse(value);
  return result.success ? { ok: true, url: result.data } : { ok: false, error: 'Enter a valid http or https URL.' };
});
ipcMain.handle('db:status', () => {
  const databasePath = path.join(app.getPath('userData'), 'database', 'veritas.db');
  return { configured: fs.existsSync(databasePath), path: databasePath };
});

const idSchema = z.string().uuid();
function getDocuments() {
  try { return JSON.parse(fs.readFileSync(libraryFile, 'utf8')); }
  catch { return []; }
}
function saveDocuments(docs) {
  const temp = `${libraryFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(docs, null, 2), 'utf8');
  fs.renameSync(temp, libraryFile);
}
function validatePublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter a public http or https URL.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error('Local network URLs cannot be imported.');
  return url;
}
ipcMain.handle('library:list', () => getDocuments());
ipcMain.handle('import:url', async (_event, value) => {
  try {
    let url = validatePublicUrl(z.string().url().parse(value));
    const response = await fetch(url, { headers: { 'User-Agent': 'QuestVeritas/0.1 (local reader)', Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(20000), redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The page redirected without a destination.');
      url = validatePublicUrl(new URL(location, url).href);
      const redirected = await fetch(url, { headers: { 'User-Agent': 'QuestVeritas/0.1 (local reader)', Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(20000), redirect: 'error' });
      if (!redirected.ok) throw new Error(`The website returned ${redirected.status}.`);
      return await extractArticle(redirected, url.href);
    }
    if (!response.ok) throw new Error(`The website returned ${response.status}.`);
    return await extractArticle(response, url.href);
  } catch (error) { return { ok: false, error: error.message || 'Could not import this page.' }; }
});
async function extractArticle(response, sourceUrl) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('This URL did not return an HTML page. Try downloading its PDF instead.');
  const html = await response.text();
  if (html.length > 20_000_000) throw new Error('This page is too large to import.');
  const dom = new JSDOM(html, { url: sourceUrl });
  const academic = new URL(sourceUrl).hostname === 'arxiv.org' && new URL(sourceUrl).pathname.startsWith('/html/');
  let title, byline, excerpt, articleHtml, textContent;
  if (academic) {
    const paper = dom.window.document.querySelector('article.ltx_document, .ltx_page_main, main, article, #content');
    if (!paper) throw new Error('Could not locate the paper content on this arXiv page.');
    paper.querySelectorAll('script, nav, .ltx_page_header, .ltx_page_footer').forEach(node => node.remove());
    paper.querySelectorAll('[src], [data-src], [href], [srcset]').forEach(node => {
      for (const attr of ['src', 'data-src', 'href']) {
        const value = node.getAttribute(attr);
        if (!value || value.startsWith('#')) continue;
        try {
          const resolved = new URL(value, sourceUrl);
          if (['http:', 'https:'].includes(resolved.protocol)) node.setAttribute(attr, resolved.href);
          else node.removeAttribute(attr);
        } catch { node.removeAttribute(attr); }
      }
      const srcset = node.getAttribute('srcset');
      if (srcset) {
        const resolved = srcset.split(',').map(item => {
          const [candidate, ...descriptor] = item.trim().split(/\s+/);
          try { const parsed = new URL(candidate, sourceUrl); return ['http:', 'https:'].includes(parsed.protocol) ? `${parsed.href} ${descriptor.join(' ')}`.trim() : ''; }
          catch { return ''; }
        }).filter(Boolean).join(', ');
        if (resolved) node.setAttribute('srcset', resolved); else node.removeAttribute('srcset');
      }
    });
    title = dom.window.document.querySelector('.ltx_title_document, h1')?.textContent?.trim() || dom.window.document.title;
    byline = Array.from(paper.querySelectorAll('.ltx_personname')).map(node => node.textContent.trim()).filter(Boolean).join(', ');
    excerpt = paper.querySelector('.ltx_abstract')?.textContent?.trim() || '';
    articleHtml = `<div class="imported-paper">${paper.innerHTML}</div>`;
    textContent = paper.textContent.trim();
  } else {
    const article = new Readability(dom.window.document).parse();
    if (!article || !article.textContent || article.textContent.trim().length < 100) throw new Error('Could not extract readable article text from this page.');
    title=article.title;byline=article.byline||'';excerpt=article.excerpt||'';articleHtml=article.content;textContent=article.textContent.trim();
  }
  if (!textContent || textContent.length < 100) throw new Error('Could not extract readable content from this page.');
  const purifier = createDOMPurify(dom.window);
  const content = purifier.sanitize(articleHtml, { FORBID_TAGS: ['script', 'form', 'iframe', 'object', 'embed'], FORBID_ATTR: ['onerror', 'onclick', 'onload'] });
  const doc = { id: crypto.randomUUID(), title: title || new URL(sourceUrl).hostname, authors: byline, source: new URL(sourceUrl).hostname, url: sourceUrl, type: 'article', isAcademic: academic, excerpt, content, text: textContent, importedAt: new Date().toISOString() };
  const docs = getDocuments(); docs.unshift(doc); saveDocuments(docs);
  return { ok: true, document: doc };
}
ipcMain.handle('import:pdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Import PDF', filters: [{ name: 'PDF document', extensions: ['pdf'] }], properties: ['openFile'] });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  const source = result.filePaths[0];
  const id = crypto.randomUUID();
  const destination = path.join(pdfDir, `${id}.pdf`);
  fs.copyFileSync(source, destination);
  const doc = { id, title: path.basename(source, path.extname(source)), authors: '', source: 'PDF', url: '', type: 'pdf', pdfFile: `${id}.pdf`, importedAt: new Date().toISOString() };
  const docs = getDocuments(); docs.unshift(doc); saveDocuments(docs);
  return { ok: true, document: doc };
});
ipcMain.handle('pdf:read', (_event, id) => {
  const safeId = idSchema.parse(id);
  const doc = getDocuments().find(item => item.id === safeId && item.type === 'pdf');
  if (!doc) throw new Error('PDF not found.');
  const filePath = path.join(pdfDir, doc.pdfFile);
  if (!filePath.startsWith(pdfDir + path.sep)) throw new Error('Invalid PDF path.');
  return fs.readFileSync(filePath).toString('base64');
});
