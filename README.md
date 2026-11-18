# **Quest Veritas**

A minimalist personal reading and research library built with Electron.js.

Save articles, upload PDFs, annotate text, and write notes — all stored locally on your machine.

## **Features**

- **Library** — Save articles by pasting text, uploading PDFs, or importing from a URL.
- **Reader** — Clean reading interface with adjustable font size and reading width.
- **Annotations** — Highlight text in yellow, red, blue, or green; underline text; and add comments.
- **Notes** — General research notes with autosave. Notes can be linked to articles.
- **Highlights** — View all annotations across every article in one place.
- **Settings** — Customize dark/light theme, font size, reading width, and default highlight color.
- **Backup** — Export or import your entire library as a single JSON file.
- **100% Local** — No accounts, cloud storage, or tracking.

## **Requirements**

- [Node.js](https://nodejs.org/?utm_source=chatgpt.com) v18 or later
- npm v9 or later

## **Installation & Development**

```
# Clone or download the project, then:
cd quest-veritas

# Install dependencies (includes Electron and PDF.js)
npm install

# Start in development mode
npm start
```

## **Building for Windows**

```
# Build Windows installer (.exe) + portable executable
npm run dist

# Output is in the dist/ folder
```

The build produces:

- `Quest Veritas Setup x.x.x.exe` — NSIS installer
- `Quest Veritas x.x.x.exe` — Portable executable

> **Note:** Building requires the app icon at `src/assets/icon.ico`.\
> For a quick build without an icon, remove the `"icon"` line from `package.json` under `build > win`.

## **Data Storage**

All data is stored in Electron's `userData` directory — never inside the installation folder, so your data survives app updates.

| OS      | Location                                       |
| ------- | ---------------------------------------------- |
| Windows | `%APPDATA%\quest-veritas\`                     |
| macOS   | `~/Library/Application Support/quest-veritas/` |
| Linux   | `~/.config/quest-veritas/`                     |

```
userData/
├── database/
│   ├── articles.json
│   ├── notes.json
│   └── annotations.json
├── documents/
│   └── pdfs/             ← Imported PDFs are copied here
└── settings/
    └── preferences.json
```

## **Usage**

### **Adding Articles**

**Paste Text** — Fill in the title, author, source, and paste the article body.

**Upload PDF** — Click "Choose PDF" or drag and drop. The PDF is copied into your data folder, leaving the original untouched.

**Import from URL** — Enter a URL and click Fetch. The app automatically extracts readable text. If extraction fails, you can paste the text manually.

### **Reading**

Click any article to open the reader. Use the **A− / A+** buttons to adjust font size. Toggle the annotation panel using the chat icon.

Select text to reveal the annotation toolbar — choose a highlight color, underline text, or add a comment.

### **Notes**

Open **Notes** in the sidebar. Create a new note using the new-note button, then enter a title and content. Notes autosave every 800ms.

You can also create notes directly from the reader using the **+** button in the annotation panel.

### **Backup**

Go to **Settings → Export Backup** to save a `.json` snapshot of your entire library.

Use **Import Backup** to restore your library from a previous backup.

## **Project Structure**

```
quest-veritas/
├── main.js                 ← Electron main process
├── preload.js              ← Secure IPC bridge (contextBridge)
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
        ├── annotations.js   ← Annotations page
        ├── notes.js        ← Notes management
        ├── search.js       ← Search shortcuts
        └── settings.js     ← Settings page
```

## **Security**

- `contextIsolation: true` — Renderer has no direct Node.js access.
- `nodeIntegration: false` — Renderer cannot call Node APIs directly.
- All file I/O runs in the main process via IPC.
- PDF files are path-validated against `userData` before reading.
- Atomic JSON writes (write to `.tmp`, then rename) prevent data corruption.

## **License**

MIT