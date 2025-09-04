## BRR Demo - Setup Guide for Recipients

This guide explains how to run the application after receiving it without the `node_modules` folder.

### Prerequisites
- Node.js LTS 18.18+ or 20.x
- pnpm (via Corepack)

Enable pnpm with Corepack (Windows PowerShell):

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

### 1) Install dependencies

```powershell
pnpm install --frozen-lockfile
```

Notes:
- The PDF viewer uses `react-pdf` (already listed in `package.json`).
- The PDF worker is served from `public/pdf.worker.min.mjs`; no extra setup is required.

### 2) Environment variables

Copy the example file and fill in any required values (do not commit secrets):

```powershell
copy env.example .env.local
```

If you don't need environment variables, this step can be skipped.

### 3) Run the app

Development mode:

```powershell
pnpm dev
```

Production mode:

```powershell
pnpm build
pnpm start
```

The app will run on `http://localhost:3000` by default.

### 4) Project notes
- This is a Next.js app (see `package.json` scripts).
- The PDF viewer component is in `components/pdf-viewer.tsx` and uses `react-pdf`.
- The PDF worker file is at `public/pdf.worker.min.mjs` and is referenced internally by the viewer.

### 5) Sharing the project further (without node_modules)
- Preferred: share via a Git repository (leave `node_modules` ignored by `.gitignore`).
- Or: zip the folder after removing `node_modules`, `.next`, and `.turbo` (if present). Ensure `package.json` and `pnpm-lock.yaml` are included so installs are reproducible.

### 6) Troubleshooting
- If install issues occur, try:
  - `pnpm install --force`
  - Delete `.next/` and run `pnpm dev` again
- If the PDF does not render, confirm:
  - The PDF URL/file exists and is reachable
  - The worker file exists at `public/pdf.worker.min.mjs`


