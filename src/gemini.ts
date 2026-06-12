/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Receipt, ApiProductResult, StoreAnalysisResult } from "./types";
import { getUnitNormalization } from "./utils";
import { db } from "./db";

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
  sourceType: "brochure" | "online" | "manual" = "brochure"
): Product[] {
  const supermarketName = rawResult.supermarket || "Supermarket";
  const dateStr = new Date().toISOString();

  return (rawResult.items || []).map((item, idx) => {
    // Basic formatting
    const name = item.name || "Unknown Product";
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
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Please configure your key in settings.");
  }

  // Define structured schema for response
  const responseSchema = {
    type: "OBJECT",
    properties: {
      supermarket: { 
        type: "STRING", 
        description: "The name of the supermarket (e.g., Walmart, Aldi, Safeway, Tesco, Carrefour) identified in the brochure." 
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `
    You are an expert price intelligence agent.
    Analyze this supermarket flyer brochure, advertisement flyer, or catalog pages (PDF or image) and extract ALL available products and items with their listing details, current discounts or special pricing, amounts (sizes, weights) and units.
    Ensure to recognize numerical prices clearly. If something is listed as "2 for $5", calculate the price for one ($2.5) but mention "2 for $5" in the description.
    Double check decimal prices to ensure precision (e.g. do not parse $1.99 as $199).
    If no volume or amount is listed, assume amount is 1 and unit is 'units'.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1, // low temp for higher structural stability
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch {
      // ignore
    }
    const message = parsedErr?.error?.message || response.statusText || "Unknown API Error";
    throw new Error(`Gemini API Error: ${message}`);
  }

  const responseData = await response.json();
  const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("The Gemini AI model did not return any parseable content. Try a clearer scan.");
  }

  try {
    const parsedJson = JSON.parse(textContent.trim()) as ParseResult;
    return parsedJson;
  } catch (err: any) {
    console.error("Failed to parse AI output text:", textContent, err);
    throw new Error("Received invalid structural JSON response from the model. Please retry.");
  }
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
    throw new Error("Missing Gemini API Key. Please configure your key in settings.");
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `
    You are an expert product price tag recognition system.
    Analyze this camera snapshot of a price tag or shelf label.
    Extract the main product name (keep it clean and precise), price value, size or amount, unit, and matching department category. If a store/supermarket logo or name is explicitly on the tag, extract it; otherwise, use 'Current Store'.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageLowBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch {
      // ignore
    }
    const message = parsedErr?.error?.message || response.statusText || "Unknown API Error";
    throw new Error(`Gemini API Error: ${message}`);
  }

  const responseData = await response.json();
  const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("No text content returned from price tag snapshot.");
  }

  try {
    return JSON.parse(textContent.trim()) as SinglePriceScanResult;
  } catch (err: any) {
    console.error("Failed to parse single price scan output:", textContent, err);
    throw new Error("Invalid structure returned for price snapshot. Please retry.");
  }
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `
    You are an expert e-commerce and price extraction artificial intelligence specialized in Argentine Supermarkets (such as Carrefour, Coto Digital, Jumbo, Disco, VEA, Supermercados Día, ChangoMas, etc.).
    The user entered the following supermarket details:
    - Supermarket Name: "${supermarketName}"
    - Provided URL: "${userUrl}"

    Analyze the URL. Deduce or construct the optimal search query URL template that replaces the query word with the token "{producto}". For example, if they gave "https://www.carrefour.com.ar", you know Carrefour's search engine uses "/catalogsearch/result/?q={producto}". If they gave a generic site, construct a reliable standard search template.
    Write your analysis and suggestions entirely in Spanish, matching the typical Argentine grocery environment.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch {
      // ignore
    }
    const message = parsedErr?.error?.message || response.statusText || "Error desconocido";
    throw new Error(`Error de API Gemini: ${message}`);
  }

  const responseData = await response.json();
  const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("No se recibió respuesta del modelo Gemini al interpretar la URL.");
  }

  try {
    return JSON.parse(textContent.trim()) as SearchUrlInterpretation;
  } catch (err: any) {
    console.error("Failed to parse search interpretation JSON:", textContent, err);
    throw new Error("Estructura devuelta inválida para la interpretación del buscador.");
  }
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
    throw new Error("Missing Gemini API Key. Please configure your key in settings.");
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `
    You are an expert purchase receipt optical character recognition system.
    Analyze this photo of a supermarket checkout receipt.
    Identify and extract:
    1. The Store/Supermarket name (e.g. Carrefour, Coto, DIA, Jumbo). Keep it descriptive but brief.
    2. The Date of the purchase (format as YYYY-MM-DD). If year is missing or unclear, default to '2026'.
    3. The complete list of items, their prices, and item sizes. For item size, detect if there is volume or weight associated (e.g. 'harina 1kg' -> amount 1, unit 'kg').
    4. The receipt total.

    Make sure to parse prices precisely and clean product descriptions to be compact and human-readable in Spanish.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageLowBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch {
      // ignore
    }
    const message = parsedErr?.error?.message || response.statusText || "Unknown API Error";
    throw new Error(`Gemini API Error: ${message}`);
  }

  const responseData = await response.json();
  const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("No readable text returned from receipt checkout image.");
  }

  try {
    return JSON.parse(textContent.trim()) as ReceiptParseResult;
  } catch (err: any) {
    console.error("Failed to parse receipt output:", textContent, err);
    throw new Error("Invalid structure returned for receipt scanner. Please retry.");
  }
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
    throw new Error("Missing Gemini API Key. Please configure your key in settings.");
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `
    You are an expert Argentine supermarket shopping advisor.
    Analyze the user's historical supermarket receipts below and generate a list of 5-10 logical suggested items they should put on their next shopping list.
    Look for recurring products or logical needs (e.g. groceries, cleaning, dairy).
    Explain why each item is suggested inside the 'reason' field entirely in Spanish in a friendly, practical tone suited to an Argentine shopper.

    Receipt History:
    ${JSON.stringify(receipts, null, 2)}
  `;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.3,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Gemini suggestion error response:", text);
    throw new Error("No se pudo conectar con Gemini para sugerencias Inteligentes.");
  }

  const responseData = await response.json();
  const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("No se recibió respuesta del recomendador inteligente.");
  }

  try {
    return JSON.parse(textContent.trim()) as ShoppingListSuggestion[];
  } catch (err) {
    console.error("Failed to parse Gemini shopping suggestions:", textContent, err);
    throw new Error("Estructura devuelta inválida de recomendaciones.");
  }
}

export async function parseApiResults(
  rawResponses: { sourceName: string; rawData: any }[],
  query: string,
  apiKey: string
): Promise<ApiProductResult[]> {
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Please configure your key in settings.");
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const responsesJson = JSON.stringify(rawResponses.map(r => ({
    source: r.sourceName,
    data: r.rawData
  })), null, 2);

  const promptText = `
    You are an expert price comparison data extractor.
    Below are raw API responses from different supermarkets/marketplaces for the product query "${query}".
    Auto-detect the structure of each response and extract ALL product listings.
    Normalize prices to a standard format.
    Identify any discounts, promotions, or special deals.
    Calculate the unit price (price per base unit like kg, L, or unit) for each product.
    Return the data as a JSON array of standardized product objects.

    Raw API Responses:
    ${responsesJson}
  `;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini parseApiResults error:", text);
      return [];
    }

    const responseData = await response.json();
    const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.warn("parseApiResults: no text content returned");
      return [];
    }

    return JSON.parse(textContent.trim()) as ApiProductResult[];
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
    throw new Error("Missing Gemini API Key. Please configure your key in settings.");
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini parseScrapedResults error:", text);
      return [];
    }

    const responseData = await response.json();
    const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.warn("parseScrapedResults: no text content returned");
      return [];
    }

    return JSON.parse(textContent.trim()) as ApiProductResult[];
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
    throw new Error("Missing Gemini API Key. Please configure your key in settings.");
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

  const selectedModel = db.getSelectedModel();
  const modelName = selectedModel.startsWith("models/") ? selectedModel.slice(7) : selectedModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `
    You are an expert at analyzing supermarket and e-commerce websites to determine how to programmatically get product prices and availability data.

    The user wants to set up automated price comparison for:
    - Store Name: "${storeName}"
    - Website URL: "${storeUrl}"

    Analyze this store using your knowledge of e-commerce platforms, public APIs, and web technologies.

    Consider:
    1. Does this store have a known public REST API? (e.g. Mercado Libre API, Walmart API, etc.)
    2. Does it use a common e-commerce platform with predictable URL patterns? (e.g. VTEX uses /catalogsearch/result/?q=, VTEX also has /api/catalog_system/pub/products/search/)
    3. Can product prices be obtained via a well-structured search URL?
    4. What is the best approach for a client-side application to get prices from this store?

    For stores built on VTEX (like Carrefour Argentina, Jumbo, Disco):
    - They have a public VTEX search API at /api/catalog_system/pub/products/search?q={producto}
    - This returns JSON with prices, names, images
    - methodType should be "api" and responseJsonPath should be left empty (the response itself is the array)

    For stores with custom APIs (like Mercado Libre):
    - Use their documented API endpoints
    - Set appropriate query parameters and headers

    For stores that only have HTML search pages:
    - methodType should be "scrape"
    - Generate the search URL template for their search box
    - Provide CSS selectors if you know the HTML structure

    If neither API nor scraping is feasible:
    - methodType should be "unsupported"
    - Explain why in the analysis field

    Return the configuration in Spanish for the analysis and tips fields.
  `;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("analyzeStoreForApi error:", text);
      let message = response.statusText;
      try { const errJson = JSON.parse(text); message = errJson?.error?.message || message; } catch {}
      throw new Error(`Error de Gemini: ${message}`);
    }

    const responseData = await response.json();
    const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error("No se recibió respuesta del análisis de la tienda.");
    }

    return JSON.parse(textContent.trim()) as StoreAnalysisResult;
  } catch (err: any) {
    console.error("analyzeStoreForApi failed:", err);
    throw err;
  }
}

