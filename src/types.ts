/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  category: string;
  originalPrice: number;
  salePrice: number;
  amount: number; // e.g. 500 from "500g" or 1.5 from "1.5L"
  unit: string; // e.g. "g", "kg", "ml", "L", "units", "packs"
  supermarket: string;
  dateExtracted: string; // ISO Date String
  description?: string; // and deals like BOGO
  unitPrice: number; // calculated price per base unit (e.g., per kg, per L, per pc)
  baseUnit: string; // "kg", "L", "unit", etc.
  sourceType: "brochure" | "online" | "manual" | "receipt";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  uploadId?: string;  // Links to BroshureUpload.id for safe deletion
}

export interface ReceiptItem {
  id: string;
  name: string;
  category: string;
  price: number;
  amount: number;
  unit: string;
}

export interface Receipt {
  id: string;
  store: string;
  date: string; // YYYY-MM-DD
  items: ReceiptItem[];
  totalAmount: number;
  isScanned: boolean;
}

export interface ShoppingListItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  supermarket: string;
  price: number;
  quantity: number;
  unit: string;
  amount: number;
  unitPrice: number;
  baseUnit: string;
  checked: boolean;
  notes?: string;
}

export interface SavedList {
  id: string;
  name: string;
  date: string;
  total: number;
  items: ShoppingListItem[];
}

export interface BroshureUpload {
  id: string;
  fileName: string;
  supermarket: string;
  dateExtracted: string;
  status: "processing" | "completed" | "failed";
  itemCount: number;
  errorMessage?: string;
}

export interface CatalogSource {
  id: string;
  name: string;
  description?: string;
  websiteUrl?: string;

  // Site search (clickable link in scan tab)
  searchUrlTemplate?: string;
  aiInterpretation?: string;
  siteSearchEnabled: boolean;

  // Single search method per store
  searchMethod: "api" | "scrape" | "none";

  // API fields (when searchMethod === "api")
  apiMethod?: "GET" | "POST";
  apiUrl?: string;
  apiHeaders?: Record<string, string>;
  apiQueryParams?: Record<string, string>;
  apiBodyTemplate?: string;
  apiResponseJsonPath?: string;
  apiCorsProxyUrl?: string;
  apiDefaultCategory?: string;

  // Scrape fields (when searchMethod === "scrape")
  scrapeNotes?: string;

  // Location-specific pricing (VTEX Checkout Simulation API)
  salesChannel?: string;
  postalCode?: string;

  // Session / membership login
  sessionMethod?: "none" | "form";
  sessionLoginUrl?: string;
  sessionLoginFields?: Record<string, string>; // template e.g. {"numberId":"{dni}","name":"{name}"}
  sessionCaptchaSiteKey?: string;
  sessionId?: string;
  sessionExpiresAt?: string;
}

export interface ApiProductResult {
  shop: string;
  brand: string;
  productName: string;
  presentation: string; // e.g. "1 kg", "500 ml"
  amount: number;
  unit: string;
  price: number;
  unitPrice: number;
  baseUnit: string;
  discountsAndDeals: string;
  sourceUrl?: string;
  category?: string;
}

export interface PriceAlert {
  id: string;
  productName: string;
  productId: string; // matches Product.id, can be empty if user typed a name manually
  supermarket?: string; // optional, if the user wants a specific store
  targetPrice: number;
  currentBestPrice: number;
  active: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface StoreAnalysisResult {
  storeName: string;
  websiteUrl: string;
  methodType: "api" | "scrape" | "unsupported";
  confidence: "high" | "medium" | "low";
  apiConfig?: {
    name: string;
    description: string;
    method: "GET" | "POST";
    url: string;
    headers?: string; // JSON object string e.g. '{"Authorization":"Bearer token"}'
    queryParams?: string; // JSON object string e.g. '{"limit":"10"}'
    responseJsonPath?: string;
    corsProxyUrl?: string;
    defaultCategory?: string;
    websiteUrl?: string;
  };
  scrapeConfig?: {
    searchUrlTemplate: string;
    cssSelectors?: string;
    notes?: string;
  };
  analysis: string;
  tips: string;
}

