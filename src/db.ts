/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, ShoppingListItem, BroshureUpload, CatalogSource, Receipt } from "./types";

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
  private getStorage<T>(key: string, defValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defValue;
    } catch {
      return defValue;
    }
  }

  private setStorage(key: string, value: any) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
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
    this.setStorage("bp_shopping_list", []);
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
          description: "La cadena líder en hipermercados. El buscador utiliza el parámetro standard q.",
          websiteUrl: "https://www.carrefour.com.ar",
          searchUrlTemplate: "https://www.carrefour.com.ar/search?q={producto}",
          aiInterpretation: "Buscador de Carrefour Argentina (VTEX). La URL de consulta acepta `{producto}` que se expande del término de búsqueda. Los precios mostrados en la página corresponden a la sucursal seleccionada del cliente e incluye ofertas 'Mi Carrefour'.",
          siteSearchEnabled: true,
          searchMethod: "none",
        },
        {
          id: "cat-coto",
          name: "Coto Digital",
          description: "Coto de los argentinos. Requiere parámetro Ntt para realizar búsquedas textuales de mercadería.",
          websiteUrl: "https://www.cotodigital3.com.ar",
          searchUrlTemplate: "https://www.cotodigital3.com.ar/sitios/cdigi/browse?Ntt={producto}",
          aiInterpretation: "Portal Coto Digital. El endpoint principal de búsqueda textual de productos requiere la clave Ntt. Es ideal para comparar carnes de oferta y marcas locales como Ciudad del Lago.",
          siteSearchEnabled: true,
          searchMethod: "none",
        },
        {
          id: "cat-jumbo",
          name: "Jumbo Argentina",
          description: "Supermercado premium del grupo Cencosud. Usa el parámetro ft.",
          websiteUrl: "https://www.jumbo.com.ar",
          searchUrlTemplate: "https://www.jumbo.com.ar/buscador?ft={producto}",
          aiInterpretation: "Jumbo Argentina. El motor VTEX utiliza el parámetro de búsqueda `ft`. Retorna productos de alta gama y ofertas exclusivas de Tarjeta Cencosud.",
          siteSearchEnabled: true,
          searchMethod: "none",
        },
        {
          id: "cat-dia",
          name: "Supermercados Día",
          description: "Supermercado de cercanía con marca propia económica. Usa el parámetro q.",
          websiteUrl: "https://diaonline.supermercadosdia.com.ar",
          searchUrlTemplate: "https://diaonline.supermercadosdia.com.ar/buscador?q={producto}",
          aiInterpretation: "Día Online. El buscador web utiliza el parámetro `q` para encontrar mercaderías baratas y la reconocida marca Día (papas fritas, lácteos, etc.).",
          siteSearchEnabled: true,
          searchMethod: "none",
        }
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
    return localStorage.getItem("bp_gemini_api_key") || "";
  }

  saveApiKey(key: string) {
    localStorage.setItem("bp_gemini_api_key", key || "");
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
    this.setStorage("bp_receipts", []);
  }

  // Old data cleanup (migration from previous versions)
  clearOldData() {
    localStorage.removeItem("bp_custom_search_urls");
    localStorage.removeItem("bp_api_data_sources");
    localStorage.removeItem("bp_search_urls_seeded");
  }
}

export const db = new WebLocalStorageDB();
