# Core Features & User Flows

## Tabs (ActiveTab State)

| Tab | Key | Purpose |
|-----|-----|---------|
| Home | `home` | Dashboard with stats, quick actions |
| Upload | `upload` | Brochure PDF/image upload & AI parsing |
| Catalog | `catalog` | Searchable product database + online API search |
| Shopping | `shopping` | Shopping list builder with suggestions |
| Scan | `scan` | Camera scanning + API online price comparison |
| Receipts | `receipts` | Receipt OCR + manual entry + history |
| Settings | `settings` | API key, model, GSheets sync, custom URLs, API data sources, AI wizard |

---

## 1. Brochure Upload & Parsing (Upload Tab)

**Flow**:
1. User selects PDF/image (drag-drop or file picker)
2. Enters supermarket name (optional - AI detects)
3. Sets campaign date range (start/end)
4. Calls `parseBrochureWithGemini()` → `normalizeExtractedItems()`
5. Shows preview with editable fields
6. User approves → saves to DB as Products (sourceType="brochure")

**Key functions**: `processUpload()`, `approvePreview()`, `handleEditPreviewItem()`

---

## 2. Product Catalog (Catalog Tab)

**Features**:
- Search by name
- Filter by category, supermarket
- Sort: name, price asc/desc, unit price asc
- **Price History**: Click product → shows timeline chart across dates/stores
- **Unit Price Comparison**: Normalized to per kg / per L / per unit
- **Best Offer Detection**: `getBestAvailableOffer()` checks brochures + online presets
- **Online API Search**: Search any product across configured API data sources
  - Results displayed in a comparison table: Tienda, Marca, Producto, Presentación, Precio, Precio x Unidad, Ofertas
  - Per-row "Agregar" button to save individual products to catalog
  - "Agregar Todos al Catálogo" bulk action
  - Results are fetched via direct browser fetch (CORS-dependent) and parsed by Gemini via `parseApiResults()`

**Key functions**: `getLastPurchaseInfo()`, `getBestAvailableOffer()`, `executeApiSearch()`

---

## 3. Camera Price Scanner (Scan Tab)

**Flow**:
1. Start camera (environment-facing)
2. Capture photo → canvas → base64
3. Call `scanSinglePriceWithGemini()`
4. Shows result with "Add to Catalog" button
5. Online API comparison section: "Buscar en APIs Online" button
   - Searches the scanned product name across all enabled `ApiDataSource` sources
   - Shows results inline as a compact table
6. Saves as Product (sourceType="manual")

**Key functions**: `startCamera()`, `capturePhotoAndScan()`, `addScannedToCatalog()`, `executeApiSearch()`

---

## 4. Receipt Management (Receipts Tab)

**Scan Flow**:
1. Upload receipt image
2. `parseReceiptWithGemini()` → pre-fills edit form
3. User reviews/edits items, store, date
4. Save → creates Receipt + converts items to Products (sourceType="receipt")

**Manual Flow**:
1. "New Receipt" → empty form
2. Add items one by one
3. Save → same as above

**Key functions**: `handleReceiptScanUpload()`, `handleSaveReceipt()`, `handleAddReceiptItem()`

---

## 5. Shopping List (Shopping Tab)

**Features**:
- Add manual items
- **AI Suggestions**: `suggestShoppingListWithGemini(receipts)` → frequency + ML
- **Local Suggestions**: Frequency analysis from receipts
- Check off items
- Export to CSV

**Key functions**: `handleGenerateAISuggestions()`, `handleGenerateLocalSuggestions()`, `handleAddSuggestedToShopping()`

---

## 6. Custom Supermarket Search (Settings Tab)

- Add custom search URL templates with `{producto}` placeholder
- AI interprets unknown URLs via `interpretSearchUrlWithGemini()`
- Pre-seeded with 5 Argentine supermarkets
- Opens search in new tab from Catalog

---

## 6b. API Data Sources (Settings Tab)

- Configure REST API data sources for supermarkets/marketplaces
- Each source defines: method (GET/POST), URL with `{producto}`, headers, query params, body template, JSON path for response extraction, CORS proxy URL
- Enable/disable toggle per source
- Pre-seeded with Mercado Libre Argentina API
- Used by Catalog online search and Scan tab for real-time price comparison
- Direct browser fetch with optional CORS proxy fallback

**Storage**: `bp_api_data_sources` in localStorage

---

## 6c. AI Store Analyzer Wizard (Settings Tab)

- **"Asistente de Configuración Inteligente"** — AI-powered setup helper
- User enters: supermarket name + website URL
- Gemini analyzes the store (`analyzeStoreForApi()`) and determines:
  - **API method**: If a public REST API exists → generates full `ApiDataSource` config
  - **Scrape method**: If only search URL available → generates `CustomSearchUrl` template
  - **Unsupported**: Explains why no method is feasible
- Shows analysis with confidence level, config preview, explanation, and tips
- "Aceptar y Configurar" button auto-saves the source to the respective DB

---

## 7. Google Sheets Sync (Settings Tab)

**Bidirectional sync**:
- **Read**: Fetches products, receipts, configs from GSheets Web App
- **Write**: Pushes merged data back (debounced 1.5s after changes)
- Shareable URL with `?ssid=...&gasUrl=...` params

**Key functions**: `handleSyncGSheets()`, `triggerCloudSync()`, `handleShareGSheets()`

---

## 8. Demo Data & Reset

- `loadDemoData()`: Seeds 3-week price history for 5 products across 2 stores
- `handleClearDb()`: Wipes all localStorage data

---

## Utilities (src/utils.ts)

- `getUnitNormalization()`: Converts g/kg/ml/L/oz/lb → base kg/L/unit with multiplier
- `formatUnitPrice()`: ARS formatting (es-AR locale)
- `convertToCSV()`: Export for Google Sheets
- `translateCategory()`: English → Spanish categories
- `findSimilarOnlineProducts()`: Matches against preset catalogs (currently empty)