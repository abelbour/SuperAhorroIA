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

export interface PriceHistoryRecord {
  id: string;
  productName: string;
  supermarket: string;
  price: number;
  unitPrice: number;
  date: string;
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

export interface OnlineStore {
  id: string;
  name: string;
  isOnlineOnly: boolean;
  websiteUrl?: string;
  catalogItems: Array<{
    name: string;
    category: string;
    price: number;
    amount: number;
    unit: string;
  }>;
}

export interface CustomSearchUrl {
  id: string;
  name: string;
  urlTemplate: string; // e.g. "https://www.carrefour.com.ar/catalogsearch/result/?q={producto}"
  description?: string;
  aiInterpretation?: string; // AI generated step-by-step instructions or CSS selectors to parse/search the site
}

