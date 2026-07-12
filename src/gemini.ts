/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Receipt, ApiProductResult, StoreAnalysisResult } from "./types";
import { getUnitNormalization } from "./utils";
import { db } from "./db";

async function callGemini<T>(apiKey: string, requestBody: object, noContentMessage: string): Promise<T> {
  if (!apiKey) {
    throw new Error("API Key de Gemini no configurada. Configurá tu clave en Ajustes.");
  }

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try { parsedErr = JSON.parse(errText); } catch {}
    const message = parsedErr?.error?.message || response.statusText || "Error de API desconocido";
    throw new Error(`Error de API Gemini: ${message}`);
  }

  const responseData = await response.json();
  const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error(noContentMessage);
  }

  try {
    return JSON.parse(textContent.trim()) as T;
  } catch (err: any) {
    console.error("Failed to parse Gemini output:", textContent, err);
    throw new Error("El modelo devolvió una respuesta JSON inválida. Intentá de nuevo.");
  }
}

export interface ParseResult {
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

/**
 * Converts a File object to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // Strip metadata prefix (e.g. "data:application/pdf;base64,")
      const base64 = base64String.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Normalizes values extracted from Gemini and returns complete Product objects
 */
export function normalizeExtractedItems(
  rawResult: ParseResult,
  sourceType: "brochure" | "online" | "manual" = "brochure",
  uploadId?: string
): Product[] {
  const supermarketName = rawResult.supermarket || "Supermarket";
  const dateStr = new Date().toISOString();

  return (rawResult.items || []).map((item, idx) => {
    // Basic formatting
    const name = item.name || "Producto";
    const category = item.category || "Other";
    const origPrice = Number(item.originalPrice) || 0;
    const salePrice = Number(item.salePrice) || origPrice;
    
    // Default size detection if missing
    const amount = Number(item.amount) || 1;
    const unit = (item.unit || "unit").trim();

    // Unit price calculation
    const norm = getUnitNormalization(amount, unit);
    const unitPrice = salePrice * norm.multiplier;

    return {
      id: `${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      name,
      category,
      originalPrice: origPrice,
      salePrice,
      amount,
      unit,
      supermarket: supermarketName,
      dateExtracted: dateStr,
      description: item.description || "",
      unitPrice,
      baseUnit: norm.baseUnit,
      sourceType,
      uploadId,
    };
  });
}

/**
 * Executes a direct fetch request to the Google Gemini API (client-side)
 * using the key supplied by the user. This bypasses server-side wrapper dependency.
 */
export async function parseBrochureWithGemini(
  fileBase64: string,
  mimeType: string,
  apiKey: string
): Promise<ParseResult> {
  const responseSchema = {
    type: "OBJECT",
    properties: {
      supermarket: { 
        type: "STRING", 
        description: "The name of the supermarket (e.g., Carrefour, Día, Coto, Disco, Walmart) identified in the brochure." 
      },
      items: {
        type: "ARRAY",
        description: "A list of discounted products or catalog offers found in the brochure page.",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "The full descriptive name of the product" },
            category: { 
              type: "STRING", 
              description: "The closest standard department category: Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, or Other." 
            },
            originalPrice: { type: "NUMBER", description: "List price. If not explicitly found, use the regular value or sale price." },
            salePrice: { type: "NUMBER", description: "The sales or brochure price. Must be a decimal number (e.g. 2.99)." },
            amount: { type: "NUMBER", description: "The size amount weight or count parsed from the label text (e.g. 500 from '500g', 1.5 from '1.5 Liters', 6 for '6-pack')." },
            unit: { type: "STRING", description: "Unit label lowercase (e.g. g, kg, ml, L, oz, lb, units, rolls, pcs)." },
            description: { type: "STRING", description: "Any text about the deal, such as Buy-One-Get-One, Multi-buy savings details, limit rules." }
          },
          required: ["name", "category", "originalPrice", "salePrice"]
        }
      }
    },
    required: ["supermarket", "items"]
  };

  const requestBody = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: fileBase64 } },
          { text: promptText },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  };

  return callGemini<ParseResult>(apiKey, requestBody, "El modelo Gemini no devolvió contenido procesable. Probá con un escaneo más claro.");
}

export interface SinglePriceScanResult {
  productName: string;
  price: number;
  amount: number;
  unit: string;
  category: string;
  supermarket: string;
  description: string;
}

export async function scanSinglePriceWithGemini(
  imageLowBase64: string,
  mimeType: string,
  apiKey: string
): Promise<SinglePriceScanResult> {
  if (!apiKey) {
    throw new Error("API Key de Gemini no configurada. Configurá tu clave en Ajustes.");
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      productName: { type: "STRING", description: "The product name or item name shown on the price tag or label." },
      price: { type: "NUMBER", description: "The price value structure (e.g. 3.49)." },
      amount: { type: "NUMBER", description: "The size amount weight/pack/vol (e.g. 500 from '500g', 1 from '1L'). Default is 1." },
      unit: { type: "STRING", description: "The unit label lowercase (e.g. g, kg, L, ml, oz, lb, units)." },
      category: { 
        type: "STRING", 
        description: "The department category: Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, or Other." 
      },
      supermarket: { type: "STRING", description: "The supermarket name or logo. Use 'Current Store' if none is seen." },
      description: { type: "STRING", description: "Brief details or promotions found on the tag (e.g. 'Sale price', 'Regular price')." }
    },
    required: ["productName", "price", "amount", "unit", "category", "supermarket", "description"]
  };

  const requestBody = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: imageLowBase64 } },
          { text: promptText },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  };

  return callGemini<SinglePriceScanResult>(apiKey, requestBody, "No se pudo extraer texto de la foto de la etiqueta.");
}

export interface SearchUrlInterpretation {
  urlTemplate: string;
  aiExplanation: string;
  tipsForUser: string;
}

export async function interpretSearchUrlWithGemini(
  supermarketName: string,
  userUrl: string,
  apiKey: string
): Promise<SearchUrlInterpretation> {
  if (!apiKey) {
    throw new Error("Falta la clave API de Gemini. Por favor configúrela en la pestaña de Ajustes.");
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      urlTemplate: { 
        type: "STRING", 
        description: "The formatted search URL template replacing the query term with '{producto}'. If the user URL doesn't have a query parameter, assume or construct a plausible search path structure (e.g. 'https://www.store.com.ar/buscador?q={producto}', 'https://www.store.com/catalogsearch/result/?q={producto}')." 
      },
      aiExplanation: { 
        type: "STRING", 
        description: "A professional analysis of how searching works on this supermarket site in Spanish. Explain the parameters (e.g. q, ft, Ntt, query), and what to keep in mind regarding their web layout." 
      },
      tipsForUser: { 
        type: "STRING", 
        description: "Spanish tips on how to find discounts, bulk deals, or handle shipping terms on this site (e.g. Mi Carrefour, Cencosud, Cuenta DNI, Banco Nación)." 
      }
    },
    required: ["urlTemplate", "aiExplanation", "tipsForUser"]
  };

  const promptText = `
    You are an expert e-commerce and price extraction artificial intelligence specialized in Argentine Supermarkets.
    The user entered the following supermarket details:
    - Supermarket Name: "${supermarketName}"
    - Provided URL: "${userUrl}"

    Analyze the URL. Deduce or construct the optimal search query URL template that replaces the query word with the token "{producto}".
    Write your analysis and suggestions entirely in Spanish, matching the typical Argentine grocery environment.
  `;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  };

  return callGemini<SearchUrlInterpretation>(apiKey, requestBody, "No se recibió respuesta del modelo Gemini al interpretar la URL.");
}

export interface ReceiptParseResult {
  store: string;
  date: string; // YYYY-MM-DD
  items: Array<{
    name: string;
    category: string;
    price: number;
    amount: number;
    unit: string;
  }>;
  totalAmount: number;
}

export async function parseReceiptWithGemini(
  imageLowBase64: string,
  mimeType: string,
  apiKey: string
): Promise<ReceiptParseResult> {
  if (!apiKey) {
    throw new Error("API Key de Gemini no configurada. Configurá tu clave en Ajustes.");
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      store: { type: "STRING", description: "The name of the store or supermarket where the purchase was made (e.g. Carrefour, Coto, DIA). If not visible or found, return an empty string." },
      date: { type: "STRING", description: "The purchase date formatted as YYYY-MM-DD. If not visible or found, return an empty string." },
      items: {
        type: "ARRAY",
        description: "The list of purchased items from the receipt, including their name, price, amount (weight, liters, unit count), and category.",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Name of the product/item purchased, cleaned up for human readability." },
            category: { type: "STRING", description: "Standard category: Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, or Other." },
            price: { type: "NUMBER", description: "The item price as a float (e.g., 299.99)." },
            amount: { type: "NUMBER", description: "Size amount extracted (e.g. 500 from '500g', 1.5 from '1.5 Liters'). Default to 1 if not specified." },
            unit: { type: "STRING", description: "Unit of the size (e.g., g, kg, ml, L, units). Default to 'units'." }
          },
          required: ["name", "category", "price", "amount", "unit"]
        }
      },
      totalAmount: { type: "NUMBER", description: "The final total amount of the transaction. If not found, sum the prices in the items list." }
    },
    required: ["store", "date", "items", "totalAmount"]
  };

  const requestBody = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: imageLowBase64 } },
          { text: promptText },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  };

  return callGemini<ReceiptParseResult>(apiKey, requestBody, "No se pudo extraer texto de la foto del ticket.");
}

export interface ShoppingListSuggestion {
  name: string;
  category: string;
  supermarket: string;
  estimatedPrice: number;
  reason: string;
}

export async function suggestShoppingListWithGemini(
  receipts: Receipt[],
  apiKey: string
): Promise<ShoppingListSuggestion[]> {
  if (!apiKey) {
    throw new Error("API Key de Gemini no configurada. Configurá tu clave en Ajustes.");
  }

  const responseSchema = {
    type: "ARRAY",
    description: "A list of food and household item suggestions representing the next logical shopping list derived from historical receipts.",
    items: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Standard, clean name of the product/item suggested." },
        category: { type: "STRING", description: "Plausible department: Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, or Other." },
        supermarket: { type: "STRING", description: "The supermarket name where it was bought in history, or standard recommended store." },
        estimatedPrice: { type: "NUMBER", description: "The estimated unit price from past receipts." },
        reason: { type: "STRING", description: "Friendly brief explanation in Spanish of why it's suggested (e.g. 'Comprado frecuentemente', 'Hace 15 días no lo compras')." }
      },
      required: ["name", "category", "supermarket", "estimatedPrice", "reason"]
    }
  };

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.3,
    },
  };

  return callGemini<ShoppingListSuggestion[]>(apiKey, requestBody, "No se recibió respuesta del recomendador inteligente.");
}

export async function parseApiResults(
  rawResponses: { sourceName: string; rawData: any }[],
  query: string,
  apiKey: string
): Promise<ApiProductResult[]> {
  if (!apiKey) {
    throw new Error("API Key de Gemini no configurada. Configurá tu clave en Ajustes.");
  }

  if (rawResponses.length === 0) {
    return [];
  }

  const responseSchema = {
    type: "ARRAY",
    description: "Extracted product listings from multiple supermarket/marketplace API responses.",
    items: {
      type: "OBJECT",
      properties: {
        shop: { type: "STRING", description: "The store or marketplace name (e.g. Mercado Libre, Carrefour)." },
        brand: { type: "STRING", description: "The brand of the product (e.g. Arroz Gallo, Molinos Ala). Use empty string if unknown." },
        productName: { type: "STRING", description: "Clean product name without size/presentation (e.g. Arroz Largo Fino)." },
        presentation: { type: "STRING", description: "Human-readable size description (e.g. '1 kg', '500 ml', '6-pack')." },
        amount: { type: "NUMBER", description: "Numeric amount value (e.g. 1 from '1 kg', 500 from '500 ml')." },
        unit: { type: "STRING", description: "Unit label (e.g. g, kg, ml, L, units)." },
        price: { type: "NUMBER", description: "The price of the product in the local currency." },
        unitPrice: { type: "NUMBER", description: "Price normalized per base unit (e.g. per kg, per L, per unit). Calculate this yourself." },
        baseUnit: { type: "STRING", description: "Base unit for normalization (kg, L, unit)." },
        discountsAndDeals: { type: "STRING", description: "Any discounts, promotions or deals (e.g. '15% OFF', '2x1', 'Envío gratis'). Use empty string if none." },
        sourceUrl: { type: "STRING", description: "Direct URL to the product page if available in the API response." },
        category: { type: "STRING", description: "Category: Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, or Other." }
      },
      required: ["shop", "brand", "productName", "presentation", "amount", "unit", "price", "unitPrice", "baseUnit"]
    }
  };

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  };

  try {
    return await callGemini<ApiProductResult[]>(apiKey, requestBody, "");
  } catch (err) {
    console.error("parseApiResults failed:", err);
    return [];
  }
}

export async function parseScrapedResults(
  htmlInputs: { sourceName: string; cleanedHtml: string; searchUrl: string }[],
  query: string,
  apiKey: string
): Promise<ApiProductResult[]> {
  if (!apiKey) {
    throw new Error("API Key de Gemini no configurada. Configurá tu clave en Ajustes.");
  }

  if (htmlInputs.length === 0) return [];

  const responseSchema = {
    type: "ARRAY",
    description: "Extracted product listings from scraped supermarket HTML search results.",
    items: {
      type: "OBJECT",
      properties: {
        shop: { type: "STRING", description: "The store or marketplace name (e.g. Carrefour, Coto)." },
        brand: { type: "STRING", description: "The brand of the product (e.g. Arroz Gallo, Molinos Ala). Use empty string if unknown." },
        productName: { type: "STRING", description: "Clean product name without size/presentation (e.g. Arroz Largo Fino)." },
        presentation: { type: "STRING", description: "Human-readable size description (e.g. '1 kg', '500 ml', '6-pack')." },
        amount: { type: "NUMBER", description: "Numeric amount value (e.g. 1 from '1 kg', 500 from '500 ml')." },
        unit: { type: "STRING", description: "Unit label (e.g. g, kg, ml, L, units)." },
        price: { type: "NUMBER", description: "The price of the product in ARS ($)." },
        unitPrice: { type: "NUMBER", description: "Price normalized per base unit (e.g. per kg, per L, per unit). Calculate this yourself." },
        baseUnit: { type: "STRING", description: "Base unit for normalization (kg, L, unit)." },
        discountsAndDeals: { type: "STRING", description: "Any discounts, promotions or deals (e.g. '15% OFF', '2x1', 'Envío gratis'). Use empty string if none." },
        sourceUrl: { type: "STRING", description: "The search URL where this product was found." },
        category: { type: "STRING", description: "Category: Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, or Other." }
      },
      required: ["shop", "brand", "productName", "presentation", "amount", "unit", "price", "unitPrice", "baseUnit"]
    }
  };

  const inputsJson = JSON.stringify(htmlInputs.map(h => ({
    source: h.sourceName,
    html: h.cleanedHtml,
    searchUrl: h.searchUrl,
  })), null, 2);

  const promptText = `
    You are an expert price comparison data extractor for Argentine supermarkets.
    Below are cleaned HTML search results from supermarket websites for the product "${query}".
    The HTML has been stripped of scripts, styles, and navigation.
    Extract ALL product listings you can find. Prices are in Argentine Pesos (ARS, $).
    Normalize prices, detect amounts/units, and calculate unit prices.
    Return the data as a JSON array of standardized product objects.
    If no products are found, return an empty array.

    Scraped Data:
    ${inputsJson}
  `;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  };

  try {
    return await callGemini<ApiProductResult[]>(apiKey, requestBody, "");
  } catch (err) {
    console.error("parseScrapedResults failed:", err);
    return [];
  }
}

export async function analyzeStoreForApi(
  storeName: string,
  storeUrl: string,
  apiKey: string
): Promise<StoreAnalysisResult> {
  if (!apiKey) {
    throw new Error("API Key de Gemini no configurada. Configurá tu clave en Ajustes.");
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      storeName: { type: "STRING", description: "The supermarket or store name provided by the user." },
      websiteUrl: { type: "STRING", description: "The website URL of the store." },
      methodType: {
        type: "STRING",
        description: "The recommended method: 'api' if a public REST API is available, 'scrape' if search URL scraping is needed, 'unsupported' if neither is feasible."
      },
      confidence: {
        type: "STRING",
        description: "How confident you are in this assessment: 'high', 'medium', or 'low'."
      },
      apiConfig: {
        type: "OBJECT",
        description: "Configuration for API-based price fetching. Only include if methodType is 'api'.",
        properties: {
          name: { type: "STRING", description: "Suggested name for this API data source." },
          description: { type: "STRING", description: "Short description of what this API provides." },
          method: { type: "STRING", description: "HTTP method: GET or POST." },
          url: { type: "STRING", description: "The API endpoint URL with {producto} placeholder for the search query." },
          headers: {
            type: "STRING",
            description: "Optional HTTP headers as a JSON object string. Example: '{\"Authorization\":\"Bearer token\"}'"
          },
          queryParams: {
            type: "STRING",
            description: "Optional query parameters as a JSON object string. Example: '{\"limit\":\"10\",\"sort\":\"price_asc\"}'"
          },
          responseJsonPath: { type: "STRING", description: "JSON path to the array of product results (e.g. 'results', 'data.items', 'products')." },
          corsProxyUrl: { type: "STRING", description: "If the API doesn't support CORS, suggest a CORS proxy URL pattern with {url} placeholder." },
          defaultCategory: { type: "STRING", description: "Default product category: Produce, Meat, Dairy, Bakery, Pantry, Beverages, Household, or Other." },
          websiteUrl: { type: "STRING", description: "The store's main website URL." }
        },
        required: ["name", "description", "method", "url"]
      },
      scrapeConfig: {
        type: "OBJECT",
        description: "Configuration for URL-based search scraping. Only include if methodType is 'scrape'.",
        properties: {
          searchUrlTemplate: { type: "STRING", description: "The search URL with {producto} placeholder (e.g. 'https://www.store.com.ar/buscar?q={producto}')." },
          cssSelectors: { type: "STRING", description: "CSS selectors for extracting product info from search results HTML, if known. Format: 'productContainer: .product-card, name: .title a, price: .price, brand: .brand, presentation: .size'." },
          notes: { type: "STRING", description: "Any important notes about scraping this site (e.g. JavaScript rendering required, rate limits, special parameters)." }
        },
        required: ["searchUrlTemplate"]
      },
      analysis: { type: "STRING", description: "Professional analysis in Spanish explaining the recommended approach for this store." },
      tips: { type: "STRING", description: "Practical tips in Spanish for getting the best results from this store's data source." }
    },
    required: ["storeName", "websiteUrl", "methodType", "confidence", "analysis", "tips"]
  };

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  };

  return callGemini<StoreAnalysisResult>(apiKey, requestBody, "No se recibió respuesta del análisis de la tienda.");
}

