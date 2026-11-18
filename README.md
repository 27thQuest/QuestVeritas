# Reading Library

A minimalist personal reading and research library built with Electron.js.

Save articles, upload PDFs, annotate text, write notes — all stored locally on your machine.

---

## Features

- **Library** — Save articles by pasting text, uploading PDFs, or importing from a URL
- **Reader** — Clean reading interface with adjustable font size and width
- **Annotations** — Highlight text in yellow, red, blue, or green; underline; add comments
- **Notes** — General research notes with autosave; notes can be linked to articles
- **Highlights page** — See all your annotations across every article in one place
- **Settings** — Dark/light theme, font size, reading width, default highlight color
- **Backup** — Export and import your entire library as a single JSON file
- **100% local** — No accounts, no cloud, no tracking

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

---

## Installation & Development

```bash
# Clone or download the project, then:
cd reading-library

# Install dependencies (includes Electron and PDF.js)
npm install

# Start in development mode
npm start
```

---

## Building for Windows

```bash
# Build Windows installer (.exe) + portable executable
npm run dist

# Output is in the dist/ folder
```

The build produces:
- `Reading Library Setup x.x.x.exe` — NSIS installer
- `Reading Library x.x.x.exe` — Portable executable

> **Note:** Building requires the app icon at `src/assets/icon.ico`.  
> For a quick build without an icon, remove the `"icon"` line from `package.json` under `build > win`.

---

## Data Storage

All data is stored in Electron's `userData` directory — never inside the installation folder, so your data survives app updates.

| OS      | Location |
|---------|----------|
| Windows | `%APPDATA%\reading-library\` |
| macOS   | `~/Library/Application Support/reading-library/` |
| Linux   | `~/.config/reading-library/` |

```
userData/
├── database/
│   ├── articles.json
│   ├── notes.json
│   └── annotations.json
├── documents/
│   └── pdfs/        ← imported PDFs are copied here
└── settings/
    └── preferences.json
```

---

## Usage

### Adding Articles

**Paste text** — Fill in the title, author, source and paste the article body.

**Upload PDF** — Click "Choose PDF" or drag and drop. The PDF is copied into your data folder and the original is left untouched.

**Import from URL** — Enter a URL and click Fetch. The app extracts readable text automatically; if extraction fails, paste the text manually.

### Reading

Click any article to open the reader. Use the **A−** / **A+** buttons to adjust font size. Toggle the annotation panel with the chat icon.

Select any text to see the annotation toolbar — choose a highlight color, underline, or add a comment.

### Notes

Open **Notes** in the sidebar. Create a new note with the button, type a title and content — it autosaves every 800ms. Notes can also be created from within the reader (via the + button in the annotation panel).

### Backup

Go to **Settings → Export Backup** to save a `.json` snapshot of everything. Use **Import Backup** to restore it.

---

## Project Structure

```
reading-library/
├── main.js          ← Electron main process
├── preload.js       ← Secure IPC bridge (contextBridge)
├── package.json
├── README.md
└── src/
    ├── index.html
    ├── css/
    │   ├── main.css
    │   ├── sidebar.css
    │   ├── library.css
    │   ├── reader.css
    │   └── notes.css
    └── js/
        ├── app.js          ← Global state, bootstrap
        ├── navigation.js   ← Page routing
        ├── library.js      ← Article management & cards
        ├── reader.js       ← Text reading & annotation
        ├── pdf-reader.js   ← PDF.js integration
        ├── annotations.js  ← Annotations page
        ├── notes.js        ← Notes management
        ├── search.js       ← Search shortcuts
        └── settings.js     ← Settings page
```

---

## Security

- `contextIsolation: true` — renderer has no direct Node.js access
- `nodeIntegration: false` — renderer cannot call Node APIs directly
- All file I/O runs in the main process via IPC
- PDF files are path-validated against `userData` before reading
- Atomic JSON writes (write to `.tmp`, then rename) prevent data corruption

---

## License

MIT
