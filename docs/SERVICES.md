# AI Services (Gemini Integration)

## Overview

All AI functionality uses **Google Gemini API** directly from the browser via `fetch()`. No backend proxy. Uses structured JSON output with `responseSchema` for reliable parsing.

**Location**: `src/gemini.ts`

## API Configuration

```typescript
const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
```

- **Model selection**: User-configurable via Settings (stored in localStorage)
- **Default**: `gemini-2.5-flash-lite` (fast, cost-effective)
- **Temperature**: Low (0.1-0.3) for deterministic structured output

## Core Functions

### 1. `parseBrochureWithGemini(base64, mimeType, apiKey)`
Extracts products from supermarket brochure PDFs/images.

**Prompt strategy**:
- Expert price intelligence agent persona
- Handles "2 for $5" → calculates unit price, notes deal in description
- Strict decimal precision
- Defaults: amount=1, unit="units" if missing

**Response schema**: `ParseResult` with supermarket + items array

### 2. `scanSinglePriceWithGemini(base64, mimeType, apiKey)`
Scans single price tag/label from camera or uploaded image.

**Prompt strategy**:
- Price tag recognition system
- Extracts: product name, price, size, unit, category, store
- Defaults store to "Current Store" if not visible

**Response schema**: `SinglePriceScanResult`

### 3. `parseReceiptWithGemini(base64, mimeType, apiKey)`
OCR for checkout receipts.

**Prompt strategy**:
- Expert receipt OCR system
- Extracts: store, date (YYYY-MM-DD, defaults to 2026), items with prices/sizes, total
- Cleans product names for Spanish readability

**Response schema**: `ReceiptParseResult`

### 4. `interpretSearchUrlWithGemini(supermarketName, userUrl, apiKey)`
Converts a supermarket homepage URL into a search template.

**Prompt strategy**:
- Argentine supermarket specialist
- Outputs: urlTemplate with `{producto}`, Spanish explanation, shopping tips
- Knows major chains: Carrefour, Coto, Jumbo, Día, ChangoMas

**Response schema**: `SearchUrlInterpretation`

### 5. `suggestShoppingListWithGemini(receipts, apiKey)`
Generates shopping suggestions from purchase history.

**Prompt strategy**:
- Argentine shopping advisor persona
- Analyzes receipt history JSON
- Outputs 5-10 suggestions with Spanish reasons
- Temperature 0.3 for variety

**Response schema**: `ShoppingListSuggestion[]`

### 6. `parseApiResults(rawResponses, query, apiKey)`
Parses raw API responses from multiple supermarket data sources.

**Prompt strategy**:
- Expert price comparison data extractor
- Auto-detects response structure from each source
- Extracts all product listings, normalizes prices, identifies deals
- Returns standardized `ApiProductResult[]`

**Response schema**: Array of `ApiProductResult` (shop, brand, productName, presentation, price, unitPrice, discountsAndDeals)

### 7. `analyzeStoreForApi(storeName, storeUrl, apiKey)`
AI-powered store analysis wizard — determines the best method to get prices.

**Prompt strategy**:
- Expert at analyzing supermarket/e-commerce tech stacks
- Knows VTEX public API (`/api/catalog_system/pub/products/search`), Mercado Libre API, custom APIs
- Determines: public API available → scrape via search URL → unsupported
- Generates a ready-to-use `ApiDataSource` or `CustomSearchUrl` config

**Response schema**: `StoreAnalysisResult` with methodType, confidence, full apiConfig/scrapeConfig, analysis, tips

## Error Handling

All functions:
- Validate API key presence
- Check HTTP response status
- Parse JSON response with try/catch
- Throw descriptive errors for UI display

## Model Management

```typescript
// In App.tsx - refreshGeminiModels()
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
  .filter(m => m.name?.toLowerCase().includes("gemini"))
```

Stored in localStorage (`bp_discovered_models`), user selects in Settings.