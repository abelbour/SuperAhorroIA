# Deployment & Build Configuration

## Build Tool: Vite

**Config**: `vite.config.ts`

```typescript
export default defineConfig(() => ({
  base: process.env.NODE_ENV === 'production' ? '/SuperAhorroIA/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
```

### Key Settings
- **Base path**: `/SuperAhorroIA/` in production (GitHub Pages), `/` in dev
- **Tailwind CSS v4**: Via `@tailwindcss/vite` plugin
- **React**: Via `@vitejs/plugin-react`
- **Path alias**: `@` → project root
- **HMR disabled** in AI Studio via `DISABLE_HMR=true`

## Scripts (package.json)

```json
{
  "dev": "vite --port=3000 --host=0.0.0.0",
  "build": "vite build",
  "preview": "vite preview",
  "clean": "rm -rf dist server.js",
  "lint": "tsc --noEmit"
}
```

## TypeScript Config

**tsconfig.json** (not shown, but standard React + Vite setup):
- Target: ES2020+
- Module: ESNext
- JSX: react-jsx
- Strict: true
- Path aliases matching Vite

## PWA Configuration

### Manifest (`public/manifest.json`)
```json
{
  "name": "Supermarket Price Extractor & Shopping Planner",
  "short_name": "SmartPrice",
  "display": "standalone",
  "theme_color": "#0f172a",
  "background_color": "#f8fafc",
  "icons": [/* SVG data URIs */]
}
```

### Service Worker (`public/sw.js`)
- **Cache name**: `smartprice-v1`
- **Precaches**: App shell (HTML, JS, CSS, manifest)
- **Strategy**: Cache-first for local assets, network-first for API
- **Excludes**: Gemini API requests (`googleapis.com`)
- **Offline fallback**: Returns cached `/`

### Registration (`src/main.tsx`)
```typescript
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
```

## GitHub Actions Deploy (`.github/workflows/deploy.yml`)

Standard Vite → GitHub Pages workflow:
1. Checkout
2. Setup Node
3. Install deps
4. Build (`npm run build`)
5. Deploy `dist/` to `gh-pages` branch

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | User-provided at runtime (Settings tab) |
| `NODE_ENV` | `development` / `production` |
| `DISABLE_HMR` | `true` in AI Studio to disable HMR |
| `BASE_URL` | Injected by Vite (`import.meta.env.BASE_URL`) |

## Static Assets

### `public/supermarkets.json`
Pre-seeded CustomSearchUrl templates for 5 Argentine supermarkets. Loaded on mount to seed DB if empty.

### `assets/`
Empty (`.aistudio/.gitignore` only)

## Production Checklist

- [ ] `npm run lint` passes (TypeScript type-check)
- [ ] `npm run build` succeeds
- [ ] `dist/` contains `index.html`, assets, `sw.js`, `manifest.json`
- [ ] Service worker registers in production
- [ ] PWA install prompt works
- [ ] Offline fallback loads cached shell
- [ ] Gemini API calls work (CORS allowed by Google)
- [ ] Camera permission requested on Scan tab
- [ ] localStorage persists across sessions
- [ ] GSheets sync works with valid Web App URL

## Google Sheets Web App Setup

User must deploy a Google Apps Script Web App:
1. Create Google Sheet
2. Extensions → Apps Script
3. Paste GAS code (not in repo - user provides)
4. Deploy → Web App → Execute as: Me, Access: Anyone
5. Copy URL → paste in Settings → "URL de la Web App de GAS"
6. Optional: Share Sheet ID → "ID de la Hoja de Cálculo (SSID)"

## Browser Support

- Modern browsers with:
  - `fetch` + `FileReader` + `canvas`
  - `localStorage` (5-10MB)
  - `navigator.mediaDevices.getUserMedia` (camera)
  - Service Worker (HTTPS or localhost)
  - ES2020+ (optional chaining, nullish coalescing)