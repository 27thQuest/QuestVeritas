import React from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Highlighter, Inbox, LibraryBig, NotebookPen, Plus, Search, Settings, X, Globe2, FileText } from 'lucide-react';
import './style.css';

const pages = [
  { name: 'Library', icon: BookOpen }, { name: 'Inbox', icon: Inbox },
  { name: 'Highlights', icon: Highlighter }, { name: 'Notes', icon: NotebookPen },
  { name: 'Settings', icon: Settings },
];

function App() {
  const [page, setPage] = React.useState('Library');
  const [showImport, setShowImport] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const openImport = () => { setStatus(''); setUrl(''); setShowImport(true); };

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') { event.preventDefault(); openImport(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearching(true); document.getElementById('global-search')?.focus(); }
      if (event.key === 'Escape') setShowImport(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function validateUrl() {
    const result = await window.veritas?.validateImportUrl(url);
    setStatus(result?.ok ? 'URL is valid. Article importing is not connected yet.' : result?.error ?? 'Could not validate this URL.');
  }

  const title = page;
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brandmark"><LibraryBig size={17}/></div><span>Quest Veritas</span></div>
      <button className="searchbox" onClick={() => { setSearching(true); requestAnimationFrame(() => document.getElementById('global-search')?.focus()); }}><Search size={15}/><span>Search anything</span><kbd>Ctrl K</kbd></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>{pages.map(({name, icon: Icon}) => <button key={name} className={`navitem ${page===name?'active':''}`} onClick={() => setPage(name)}><Icon size={17}/>{name}</button>)}</nav>
      <div className="sidebar-bottom"><div className="storage"><div><strong>Your library</strong><small>Stored on this device</small></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>{title}</b></div>{searching&&<label className="inline-search"><Search size={15}/><input id="global-search" placeholder="Search your library" value={query} onChange={e=>setQuery(e.target.value)}/><button className="iconbtn" onClick={()=>{setSearching(false);setQuery('')}}><X size={14}/></button></label>}</header>
      <section className="content">
        <div className="page-heading"><div><div className="eyebrow">YOUR PERSONAL RESEARCH SPACE</div><h1>{title}<span className="period">.</span></h1><p className="subheading">{page==='Library'?'A home for the ideas worth keeping.':`Your ${page.toLowerCase()} will live here.`}</p></div>{page==='Library'&&<button className="primary" onClick={openImport}><Plus size={17}/> Import source</button>}</div>
        {page==='Library'&&<div className="empty-panel"><div className="empty-icon"><BookOpen/></div><strong>Your library starts here</strong><span>Import an article or paper to read, annotate, and revisit.</span><button className="primary" onClick={openImport}><Plus size={16}/> Import a source</button></div>}
        {page!=='Library'&&<div className="empty-panel"><div className="empty-icon"><BookOpen/></div><strong>{page} is ready for your research</strong><span>This section will show your saved {page.toLowerCase()} as you add content.</span>{page==='Notes'&&<button className="primary" onClick={()=>setStatus('Notes editor is coming in the next implementation step.')}><Plus size={16}/> New note</button>}</div>}
      </section>
    </main>
    {showImport&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowImport(false)}}><div className="dialog"><button className="dialog-close" onClick={()=>setShowImport(false)}><X size={17}/></button><div className="dialog-icon"><Plus size={19}/></div><div className="eyebrow">GROW YOUR LIBRARY</div><h2>Bring something in.</h2><p className="dialog-sub">Save an article or paper to read, annotate, and return to.</p><div className="import-tabs"><button className="tab selected"><Globe2 size={15}/> Web link</button><button className="tab" onClick={()=>setStatus('PDF import is not connected yet.')}><FileText size={15}/> PDF</button></div><label className="input-label">ARTICLE OR PAPER URL</label><div className="url-row"><Globe2 size={16}/><input autoFocus placeholder="https:// or arxiv.org/abs/..." value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void validateUrl()}/><button onClick={()=>void validateUrl()}>Continue</button></div>{status&&<p className="dialog-sub" role="status">{status}</p>}<div className="dialog-foot"><span>arXiv papers and web articles supported</span><kbd>ESC</kbd></div></div></div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
