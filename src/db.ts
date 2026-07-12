/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, ShoppingListItem, SavedList, BroshureUpload, CatalogSource, Receipt, PriceAlert } from "./types";

const DB_NAME = "brochure_planner_db";
const DB_VERSION = 1;

interface AppData {
  products: Product[];
  shoppingList: ShoppingListItem[];
  uploads: BroshureUpload[];
  apiKey: string;
}

// Fallback memory state + localStorage helper
class WebLocalStorageDB {
  private cache = new Map<string, any>();

  private getStorage<T>(key: string, defValue: T): T {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    try {
      const data = localStorage.getItem(key);
      const parsed = data ? JSON.parse(data) : defValue;
      this.cache.set(key, parsed);
      return parsed;
    } catch {
      return defValue;
    }
  }

  private setStorage(key: string, value: any) {
    this.cache.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e: any) {
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        const size = new Blob([JSON.stringify(value)]).size;
        const msg = `El almacenamiento local está lleno. No se pudieron guardar ${(size / 1024).toFixed(0)}KB de datos. Exportá tus datos y liberá espacio.`;
        console.error(msg);
        throw new Error(msg);
      }
      console.error("LocalStorage save failed", e);
    }
  }

  getProducts(): Product[] {
    return this.getStorage<Product[]>("bp_products", []);
  }

  saveProduct(product: Product) {
    const products = this.getProducts();
    const idx = products.findIndex((p) => p.id === product.id);
    if (idx >= 0) products[idx] = product;
    else products.push(product);
    this.setStorage("bp_products", products);
  }

  deleteProduct(id: string) {
    const products = this.getProducts().filter((p) => p.id !== id);
    this.setStorage("bp_products", products);
  }

  saveProducts(newProducts: Product[]) {
    const products = this.getProducts();
    const merged = [...products];
    newProducts.forEach((p) => {
      const idx = merged.findIndex((m) => m.id === p.id);
      if (idx >= 0) merged[idx] = p;
      else merged.push(p);
    });
    this.setStorage("bp_products", merged);
  }

  clearAllProducts() {
    this.cache.delete("bp_products");
    this.setStorage("bp_products", []);
  }

  getShoppingList(): ShoppingListItem[] {
    return this.getStorage<ShoppingListItem[]>("bp_shopping_list", []);
  }

  saveShoppingListItem(item: ShoppingListItem) {
    const list = this.getShoppingList();
    const idx = list.findIndex((l) => l.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    this.setStorage("bp_shopping_list", list);
  }

  deleteShoppingListItem(id: string) {
    const list = this.getShoppingList().filter((l) => l.id !== id);
    this.setStorage("bp_shopping_list", list);
  }

  clearShoppingList() {
    this.cache.delete("bp_shopping_list");
    this.setStorage("bp_shopping_list", []);
  }

  saveShoppingList(list: ShoppingListItem[]) {
    this.setStorage("bp_shopping_list", list);
  }

  getSavedLists(): SavedList[] {
    return this.getStorage<SavedList[]>("bp_saved_lists", []);
  }

  saveSavedList(list: SavedList) {
    const lists = this.getSavedLists();
    const idx = lists.findIndex(l => l.id === list.id);
    if (idx >= 0) lists[idx] = list;
    else lists.unshift(list);
    this.setStorage("bp_saved_lists", lists);
  }

  deleteSavedList(id: string) {
    const lists = this.getSavedLists().filter(l => l.id !== id);
    this.setStorage("bp_saved_lists", lists);
  }

  getUploads(): BroshureUpload[] {
    return this.getStorage<BroshureUpload[]>("bp_uploads", []);
  }

  saveUpload(upload: BroshureUpload) {
    const uploads = this.getUploads();
    const idx = uploads.findIndex((u) => u.id === upload.id);
    if (idx >= 0) uploads[idx] = upload;
    else uploads.push(upload);
    this.setStorage("bp_uploads", uploads);
  }

  deleteUpload(id: string) {
    const uploads = this.getUploads().filter((u) => u.id !== id);
    this.setStorage("bp_uploads", uploads);
  }

  getCatalogSources(): CatalogSource[] {
    const seeded = localStorage.getItem("bp_catalog_sources_seeded");
    let list = this.getStorage<CatalogSource[]>("bp_catalog_sources", []);

    if (!seeded && list.length === 0) {
      const defaultPresets: CatalogSource[] = [
        {
          id: "cat-ml-argentina",
          name: "Mercado Libre Argentina",
          description: "API oficial de Mercado Libre para búsqueda de productos. No requiere API key para búsquedas públicas.",
          websiteUrl: "https://www.mercadolibre.com.ar",
          searchUrlTemplate: "https://www.mercadolibre.com.ar/search?q={producto}",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://api.mercadolibre.com/sites/MLA/search?q={producto}",
          apiQueryParams: { limit: "10" },
          apiResponseJsonPath: "results",
          apiDefaultCategory: "Other",
        },
        {
          id: "cat-carrefour",
          name: "Carrefour Argentina",
          description: "VTEX — hipermercados. Precios con parámetro _from/_to.",
          websiteUrl: "https://www.carrefour.com.ar",
          searchUrlTemplate: "https://www.carrefour.com.ar/search?q={producto}",
          aiInterpretation: "Carrefour Argentina (VTEX, carrefourar). API pública sin auth. SalesChannel=1.",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://www.carrefour.com.ar/api/catalog_system/pub/products/search?q={producto}&_from=1&_to=50",
          apiDefaultCategory: "Other",
          salesChannel: "1",
        },
        {
          id: "cat-coto",
          name: "Coto Digital",
          description: "Coto de los argentinos. Requiere parámetro Ntt para búsquedas.",
          websiteUrl: "https://www.cotodigital3.com.ar",
          searchUrlTemplate: "https://www.cotodigital3.com.ar/sitios/cdigi/browse?Ntt={producto}",
          aiInterpretation: "Portal Coto Digital. El endpoint principal de búsqueda textual de productos requiere la clave Ntt.",
          siteSearchEnabled: true,
          searchMethod: "none",
        },
        {
          id: "cat-jumbo",
          name: "Jumbo Argentina",
          description: "VTEX — premium del grupo Cencosud. SalesChannel=32.",
          websiteUrl: "https://www.jumbo.com.ar",
          searchUrlTemplate: "https://www.jumbo.com.ar/buscador?ft={producto}",
          aiInterpretation: "Jumbo Argentina (VTEX, jumboargentinaio). SC=32. API pública sin auth.",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://www.jumbo.com.ar/api/catalog_system/pub/products/search?q={producto}&_from=1&_to=50",
          apiDefaultCategory: "Other",
          salesChannel: "32",
        },
        {
          id: "cat-dia",
          name: "Supermercados Día",
          description: "VTEX — cercanía con marca propia. SalesChannel=1.",
          websiteUrl: "https://diaonline.supermercadosdia.com.ar",
          searchUrlTemplate: "https://diaonline.supermercadosdia.com.ar/buscador?q={producto}",
          aiInterpretation: "Día Online (VTEX, diaio). API pública sin auth. SC=1.",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search?q={producto}&_from=1&_to=50",
          apiDefaultCategory: "Other",
          salesChannel: "1",
        },
        {
          id: "cat-vea",
          name: "Vea Argentina",
          description: "VTEX — del grupo Cencosud. SalesChannel=34.",
          websiteUrl: "https://www.vea.com.ar",
          searchUrlTemplate: "https://www.vea.com.ar/search?q={producto}",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://www.vea.com.ar/api/catalog_system/pub/products/search?q={producto}&_from=1&_to=50",
          apiDefaultCategory: "Other",
          salesChannel: "34",
        },
        {
          id: "cat-disco",
          name: "Disco Argentina",
          description: "VTEX — del grupo Cencosud. SalesChannel=33.",
          websiteUrl: "https://www.disco.com.ar",
          searchUrlTemplate: "https://www.disco.com.ar/search?q={producto}",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://www.disco.com.ar/api/catalog_system/pub/products/search?q={producto}&_from=1&_to=50",
          apiDefaultCategory: "Other",
          salesChannel: "33",
        },
        {
          id: "cat-masonline",
          name: "Mas Online",
          description: "VTEX — del grupo GDN (ex Walmart). SalesChannel=1.",
          websiteUrl: "https://www.masonline.com.ar",
          searchUrlTemplate: "https://www.masonline.com.ar/search?q={producto}",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://www.masonline.com.ar/api/catalog_system/pub/products/search?q={producto}&_from=1&_to=50",
          apiDefaultCategory: "Other",
          salesChannel: "1",
        },
        {
          id: "cat-preciosclaros",
          name: "Precios Claros (Gob. ARS)",
          description: "Base de datos oficial de precios de supermercados del gobierno argentino. API pública sin auth.",
          websiteUrl: "https://preciosclaros.gob.ar",
          searchUrlTemplate: "https://preciosclaros.gob.ar/Home/Resultados?busqueda={producto}",
          siteSearchEnabled: true,
          searchMethod: "api",
          apiMethod: "GET",
          apiUrl: "https://preciosclaros.gob.ar/webservice/precios/producto/buscar?busqueda={producto}",
          apiDefaultCategory: "Other",
        },
      ];
      this.setStorage("bp_catalog_sources", defaultPresets);
      localStorage.setItem("bp_catalog_sources_seeded", "true");
      return defaultPresets;
    }

    return list;
  }

  saveCatalogSource(source: CatalogSource) {
    const sources = this.getCatalogSources();
    const idx = sources.findIndex((s) => s.id === source.id);
    if (idx >= 0) sources[idx] = source;
    else sources.push(source);
    this.setStorage("bp_catalog_sources", sources);
  }

  deleteCatalogSource(id: string) {
    const sources = this.getCatalogSources().filter((s) => s.id !== id);
    this.setStorage("bp_catalog_sources", sources);
  }

  getApiKey(): string {
    const stored = localStorage.getItem("bp_gemini_api_key") || "";
    if (!stored) return "";
    try { return atob(stored); } catch { return stored; }
  }

  saveApiKey(key: string) {
    const encoded = key ? btoa(key) : "";
    localStorage.setItem("bp_gemini_api_key", encoded);
  }

  getSelectedModel(): string {
    return localStorage.getItem("bp_gemini_selected_model") || "gemini-2.5-flash-lite";
  }

  saveSelectedModel(model: string) {
    localStorage.setItem("bp_gemini_selected_model", model || "gemini-2.5-flash-lite");
  }

  getDiscoveredModels(): Array<{name: string, displayName: string}> {
    return this.getStorage<Array<{name: string, displayName: string}>>("bp_discovered_models", [
      { name: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite (Rápido, recomendado)" },
      { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash (Estándar)" },
      { name: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash (Legacy)" },
      { name: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro (Avanzado)" }
    ]);
  }

  saveDiscoveredModels(models: Array<{name: string, displayName: string}>) {
    this.setStorage("bp_discovered_models", models);
  }

  getReceipts(): Receipt[] {
    return this.getStorage<Receipt[]>("bp_receipts", []);
  }

  saveReceipt(receipt: Receipt) {
    const receipts = this.getReceipts();
    const idx = receipts.findIndex((r) => r.id === receipt.id);
    if (idx >= 0) receipts[idx] = receipt;
    else receipts.push(receipt);
    this.setStorage("bp_receipts", receipts);
  }

  deleteReceipt(id: string) {
    const receipts = this.getReceipts().filter((r) => r.id !== id);
    this.setStorage("bp_receipts", receipts);
  }

  clearReceipts() {
    this.cache.delete("bp_receipts");
    this.setStorage("bp_receipts", []);
  }

  getAlerts(): PriceAlert[] {
    return this.getStorage<PriceAlert[]>("bp_price_alerts", []);
  }

  saveAlert(alert: PriceAlert) {
    const alerts = this.getAlerts();
    const idx = alerts.findIndex(a => a.id === alert.id);
    if (idx >= 0) alerts[idx] = alert;
    else alerts.push(alert);
    this.setStorage("bp_price_alerts", alerts);
  }

  deleteAlert(id: string) {
    this.setStorage("bp_price_alerts", this.getAlerts().filter(a => a.id !== id));
  }

  clearAlerts() {
    this.cache.delete("bp_price_alerts");
    this.setStorage("bp_price_alerts", []);
  }

  clearUploads() {
    this.cache.delete("bp_uploads");
    this.setStorage("bp_uploads", []);
  }

  clearSavedLists() {
    this.cache.delete("bp_saved_lists");
    this.setStorage("bp_saved_lists", []);
  }

  clearCatalogSources() {
    this.cache.delete("bp_catalog_sources");
    this.setStorage("bp_catalog_sources", []);
  }

  getAllKeys(): string[] {
    return Object.keys(localStorage).filter(k => k.startsWith("bp_")).sort();
  }

  getFreshnessDays(): number {
    const v = localStorage.getItem("bp_freshness_days");
    return v ? parseInt(v, 10) : 15;
  }

  saveFreshnessDays(days: number) {
    localStorage.setItem("bp_freshness_days", String(Math.max(1, days)));
  }

  getShowActiveOnly(): boolean {
    return localStorage.getItem("bp_show_active_only") !== "false";
  }

  saveShowActiveOnly(val: boolean) {
    localStorage.setItem("bp_show_active_only", String(val));
  }

  // Old data cleanup (migration from previous versions)
  clearOldData() {
    this.cache.clear();
    localStorage.removeItem("bp_custom_search_urls");
    localStorage.removeItem("bp_api_data_sources");
    localStorage.removeItem("bp_search_urls_seeded");
  }
}

export const db = new WebLocalStorageDB();
