/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Receipt } from "./types";
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


