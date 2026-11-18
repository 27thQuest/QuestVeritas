/* ── PDF Reader ── */

let pdfDoc = null;
let pdfPageNum = 1;
let pdfScale = 1.4;
let pdfWorkerSrc = null;
let pdfZoomRenderPromise = Promise.resolve();
let pdfZoomRenderId = 0;
let pdfPinchState = null;
let pdfPinchFrame = null;

async function renderPdfReader(article) {
  const container = App.el('readerArticle');

  container.innerHTML = `
    <div class="reader-article-header" style="max-width:100%">
      <h1 class="reader-article-title">${escapeHtml(article.title)}</h1>
      ${article.author ? `<div class="reader-article-byline"><span>${escapeHtml(article.author)}</span></div>` : ''}
    </div>

    <div class="pdf-reader-wrap">
      <div class="pdf-controls">
        <button class="reader-ctrl-btn" id="pdfPrevBtn">‹</button>

        <div class="pdf-page-info">
          Page <input type="number" id="pdfPageInput"
          min="1" value="1" style="width:46px">
          of <span id="pdfPageCount">?</span>
        </div>

        <button class="reader-ctrl-btn" id="pdfNextBtn">›</button>

        <div style="flex:1"></div>

        <button class="reader-ctrl-btn" id="pdfZoomOut">−</button>
        <span class="pdf-zoom-info" id="pdfZoomInfo">140%</span>
        <button class="reader-ctrl-btn" id="pdfZoomIn">+</button>

        <button class="reader-ctrl-btn" id="pdfAnnotateBtn"
        title="Add page annotation">Comment</button>
      </div>

      <div id="pdfCanvas"></div>
    </div>
  `;

    // Show loading screen immediately
  setPdfLoading('Preparing PDF...', 0);

  // Load PDF.js
  await loadPdfJs();

  setPdfLoading('Reading PDF file...', 10);

  // Load PDF data

  const base64 = await window.api.readPDF(article.pdfPath);

  if (!base64) {
    App.el('pdfCanvas').innerHTML =
      '<div class="empty-state"><p>Could not load PDF.</p></div>';
    return;
  }

  const data = atob(base64);
  const bytes = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i++) {
    bytes[i] = data.charCodeAt(i);
  }

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;

    App.el('pdfPageCount').textContent = pdfDoc.numPages;

    pdfPageNum = article.pdfPage || 1;

    App.el('pdfPageInput').value = pdfPageNum;
    App.el('pdfPageInput').max = pdfDoc.numPages;

    await renderAllPdfPages();

    const canvas = App.el('pdfCanvas');

    App.el('pdfPrevBtn').onclick = () => {
      if (pdfPageNum > 1) {
        pdfPageNum--;
        scrollToPdfPage(pdfPageNum);
      }
    };

    App.el('pdfNextBtn').onclick = () => {
      if (pdfPageNum < pdfDoc.numPages) {
        pdfPageNum++;
        scrollToPdfPage(pdfPageNum);
      }
    };

    App.el('pdfPageInput').onchange = () => {
      const p = parseInt(App.el('pdfPageInput').value);

      if (p >= 1 && p <= pdfDoc.numPages) {
        pdfPageNum = p;
        scrollToPdfPage(p);
      }
    };

    App.el('pdfZoomIn').onclick = () =>
      setPdfZoom(pdfScale + 0.2);

    App.el('pdfZoomOut').onclick = () =>
      setPdfZoom(pdfScale - 0.2);

    // Trackpad pinch and Ctrl + mouse wheel
    canvas.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();

      const factor = Math.exp(-event.deltaY * 0.002);

      setPdfZoom(
        pdfScale * factor,
        event.clientX,
        event.clientY
      );
    }, { passive: false });

    // Touchscreen pinch
    canvas.addEventListener(
      'touchstart', handlePdfTouchStart, { passive: false }
    );

    canvas.addEventListener(
      'touchmove', handlePdfTouchMove, { passive: false }
    );

    canvas.addEventListener(
      'touchend', handlePdfTouchEnd
    );

    canvas.addEventListener(
      'touchcancel', handlePdfTouchEnd
    );

    App.el('pdfAnnotateBtn').onclick = () => {
      openPdfAnnotationModal(article, pdfPageNum);
    };

    canvas.addEventListener('scroll', updateCurrentPageFromScroll);

  } catch (err) {
    App.el('pdfCanvas').innerHTML =
      `<div class="empty-state"><p>Error loading PDF: ${err.message}</p></div>`;
  }
}


// ── Render all pages ──
function setPdfLoading(message, progress = 0) {
  const container = App.el('pdfCanvas');
  if (!container) return;

  let loader = container.querySelector('.pdf-loading');

  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'pdf-loading';
    loader.innerHTML = `
      <div class="pdf-loading-spinner"></div>
      <div class="pdf-loading-text">Preparing PDF...</div>
      <div class="pdf-loading-progress">
        <div class="pdf-loading-progress-bar"></div>
      </div>
    `;
    container.appendChild(loader);
  }

  loader.querySelector('.pdf-loading-text').textContent = message;
  loader.querySelector('.pdf-loading-progress-bar').style.width =
    `${Math.min(100, progress)}%`;

  loader.classList.remove('hidden');
}

function hidePdfLoading() {
  const loader = App.el('pdfCanvas')?.querySelector('.pdf-loading');
  if (loader) loader.classList.add('hidden');
}

async function renderAllPdfPages() {
  const container = App.el('pdfCanvas');
  container.innerHTML = '';

  setPdfLoading('Preparing pages...', 0);

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    setPdfLoading(
      `Rendering page ${i} of ${pdfDoc.numPages}...`,
      (i - 1) / pdfDoc.numPages * 100
    );

    const wrapper = document.createElement('div');
    wrapper.id = `pdfPage${i}`;
    wrapper.style.cssText =
      'position:relative; display:inline-block; margin-bottom:12px;';

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);

    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdf-text-layer';
    textLayerDiv.style.cssText = `
      position:absolute;
      top:0;
      left:0;
      right:0;
      bottom:0;
      overflow:hidden;
      line-height:1;
      pointer-events:auto;
    `;

    wrapper.appendChild(textLayerDiv);
    container.appendChild(wrapper);

    await renderPdfPage(i, canvas);
    await renderPdfTextLayer(i, canvas, textLayerDiv);
  }

  setPdfLoading('Finishing up...', 100);

  renderPdfAnnotationOverlays();

  if (pdfPageNum > 1) {
    scrollToPdfPage(pdfPageNum);
  }

  hidePdfLoading();
}


// ── Render individual page ──

async function renderPdfPage(num, canvas) {
  const page = await pdfDoc.getPage(num);

  const dpr = window.devicePixelRatio || 1;

  const viewport = page.getViewport({
    scale: pdfScale * dpr
  });

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  canvas.style.height = `${viewport.height / dpr}px`;
  canvas.style.width = `${viewport.width / dpr}px`;

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport
  }).promise;
}


// ── Zoom anchor ──

function capturePdfZoomAnchor(clientX, clientY) {
  const container = App.el('pdfCanvas');

  if (!container) return null;

  const rect = container.getBoundingClientRect();

  const x = Number.isFinite(clientX)
    ? clientX : rect.left + rect.width / 2;

  const y = Number.isFinite(clientY)
    ? clientY : rect.top + rect.height / 2;

  let wrapper = null;

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const candidate = App.el(`pdfPage${i}`);

    if (!candidate) continue;

    const r = candidate.getBoundingClientRect();

    if (
      x >= r.left && x <= r.right &&
      y >= r.top && y <= r.bottom
    ) {
      wrapper = candidate;
      break;
    }
  }

  if (!wrapper) {
    const pages = [...container.querySelectorAll('.pdf-page-wrapper')];

    wrapper = pages.find(el => {
      const r = el.getBoundingClientRect();
      return r.bottom >= rect.top && r.top <= rect.bottom;
    }) || pages[0];
  }

  if (!wrapper) return null;

  const pageRect = wrapper.getBoundingClientRect();

  return {
    pageId: wrapper.id,

    ratioX: (x - pageRect.left) / pageRect.width,
    ratioY: (y - pageRect.top) / pageRect.height,

    localX: x - rect.left,
    localY: y - rect.top
  };
}


function restorePdfZoomAnchor(anchor) {
  if (!anchor) return;

  const container = App.el('pdfCanvas');
  const wrapper = App.el(anchor.pageId);

  if (!container || !wrapper) return;

  const containerRect = container.getBoundingClientRect();
  const pageRect = wrapper.getBoundingClientRect();

  const contentX =
    pageRect.left - containerRect.left +
    container.scrollLeft +
    anchor.ratioX * pageRect.width;

  const contentY =
    pageRect.top - containerRect.top +
    container.scrollTop +
    anchor.ratioY * pageRect.height;

  container.scrollLeft = Math.max(0, contentX - anchor.localX);
  container.scrollTop = Math.max(0, contentY - anchor.localY);
}


// ── Set zoom ──

function setPdfZoom(nextScale, clientX, clientY) {
  if (!pdfDoc) return;

  const next = Math.max(0.5, Math.min(3.0, nextScale));

  if (Math.abs(next - pdfScale) < 0.005) return;

  const anchor = capturePdfZoomAnchor(clientX, clientY);

  pdfScale = next;

  rerenderAllPages(anchor);
}


// ── Rerender canvas AND text layers ──

async function rerenderAllPages(anchor = null) {

  const zoomInfo = App.el('pdfZoomInfo');

  if (zoomInfo) {
    zoomInfo.textContent = Math.round(pdfScale * 100) + '%';
  }

  const renderId = ++pdfZoomRenderId;

  pdfZoomRenderPromise = pdfZoomRenderPromise
    .catch(() => {})
    .then(async () => {

      if (renderId !== pdfZoomRenderId) return;

      const container = App.el('pdfCanvas');

      if (!container || !pdfDoc) return;

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {

        if (renderId !== pdfZoomRenderId) return;

        const wrapper = App.el(`pdfPage${pageNum}`);

        const pageCanvas = wrapper?.querySelector('canvas');
        const textLayer = wrapper?.querySelector('.pdf-text-layer');

        if (!pageCanvas || !textLayer) continue;

        await renderPdfPage(pageNum, pageCanvas);

        if (renderId !== pdfZoomRenderId) return;

        await renderPdfTextLayer(
          pageNum,
          pageCanvas,
          textLayer
        );
      }

      if (renderId === pdfZoomRenderId) {
        restorePdfZoomAnchor(anchor);
      }
    });

  return pdfZoomRenderPromise;
}


// ── Pinch zoom ──

function getPdfTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;

  return Math.hypot(dx, dy);
}


function handlePdfTouchStart(event) {
  if (event.touches.length !== 2) return;

  event.preventDefault();

  const midpointX =
    (event.touches[0].clientX + event.touches[1].clientX) / 2;

  const midpointY =
    (event.touches[0].clientY + event.touches[1].clientY) / 2;

  pdfPinchState = {
    startDistance: getPdfTouchDistance(event.touches),
    startScale: pdfScale,
    midpointX,
    midpointY
  };
}


function handlePdfTouchMove(event) {
  if (!pdfPinchState || event.touches.length !== 2) return;

  event.preventDefault();

  const distance = getPdfTouchDistance(event.touches);

  const midpointX =
    (event.touches[0].clientX + event.touches[1].clientX) / 2;

  const midpointY =
    (event.touches[0].clientY + event.touches[1].clientY) / 2;

  const nextScale =
    pdfPinchState.startScale *
    (distance / Math.max(1, pdfPinchState.startDistance));

  if (pdfPinchFrame) {
    cancelAnimationFrame(pdfPinchFrame);
  }

  pdfPinchFrame = requestAnimationFrame(() => {

    setPdfZoom(nextScale, midpointX, midpointY);

    pdfPinchFrame = null;
  });
}


function handlePdfTouchEnd(event) {
  if (event.touches.length < 2) {
    pdfPinchState = null;
  }
}


// ── Page navigation ──

function scrollToPdfPage(pageNum) {
  const wrapper = App.el(`pdfPage${pageNum}`);

  if (!wrapper) return;

  wrapper.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  App.el('pdfPageInput').value = pageNum;

  if (App.currentArticle) {

    App.currentArticle.pdfPage = pageNum;

    clearTimeout(App._pdfSaveTimer);

    App._pdfSaveTimer = setTimeout(() => {
      window.api.saveArticle(App.currentArticle);
    }, 800);
  }
}


function updateCurrentPageFromScroll() {
  const canvas = App.el('pdfCanvas');

  if (!canvas || !pdfDoc) return;

  const scrollTop = canvas.scrollTop + 60;

  for (let i = 1; i <= pdfDoc.numPages; i++) {

    const wrapper = App.el(`pdfPage${i}`);

    if (wrapper && wrapper.offsetTop <= scrollTop) {

      pdfPageNum = i;

      App.el('pdfPageInput').value = i;
    }
  }
}


// ── PDF text layer ──

async function renderPdfTextLayer(num, canvas, textLayerDiv) {
  try {

    textLayerDiv.innerHTML = '';

    const page = await pdfDoc.getPage(num);

    const viewport = page.getViewport({
      scale: pdfScale
    });

    const textContent = await page.getTextContent();

    textLayerDiv.style.width = canvas.style.width;
    textLayerDiv.style.height = canvas.style.height;

    await pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport: viewport,
      textDivs: []
    }).promise;

  } catch (e) {
    console.warn('PDF text layer unavailable:', e);
  }
}


// ── Annotation overlays ──

function renderPdfAnnotationOverlays() {
  if (!App.currentArticle) return;

  const artAnnotations = App.annotations.filter(a =>
    a.articleId === App.currentArticle.id && a.pdfPage
  );

  artAnnotations.forEach(ann => {

    const wrapper = App.el(`pdfPage${ann.pdfPage}`);

    if (!wrapper) return;

    let overlay = wrapper.querySelector('.pdf-ann-overlay');

    if (!overlay) {

      overlay = document.createElement('div');

      overlay.className = 'pdf-ann-overlay';

      wrapper.appendChild(overlay);
    }

    const dot = document.createElement('div');

    dot.textContent = ann.text || `Page ${ann.pdfPage} annotation`;

    dot.title = ann.comment || ann.text || '';

    dot.onclick = () => highlightPanelAnnotation(ann.id);

    overlay.appendChild(dot);
  });
}


// ── Page annotation modal ──

function openPdfAnnotationModal(article, pageNum) {

  App.el('commentSelectedText').textContent =
    `Page ${pageNum} of "${article.title}"`;

  App.el('commentText').value = '';

  openModal('commentModal');

  App.el('saveCommentBtn').onclick = async () => {

    const text = App.el('commentText').value.trim();

    if (!text) {
      showToast('Please write something.');
      return;
    }

    const annotation = {
      articleId: article.id,
      type: 'comment',
      color: null,
      text: `[Page ${pageNum}] ${text}`,
      comment: text,
      pdfPage: pageNum,
      startOffset: null,
      endOffset: null
    };

    const saved = await window.api.saveAnnotation(annotation);

    App.annotations.push(saved);

    closeModal('commentModal');

    renderAnnotationPanel();

    renderPdfAnnotationOverlays();

    showToast('Note added to page.');
  };
}


// ── Load PDF.js ──

async function loadPdfJs() {

  if (typeof pdfjsLib !== 'undefined') return;

  return new Promise((resolve, reject) => {

    const paths = [
      '../../node_modules/pdfjs-dist/build/pdf.js',
      '../node_modules/pdfjs-dist/build/pdf.js',
      'node_modules/pdfjs-dist/build/pdf.js'
    ];

    const tryPath = (idx) => {

      if (idx >= paths.length) {
        reject(new Error('pdfjs-dist not found. Run npm install.'));
        return;
      }

      const script = document.createElement('script');

      script.src = paths[idx];

      script.onload = () => {

        pdfWorkerSrc = paths[idx].replace(
          'pdf.js',
          'pdf.worker.js'
        );

        resolve();
      };

      script.onerror = () => tryPath(idx + 1);

      document.head.appendChild(script);
    };

    tryPath(0);
  });
}


window.renderPdfReader = renderPdfReader;