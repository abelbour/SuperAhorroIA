/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, ShoppingListItem, BroshureUpload, CustomSearchUrl, Receipt } from "./types";

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

  getCustomSearchUrls(): CustomSearchUrl[] {
    const list = this.getStorage<CustomSearchUrl[]>("bp_custom_search_urls", []);
    if (list.length === 0) {
      // Pre-seed common Argentina Supermarkets
      const defaultPresets: CustomSearchUrl[] = [
        {
          id: "url-carrefour",
          name: "Carrefour Argentina",
          urlTemplate: "https://www.carrefour.com.ar/catalogsearch/result/?q={producto}",
          description: "La cadena líder en hipermercados. El buscador utiliza el parámetro standard q.",
          aiInterpretation: "Buscador de Carrefour Argentina. La URL de consulta acepta `{producto}` que se expande del término de búsqueda. Los precios mostrados en la página corresponden a la sucursal seleccionada del cliente e incluye ofertas 'Mi Carrefour'."
        },
        {
          id: "url-coto",
          name: "Coto Digital",
          urlTemplate: "https://www.cotodigital3.com.ar/sitios/cdigi/browse?Ntt={producto}",
          description: "Coto de los argentinos. Requiere parámetro Ntt para realizar búsquedas textuales de mercadería.",
          aiInterpretation: "Portal Coto Digital. El endpoint principal de búsqueda textual de productos requiere la clave Ntt. Es ideal para comparar carnes de oferta y marcas locales como Ciudad del Lago."
        },
        {
          id: "url-jumbo",
          name: "Jumbo Argentina",
          urlTemplate: "https://www.jumbo.com.ar/buscador?ft={producto}",
          description: "Supermercado premium del grupo Cencosud. Usa el parámetro ft.",
          aiInterpretation: "Jumbo Argentina. El motor VTEX utiliza el parámetro de búsqueda `ft`. Retorna productos de alta gama y ofertas exclusivas de Tarjeta Cencosud."
        },
        {
          id: "url-dia",
          name: "Supermercados Día",
          urlTemplate: "https://diaonline.supermercadosdia.com.ar/buscador?q={producto}",
          description: "Supermercado de cercanía con marca propia económica. Usa el parámetro q.",
          aiInterpretation: "Día Online. El buscador web utiliza el parámetro `q` para encontrar mercaderías baratas y la reconocida marca Día (papas fritas, lácteos, etc.)."
        }
      ];
      this.setStorage("bp_custom_search_urls", defaultPresets);
      return defaultPresets;
    }
    return list;
  }

  saveCustomSearchUrl(urlItem: CustomSearchUrl) {
    const urls = this.getCustomSearchUrls();
    const idx = urls.findIndex((u) => u.id === urlItem.id);
    if (idx >= 0) urls[idx] = urlItem;
    else urls.push(urlItem);
    this.setStorage("bp_custom_search_urls", urls);
  }

  deleteCustomSearchUrl(id: string) {
    const urls = this.getCustomSearchUrls().filter((u) => u.id !== id);
    this.setStorage("bp_custom_search_urls", urls);
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
}

export const db = new WebLocalStorageDB();
