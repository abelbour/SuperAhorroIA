/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Product } from "./types";

const DEFAULT_PROXIES = ["https://corsproxy.io/?url={url}", "https://api.allorigins.win/raw?url={url}"];

export function getPublicProxies(): string[] {
  try {
    const stored = localStorage.getItem("bp_public_proxy_urls");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_PROXIES;
}

export function setPublicProxies(urls: string[]) {
  localStorage.setItem("bp_public_proxy_urls", JSON.stringify(urls));
}

/**
 * Normalizes item units (g, kg, ml, L, etc.) to base comparison units (kg, L, unit)
 * and returns the multiplier to calculate price per base unit.
 */
export function getUnitNormalization(amount: number, unit: string): { baseUnit: string; multiplier: number } {
  const cleanUnit = (unit || "unidad").toLowerCase().trim();
  const cleanAmount = amount || 1;

  // Peso (Weight)
  if (
    cleanUnit === "g" || 
    cleanUnit === "gram" || 
    cleanUnit === "grams" || 
    cleanUnit === "gr" || 
    cleanUnit === "grs" || 
    cleanUnit === "gramos"
  ) {
    return { baseUnit: "kg", multiplier: 1000 / cleanAmount };
  }
  if (
    cleanUnit === "kg" || 
    cleanUnit === "kilogram" || 
    cleanUnit === "kilograms" || 
    cleanUnit === "kg." || 
    cleanUnit === "kilo" || 
    cleanUnit === "kilos" || 
    cleanUnit === "kilogramos"
  ) {
    return { baseUnit: "kg", multiplier: 1 / cleanAmount };
  }
  if (cleanUnit === "oz" || cleanUnit === "ounce" || cleanUnit === "ounces") {
    return { baseUnit: "kg", multiplier: 35.274 / cleanAmount };
  }
  if (cleanUnit === "lb" || cleanUnit === "pound" || cleanUnit === "pounds" || cleanUnit === "lbs") {
    return { baseUnit: "kg", multiplier: 2.20462 / cleanAmount };
  }

  // Volumen (Volume)
  if (
    cleanUnit === "ml" || 
    cleanUnit === "milliliter" || 
    cleanUnit === "milliliters" || 
    cleanUnit === "mililitros" || 
    cleanUnit === "cc"
  ) {
    return { baseUnit: "L", multiplier: 1000 / cleanAmount };
  }
  if (
    cleanUnit === "l" || 
    cleanUnit === "litre" || 
    cleanUnit === "litres" || 
    cleanUnit === "liter" || 
    cleanUnit === "liters" || 
    cleanUnit === "litro" || 
    cleanUnit === "litros" || 
    cleanUnit === "lt" || 
    cleanUnit === "lts"
  ) {
    return { baseUnit: "L", multiplier: 1 / cleanAmount };
  }
  if (cleanUnit === "fl oz" || cleanUnit === "floz" || cleanUnit === "fluid ounce") {
    return { baseUnit: "L", multiplier: 33.814 / cleanAmount };
  }
  if (cleanUnit === "gal" || cleanUnit === "gallon" || cleanUnit === "gallons") {
    return { baseUnit: "L", multiplier: 0.264172 / cleanAmount };
  }

  // Unidades / Paquetes (Counts)
  return { baseUnit: "u", multiplier: 1 / cleanAmount };
}

/**
 * Formats unit price helper
 */
export function formatUnitPrice(unitPrice: number, baseUnit: string): string {
  const displayUnit = baseUnit === "u" ? "unidad" : baseUnit;
  return `$${unitPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por ${displayUnit}`;
}

/**
 * Generates a standard CSV for Google Sheets
 */
export function parseCSV(csv: string): Omit<Product, "id" | "dateExtracted">[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const results: Omit<Product, "id" | "dateExtracted">[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

    const name = row["nombre"] || row["name"];
    if (!name) continue;

    const salePrice = parseFloat(row["precio oferta"] || row["sale price"] || row["precio"] || row["price"]) || 0;
    const originalPrice = parseFloat(row["precio original"] || row["original price"] || row["originalprice"]) || salePrice;
    const amount = parseFloat(row["cantidad"] || row["amount"] || "1") || 1;
    const unit = row["unidad"] || row["unit"] || "u";
    const norm = getUnitNormalization(amount, unit);

    results.push({
      name,
      category: row["categoria"] || row["category"] || "Other",
      supermarket: row["supermercado"] || row["supermarket"] || "Importado",
      originalPrice,
      salePrice,
      amount,
      unit,
      unitPrice: salePrice * norm.multiplier,
      baseUnit: norm.baseUnit,
    });
  }
  return results;
}

export function convertToCSV(products: Product[]): string {
  const headers = ["ID", "Nombre", "Categoria", "Supermercado", "Fecha Extraccion", "Precio", "Precio Original", "Precio Oferta", "Cantidad", "Unidad", "Precio Unitario", "Unidad Base", "Origen"];
  const rows = products.map(p => [
    p.id,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.category.replace(/"/g, '""')}"`,
    `"${p.supermarket.replace(/"/g, '""')}"`,
    p.dateExtracted,
    p.salePrice,
    p.originalPrice,
    p.salePrice,
    p.amount,
    p.unit,
    p.unitPrice.toFixed(4),
    p.baseUnit,
    p.sourceType
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}



/**
 * Cleans raw HTML for Gemini consumption:
 * - Parses with DOMParser
 * - Strips scripts, styles, nav, header, footer, aside
 * - Removes event handler attributes
 * - Extracts visible text preserving structure
 * - Filters to price-relevant lines
 * - Truncates to ~30KB
 */
export function cleanHtmlForGemini(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const removeSelectors = ["script", "style", "nav", "header", "footer", "aside", "noscript"];
    removeSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });

    doc.querySelectorAll("*").forEach(el => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        if (attrs[i].name.startsWith("on")) {
          el.removeAttribute(attrs[i].name);
        }
      }
    });

    const texts: string[] = [];
    doc.querySelectorAll("body *").forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "noscript"].includes(tag)) return;
      const text = (el as HTMLElement).innerText?.trim();
      if (!text) return;
      if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th", "span", "div", "a", "label", "strong", "b"].includes(tag)) {
        texts.push(text);
      } else if (tag === "tr") {
        texts.push("--- " + text.replace(/\n/g, " | "));
      }
    });

    let cleaned = texts.join("\n");

    const priceLines = cleaned.split("\n").filter(line => {
      const l = line.trim();
      if (!l) return false;
      if (l.length < 3) return false;
      const hasPrice = /\$\s*\d+[\d.,]*/.test(l);
      const hasNumbers = /\d+/.test(l);
      return hasPrice || hasNumbers || l.length > 20 || l.includes("$");
    });

    cleaned = priceLines.join("\n");
    if (cleaned.length > 30000) {
      cleaned = cleaned.slice(0, 30000) + "\n... [truncated]";
    }
    return cleaned;
  } catch {
    return html.slice(0, 30000);
  }
}

export function translateCategory(cat: string): string {
  const mapping: Record<string, string> = {
    "produce": "Verdulería",
    "meat": "Carnicería",
    "dairy": "Lácteos",
    "bakery": "Panadería",
    "pantry": "Almacén",
    "beverages": "Bebidas",
    "household": "Limpieza y Hogar",
    "other": "Otros"
  };
  const key = (cat || "").toLowerCase().trim();
  return mapping[key] || cat;
}
