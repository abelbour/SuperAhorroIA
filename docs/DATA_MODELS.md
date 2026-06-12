# Data Models

## Core Types (src/types.ts)

### Product
```typescript
interface Product {
  id: string;                    // Unique identifier
  name: string;                  // Product name
  category: string;              // Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, Other
  originalPrice: number;         // List price
  salePrice: number;             // Discounted/brochure price
  amount: number;                // Quantity (e.g., 500 from "500g")
  unit: string;                  // Unit label (g, kg, ml, L, units, packs)
  supermarket: string;           // Store name
  dateExtracted: string;         // ISO date string
  description?: string;          // Deal details (BOGO, multi-buy)
  unitPrice: number;             // Normalized price per base unit
  baseUnit: string;              // "kg", "L", "unit"
  sourceType: "brochure" | "online" | "manual" | "receipt";
  startDate?: string;            // Campaign start (YYYY-MM-DD)
  endDate?: string;              // Campaign end (YYYY-MM-DD)
}
```

### Receipt & ReceiptItem
```typescript
interface ReceiptItem {
  id: string;
  name: string;
  category: string;
  price: number;
  amount: number;
  unit: string;
}

interface Receipt {
  id: string;
  store: string;
  date: string;              // YYYY-MM-DD
  items: ReceiptItem[];
  totalAmount: number;
  isScanned: boolean;        // True if from AI scan, false if manual
}
```

### ShoppingListItem
```typescript
interface ShoppingListItem {
  id: string;
  productId: string;         // Links to Product or "manual"
  name: string;
  category: string;
  supermarket: string;
  price: number;             // Total price for quantity
  quantity: number;          // Number of units to buy
  unit: string;
  amount: number;            // Size per unit
  unitPrice: number;         // Price per base unit
  baseUnit: string;
  checked: boolean;
  notes?: string;
}
```

### BroshureUpload
```typescript
interface BroshureUpload {
  id: string;
  fileName: string;
  supermarket: string;
  dateExtracted: string;
  status: "processing" | "completed" | "failed";
  itemCount: number;
  errorMessage?: string;
}
```

### CustomSearchUrl
```typescript
interface CustomSearchUrl {
  id: string;
  name: string;
  urlTemplate: string;       // e.g., "https://site.com/search?q={producto}"
  description?: string;
  aiInterpretation?: string; // AI-generated search guidance
}
```

### ApiDataSource
```typescript
interface ApiDataSource {
  id: string;
  name: string;              // e.g., "Mercado Libre Argentina"
  description?: string;
  method: "GET" | "POST";
  url: string;               // Endpoint with {producto} placeholder
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyTemplate?: string;     // JSON body for POST with {producto}
  responseJsonPath?: string; // e.g., "results" to extract item array
  corsProxyUrl?: string;     // Optional CORS proxy
  defaultCategory?: string;
  websiteUrl?: string;
  enabled: boolean;
}
```

### ApiProductResult
```typescript
interface ApiProductResult {
  shop: string;
  brand: string;
  productName: string;
  presentation: string;      // e.g., "1 kg", "500 ml"
  amount: number;
  unit: string;
  price: number;
  unitPrice: number;
  baseUnit: string;
  discountsAndDeals: string;
  sourceUrl?: string;
  category?: string;
}
```

### StoreAnalysisResult
```typescript
interface StoreAnalysisResult {
  storeName: string;
  websiteUrl: string;
  methodType: "api" | "scrape" | "unsupported";
  confidence: "high" | "medium" | "low";
  apiConfig?: {              // For methodType="api"
    name: string;
    description: string;
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    responseJsonPath?: string;
    corsProxyUrl?: string;
    defaultCategory?: string;
    websiteUrl?: string;
  };
  scrapeConfig?: {           // For methodType="scrape"
    searchUrlTemplate: string;
    cssSelectors?: string;
    notes?: string;
  };
  analysis: string;          // Spanish explanation
  tips: string;              // Spanish tips
}
```

## AI Response Types (src/gemini.ts)

### ParseResult (Brochure)
```typescript
interface ParseResult {
  supermarket: string;
  items: Array<{
    name: string;
    category: string;
    originalPrice: number;
    salePrice?: number;
    amount?: number;
    unit?: string;
    description?: string;
  }>;
}
```

### SinglePriceScanResult
```typescript
interface SinglePriceScanResult {
  productName: string;
  price: number;
  amount: number;
  unit: string;
  category: string;
  supermarket: string;
  description: string;
}
```

### ReceiptParseResult
```typescript
interface ReceiptParseResult {
  store: string;
  date: string;              // YYYY-MM-DD
  items: Array<{
    name: string;
    category: string;
    price: number;
    amount: number;
    unit: string;
  }>;
  totalAmount: number;
}
```

### ShoppingListSuggestion
```typescript
interface ShoppingListSuggestion {
  name: string;
  category: string;
  supermarket: string;
  estimatedPrice: number;
  reason: string;            // Spanish explanation
}
```

### SearchUrlInterpretation
```typescript
interface SearchUrlInterpretation {
  urlTemplate: string;
  aiExplanation: string;     // Spanish analysis of how search works
  tipsForUser: string;       // Spanish saving tips
}
```

### ApiProductResult
```typescript
interface ApiProductResult {
  shop: string;
  brand: string;
  productName: string;
  presentation: string;      // e.g., "1 kg", "500 ml"
  amount: number;
  unit: string;
  price: number;
  unitPrice: number;
  baseUnit: string;
  discountsAndDeals: string;
  sourceUrl?: string;
  category?: string;
}
```

### StoreAnalysisResult
```typescript
interface StoreAnalysisResult {
  storeName: string;
  websiteUrl: string;
  methodType: "api" | "scrape" | "unsupported";
  confidence: "high" | "medium" | "low";
  apiConfig?: { /* ApiDataSource fields */ };
  scrapeConfig?: {
    searchUrlTemplate: string;
    cssSelectors?: string;
    notes?: string;
  };
  analysis: string;
  tips: string;
}
```