# Quest Veritas

Quest Veritas is a local-first desktop reading and research library. The project is being migrated from its original plain JavaScript Electron app to a React and TypeScript architecture.

## Current status

The repository contains the initial React, TypeScript, Vite, and Electron scaffold, a dark library interface draft, a typed preload bridge, and an initial Drizzle SQLite schema. The migration is in progress. The existing reader, notes, annotations, PDF handling, and JSON backup features remain in the legacy `src/index.html` and `src/js/` application and have not yet been ported to the new interface. URL validation is wired to Electron IPC; article fetching and extraction are not yet implemented in the new app.

The current UI uses illustrative library cards for layout work. They are not records loaded from the database. SQLite persistence and database migrations are not yet connected to the application runtime.

## Technology

- Electron with context isolation, sandboxed renderer, and Node integration disabled
- React, TypeScript, Vite, and React Router
- Tailwind CSS v4 and Lucide icons
- Drizzle ORM with SQLite schema foundation
- Zustand, Zod, TipTap, and Radix UI dependencies for upcoming features
- electron-builder for Windows packaging

## Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- npm
- Windows for the configured NSIS and portable builds

## Development

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Start the Electron application with the Vite development server:

```bash
npm start
```

Create a production renderer build:

```bash
npm run build
```

Generate a Drizzle migration after changing `src/db/schema.ts`:

```bash
npm run db:generate
```

Build Windows installer and portable packages:

```bash
npm run dist
```

The development and packaging commands are scaffolded and should be considered in progress until they complete successfully in the target environment.

## Architecture

```text
React renderer (src/)
  -> typed, limited window.veritas API (electron/preload.ts)
  -> validated Electron IPC handlers (electron/main.ts)
  -> local application data (planned SQLite database and document storage)
```

The renderer does not receive direct Node.js or filesystem access. Privileged operations should be added as explicit IPC methods, with input validation in the main process. User data is intended to live under Electron's `app.getPath('userData')` directory; runtime SQLite initialization and migrations remain to be implemented.

## Project layout

```text
electron/
  main.ts             Electron main process and IPC handlers
  preload.ts          Restricted context bridge
src/
  db/schema.ts        Initial Drizzle SQLite schema
  main.tsx            React application entry and UI
  style.css           Application styles and Tailwind import
  index.html          Legacy application entry (being retired)
  js/                 Legacy plain JavaScript features
  css/                Legacy application styles
drizzle.config.ts     Drizzle Kit configuration
vite.config.ts        Vite, React, Tailwind, and Electron plugins
```

## Data and privacy

Quest Veritas is designed for local-first storage without a required account or cloud service. The new SQLite runtime, local PDF storage, and backup/restore flow are not yet implemented. Avoid treating the current UI mock cards as saved user data.

## Security

- Electron renderer uses `contextIsolation: true`, `nodeIntegration: false`, and sandboxing.
- The preload exposes a small, explicit API instead of raw IPC access.
- IPC inputs should be validated and filesystem paths constrained as features are added.
- Imported HTML must be sanitized before display; URL fetching and article extraction are not yet available in the new interface.

## License

MIT
