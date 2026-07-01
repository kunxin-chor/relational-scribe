# Logical Schema Diagram Creator

A frontend-only logical database schema diagram editor inspired by [SQLDBM](https://www.sqldbm.com). Built with React, TypeScript, Jotai, wouter, and `@xyflow/react`.

## Features

- Create tables on an infinite canvas.
- Edit tables: rename, add/remove columns, choose MySQL data types (or type a custom type), and separate primary-key vs normal columns.
- Create relationships by dragging corner handles:
  - **Lower-right handle** → create a FK in the destination table referencing the source table.
  - **Upper-left handle** → create a FK in the source table referencing the destination table.
  - Map source columns to target columns in a relationship modal.
  - Foreign-key columns are highlighted with a 🔗 icon.
- Drag tables to reposition them.
- Auto-saves the current schema to `localStorage`.
- Download / upload schema JSON files.
- Export the canvas as PNG.
- Browse saved schemas stored in `localStorage`.

## Tech Stack

- React 19 + TypeScript
- Vite
- Jotai (state management)
- wouter (hash-based routing)
- `@xyflow/react` (diagram canvas)
- `html-to-image` (PNG export)
- `nanoid` (IDs)

## Getting Started

```bash
npm install
npm run dev
```

Open the URL shown in your terminal (usually `http://localhost:5173/`).

## Build

```bash
npm run build
```

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run preview` — preview production build

## Deploy to Netlify

A `netlify.toml` is included with the build settings.

### Option 1: Connect the Git repository

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In the [Netlify dashboard](https://app.netlify.com/), click **Add new site** → **Import an existing project**.
3. Choose your Git provider and repository.
4. Use the following settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**.

Netlify will build and deploy automatically on every push.

### Option 2: Manual deploy from the CLI

1. Install the Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Deploy the `dist` folder:
   ```bash
   netlify deploy --prod --dir=dist
   ```

### SPA routing

The `netlify.toml` includes a catch-all redirect so Netlify serves `index.html` for every route. The app uses hash-based routing (`/#/saves`), so refreshes and direct links work out of the box.
