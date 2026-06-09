/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from "./types";

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
 * Supermercados y precios reales de Argentina para comparaciones instantáneas.
 * Esto permite probar la aplicación de inmediato con alimentos típicos argentinos en ARS.
 */
export const presetOnlineStores = [
  {
    id: "online-carrefour-arg",
    name: "Carrefour Argentina",
    isOnlineOnly: false,
    websiteUrl: "https://www.carrefour.com.ar",
    catalogItems: [
      { name: "Leche Entera Larga Vida La Serenísima 1L", category: "Dairy", price: 1450.00, amount: 1, unit: "L" },
      { name: "Yerba Mate Playadito 1kg", category: "Pantry", price: 4200.00, amount: 1, unit: "kg" },
      { name: "Arroz Largo Fino Molinos Ala 1kg", category: "Pantry", price: 1950.00, amount: 1, unit: "kg" },
      { name: "Fideos Letras Lucchetti 500g", category: "Pantry", price: 1180.00, amount: 500, unit: "g" },
      { name: "Pan Lactal Blanco Grande Bimbo 550g", category: "Bakery", price: 3200.00, amount: 550, unit: "g" },
      { name: "Aceite de Girasol Cocinero 1.5L", category: "Pantry", price: 2850.00, amount: 1.5, unit: "L" },
      { name: "Queso Cremoso La Paulina 1kg", category: "Dairy", price: 6900.00, amount: 1, unit: "kg" },
      { name: "Dulce de Leche Clásico Sancor 400g", category: "Dairy", price: 2100.00, amount: 400, unit: "g" },
      { name: "Gaseosa Coca-Cola Original 2.25L", category: "Beverages", price: 2950.00, amount: 2.25, unit: "L" },
      { name: "Asado de tira Novillo Especial 1kg", category: "Meat", price: 8900.00, amount: 1, unit: "kg" },
      { name: "Pechuga de Pollo Fresca 1kg", category: "Meat", price: 4950.00, amount: 1, unit: "kg" },
      { name: "Manzanas Rojas Deliciosas 1kg", category: "Produce", price: 1750.00, amount: 1, unit: "kg" },
      { name: "Bananas Cavendish Ecuador 1kg", category: "Produce", price: 1990.00, amount: 1, unit: "kg" },
      { name: "Jabón Líquido Ala Lavado Perfecto 3L", category: "Household", price: 9800.00, amount: 3, unit: "L" }
    ]
  },
  {
    id: "online-coto-digital-arg",
    name: "Coto Digital",
    isOnlineOnly: false,
    websiteUrl: "https://www.cotodigital3.com.ar",
    catalogItems: [
      { name: "Leche Entera Larga Vida La Serenísima 1L", category: "Dairy", price: 1390.00, amount: 1, unit: "L" },
      { name: "Yerba Mate Playadito 1kg", category: "Pantry", price: 4100.00, amount: 1, unit: "kg" },
      { name: "Arroz Largo Fino Molinos Ala 1kg", category: "Pantry", price: 1890.00, amount: 1, unit: "kg" },
      { name: "Fideos Letras Lucchetti 500g", category: "Pantry", price: 1150.00, amount: 500, unit: "g" },
      { name: "Pan Lactal Blanco Grande Bimbo 550g", category: "Bakery", price: 2990.00, amount: 550, unit: "g" },
      { name: "Aceite de Girasol Cocinero 1.5L", category: "Pantry", price: 2700.00, amount: 1.5, unit: "L" },
      { name: "Queso Cremoso La Paulina 1kg", category: "Dairy", price: 6490.00, amount: 1, unit: "kg" },
      { name: "Dulce de Leche Clásico Sancor 400g", category: "Dairy", price: 2250.00, amount: 400, unit: "g" },
      { name: "Gaseosa Coca-Cola Original 2.25L", category: "Beverages", price: 2890.00, amount: 2.25, unit: "L" },
      { name: "Asado de tira Novillo Especial 1kg", category: "Meat", price: 8490.00, amount: 1, unit: "kg" },
      { name: "Pechuga de Pollo Fresca 1kg", category: "Meat", price: 4790.00, amount: 1, unit: "kg" },
      { name: "Manzanas Rojas Deliciosas 1kg", category: "Produce", price: 1890.00, amount: 1, unit: "kg" },
      { name: "Bananas Cavendish Ecuador 1kg", category: "Produce", price: 1850.00, amount: 1, unit: "kg" },
      { name: "Jabón Líquido Ala Lavado Perfecto 3L", category: "Household", price: 9200.00, amount: 3, unit: "L" }
    ]
  },
  {
    id: "online-jumbo-arg",
    name: "Jumbo Argentina",
    isOnlineOnly: false,
    websiteUrl: "https://www.jumbo.com.ar",
    catalogItems: [
      { name: "Leche Entera Larga Vida La Serenísima 1L", category: "Dairy", price: 1490.00, amount: 1, unit: "L" },
      { name: "Yerba Mate Playadito 1kg", category: "Pantry", price: 4350.00, amount: 1, unit: "kg" },
      { name: "Arroz Largo Fino Molinos Ala 1kg", category: "Pantry", price: 2100.00, amount: 1, unit: "kg" },
      { name: "Fideos Letras Lucchetti 500g", category: "Pantry", price: 1290.00, amount: 500, unit: "g" },
      { name: "Pan Lactal Blanco Grande Bimbo 550g", category: "Bakery", price: 3400.00, amount: 550, unit: "g" },
      { name: "Aceite de Girasol Cocinero 1.5L", category: "Pantry", price: 2990.00, amount: 1.5, unit: "L" },
      { name: "Queso Cremoso La Paulina 1kg", category: "Dairy", price: 7200.00, amount: 1, unit: "kg" },
      { name: "Dulce de Leche Clásico Sancor 400g", category: "Dairy", price: 2390.00, amount: 400, unit: "g" },
      { name: "Gaseosa Coca-Cola Original 2.25L", category: "Beverages", price: 3100.00, amount: 2.25, unit: "L" },
      { name: "Asado de tira Novillo Especial 1kg", category: "Meat", price: 9200.00, amount: 1, unit: "kg" },
      { name: "Pechuga de Pollo Fresca 1kg", category: "Meat", price: 5350.00, amount: 1, unit: "kg" },
      { name: "Manzanas Rojas Deliciosas 1kg", category: "Produce", price: 1990.00, amount: 1, unit: "kg" },
      { name: "Bananas Cavendish Ecuador 1kg", category: "Produce", price: 2150.00, amount: 1, unit: "kg" },
      { name: "Jabón Líquido Ala Lavado Perfecto 3L", category: "Household", price: 9990.00, amount: 3, unit: "L" }
    ]
  }
];

/**
 * Searches for a match or similar products from online catalogs to compare with
 */
export function findSimilarOnlineProducts(productName: string, category: string) {
  const matches: Array<{
    storeName: string;
    productName: string;
    price: number;
    amount: number;
    unit: string;
    unitPrice: number;
    baseUnit: string;
  }> = [];

  const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  presetOnlineStores.forEach(store => {
    store.catalogItems.forEach(item => {
      // Check if categories match, or if any keywords align
      const itemWords = item.name.toLowerCase();
      const hasWordOverlap = words.some(word => itemWords.includes(word));
      const categoryMatch = item.category.toLowerCase() === category.toLowerCase();

      if (categoryMatch || hasWordOverlap) {
        const norm = getUnitNormalization(item.amount, item.unit);
        const unitPrice = item.price * norm.multiplier;
        matches.push({
          storeName: store.name,
          productName: item.name,
          price: item.price,
          amount: item.amount,
          unit: item.unit,
          unitPrice,
          baseUnit: norm.baseUnit
        });
      }
    });
  });

  return matches.sort((a, b) => a.unitPrice - b.unitPrice);
}
